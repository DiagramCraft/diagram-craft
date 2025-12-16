import { Application } from '../../application';
import { assert } from '@diagram-craft/utils/assert';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas-app/actions/abstractSelectionAction';
import { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';
import {
  findEntryBySchema,
  getExternalDataStatus,
  hasDataForSchema
} from '@diagram-craft/canvas-app/externalDataHelpers';
import { DataTemplate, DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { newid } from '@diagram-craft/utils/id';
import { serializeDiagramElement } from '@diagram-craft/model/serialization/serialize';
import { AbstractAction } from '@diagram-craft/canvas/action';
import { makeUndoableAction } from '@diagram-craft/model/undoManager';
import { deepClone } from '@diagram-craft/utils/object';
import type { Data } from '@diagram-craft/model/dataProvider';
import { DataManagerUndoableFacade } from '@diagram-craft/model/diagramDocumentDataUndoActions';
import type { FlatObject } from '@diagram-craft/utils/flatObject';
import type { SerializedElement } from '@diagram-craft/model/serialization/serializedTypes';
import type { NodeProps, EdgeProps } from '@diagram-craft/model/diagramProps';
import { $tStr } from '@diagram-craft/utils/localize';

export const externalDataActions = (application: Application) => ({
  EXTERNAL_DATA_UNLINK: new ExternalDataUnlinkAction(application),
  EXTERNAL_DATA_MAKE_TEMPLATE: new ExternalDataMakeTemplateAction(application),
  EXTERNAL_DATA_LINK: new ExternalDataLinkAction(application),
  EXTERNAL_DATA_CLEAR: new ExternalDataClear(application),
  EXTERNAL_DATA_LINK_REMOVE_TEMPLATE: new ExternalDataLinkRemoveTemplate(application),
  EXTERNAL_DATA_LINK_RENAME_TEMPLATE: new ExternalDataLinkRenameTemplate(application),
  EXTERNAL_DATA_LINK_UPDATE_TEMPLATE: new ExternalDataLinkUpdateTemplate(application)
});

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof externalDataActions> {}
  }
}

type SchemaArg = { schemaId: string };

export class ExternalDataUnlinkAction extends AbstractSelectionAction<Application, SchemaArg> {
  name = $tStr('action.EXTERNAL_DATA_UNLINK.name', 'Unlink');

  constructor(application: Application) {
    super(application, MultipleType.SingleOnly, ElementType.Both);
  }

  isEnabled(arg: Partial<SchemaArg>): boolean {
    return (
      super.isEnabled(arg) &&
      getExternalDataStatus(
        this.context.model.activeDiagram.selection.elements[0]!,
        arg.schemaId!
      ) === 'linked'
    );
  }
  execute(arg: Partial<SchemaArg>): void {
    const elements = this.context.model.activeDiagram.selection.elements;
    assert.arrayNotEmpty(elements as DiagramElement[]);

    const $d = elements[0]!.diagram;
    const uow = new UnitOfWork($d, true);

    for (const e of elements) {
      e.updateMetadata(p => {
        p.data ??= { data: [] };
        const item = p.data.data!.find(d => d.type === 'external' && d.schema === arg.schemaId);
        assert.present(item);
        item.external = undefined;
        item.type = 'schema';
      }, uow);
    }

    commitWithUndo(uow, 'Break external data link');
  }
}

export class ExternalDataClear extends AbstractSelectionAction<Application, SchemaArg> {
  name = $tStr('action.EXTERNAL_DATA_CLEAR.name', 'Unlink & Clear');

  constructor(application: Application) {
    super(application, MultipleType.SingleOnly, ElementType.Both);
  }

  isEnabled(arg: Partial<SchemaArg>): boolean {
    return (
      super.isEnabled(arg) &&
      getExternalDataStatus(
        this.context.model.activeDiagram.selection.elements[0]!,
        arg.schemaId!
      ) === 'linked'
    );
  }
  execute(arg: Partial<SchemaArg>): void {
    const elements = this.context.model.activeDiagram.selection.elements;
    assert.arrayNotEmpty(elements as DiagramElement[]);

    const $d = elements[0]!.diagram;
    const uow = new UnitOfWork($d, true);

    for (const e of elements) {
      e.updateMetadata(p => {
        p.data!.data ??= [];
        p.data!.data = p.data!.data.filter(s => s.schema !== arg.schemaId);
      }, uow);
    }

    commitWithUndo(uow, 'Break external data link');
  }
}

export type ExternalDataLinkActionProps = {
  schema: DataSchema;
};

export class ExternalDataLinkAction extends AbstractSelectionAction<Application, SchemaArg> {
  name = $tStr('action.EXTERNAL_DATA_LINK.name', 'Link');

  constructor(application: Application) {
    super(application, MultipleType.SingleOnly, ElementType.Both);
  }

  isEnabled(arg: Partial<SchemaArg>): boolean {
    return (
      super.isEnabled(arg) &&
      getExternalDataStatus(
        this.context.model.activeDiagram.selection.elements[0]!,
        arg.schemaId!
      ) !== 'linked'
    );
  }

  execute(arg: Partial<SchemaArg>): void {
    const $d = this.context.model.activeDiagram;
    const element = $d.selection.elements[0]!;
    const schema = this.context.model.activeDocument.data.db.getSchema(arg.schemaId!);

    const hasElementData = hasDataForSchema(element, arg.schemaId!);
    const elementDataEntry = findEntryBySchema(element, arg.schemaId!);
    const canCreateData = this.context.model.activeDocument.data.db.isDataEditable(schema);

    this.context.ui.showDialog({
      id: 'externalDataLink',
      onCancel: () => {},
      onOk: async (data: { uid: string; formData?: FlatObject }) => {
        const { uid, formData } = data;

        const db = $d.document.data.db;
        const dbUndoable = new DataManagerUndoableFacade($d.undoManager, db);

        // Check if this uid exists in the database
        const existingData = db.getById(schema, [uid]);

        // If it doesn't exist, create it with form data or element data
        if (existingData.length === 0) {
          const dataToUse = formData ?? elementDataEntry?.data;
          if (dataToUse) {
            const newData: Data = {
              _uid: uid,
              ...dataToUse
            };

            // Create the shared data entry
            await dbUndoable.addData(schema, newData);
          }
        }

        // Link to the data (either newly created or existing)
        const uow = new UnitOfWork($d, true);
        $d.selection.elements.forEach(e => {
          e.updateMetadata(p => {
            p.data ??= { data: [] };

            let item = p.data.data!.find(d => d.schema === arg.schemaId);
            const existing = item !== undefined;
            if (!existing) {
              item = {
                schema: arg.schemaId!,
                type: 'schema',
                data: {},
                external: {
                  uid: uid
                },
                enabled: true
              };
              p.data.data!.push(item);
            }
            assert.present(item);

            item.external = {
              uid: uid
            };
            item.type = 'external';

            const [data] = db.getById(db.getSchema(arg.schemaId!), [uid]) as [Data];
            for (const k of Object.keys(data)) {
              if (k.startsWith('_')) continue;
              item.data[k] = data[k];
            }
          }, uow);
        });
        commitWithUndo(uow, 'Link external data');
      },
      props: {
        schema,
        hasElementData,
        elementData: elementDataEntry?.data,
        canCreateData,
        elementName: element.name
      }
    });
  }
}

export class ExternalDataMakeTemplateAction extends AbstractSelectionAction<
  Application,
  SchemaArg
> {
  name = $tStr('action.EXTERNAL_DATA_MAKE_TEMPLATE.name', 'Make template');

  constructor(application: Application) {
    super(application, MultipleType.SingleOnly, ElementType.Both);
  }

  isEnabled(arg: Partial<SchemaArg>): boolean {
    return (
      super.isEnabled(arg) &&
      getExternalDataStatus(
        this.context.model.activeDiagram.selection.elements[0]!,
        arg.schemaId!
      ) === 'linked'
    );
  }

  execute(arg: Partial<SchemaArg>): void {
    this.context.ui.showDialog({
      id: 'stringInput',
      props: {
        value: '',
        title: 'Template name',
        label: 'Name',
        saveButtonLabel: 'Create',
        type: 'string'
      },
      onCancel: () => {},
      onOk: (v: string) => {
        const template: DataTemplate = {
          id: newid(),
          schemaId: arg.schemaId!,
          name: v,
          template: serializeDiagramElement(this.context.model.activeDiagram.selection.elements[0]!)
        };

        const $d = this.context.model.activeDiagram;
        const $doc = this.context.model.activeDocument;
        $d.undoManager.addAndExecute(
          makeUndoableAction('Create template', {
            redo: () => $doc.data.templates.add(template),
            undo: () => $doc.data.templates.remove(template.id)
          })
        );
      }
    });
  }
}

export class ExternalDataLinkRemoveTemplate extends AbstractAction<
  { templateId: string },
  Application
> {
  name = $tStr('action.EXTERNAL_DATA_LINK_REMOVE_TEMPLATE.name', 'Remove Template');

  execute(arg: Partial<{ templateId: string }>): void {
    const $d = this.context.model.activeDiagram;
    const $doc = this.context.model.activeDocument;

    const template = $doc.data.templates.byId(arg.templateId!);
    assert.present(template);

    $d.undoManager.addAndExecute(
      makeUndoableAction('Remove template', {
        redo: () => $doc.data.templates.remove(arg.templateId!),
        undo: () => $doc.data.templates.add(template)
      })
    );
  }
}

export class ExternalDataLinkRenameTemplate extends AbstractAction<
  { templateId: string },
  Application
> {
  name = $tStr('action.EXTERNAL_DATA_LINK_RENAME_TEMPLATE.name', 'Rename Template');

  execute(arg: Partial<{ templateId: string }>): void {
    const $d = this.context.model.activeDiagram;
    const $doc = this.context.model.activeDocument;

    const template = $doc.data.templates.byId(arg.templateId!);
    assert.present(template);

    const oldTemplate = deepClone(template);

    this.context.ui.showDialog({
      id: 'stringInput',
      props: {
        value: template.name ?? '',
        title: 'Rename template',
        label: 'Name',
        saveButtonLabel: 'Rename',
        type: 'string'
      },
      onCancel: () => {},
      onOk: (v: string) => {
        template.name = v;

        $d.undoManager.addAndExecute(
          makeUndoableAction('Rename template', {
            redo: () => $doc.data.templates.update(template),
            undo: () => $doc.data.templates.update(oldTemplate)
          })
        );
      }
    });
  }
}

export class ExternalDataLinkUpdateTemplate extends AbstractSelectionAction<
  Application,
  SchemaArg
> {
  name = $tStr('action.EXTERNAL_DATA_LINK_UPDATE_TEMPLATE.name', 'Update template');

  constructor(application: Application) {
    super(application, MultipleType.SingleOnly, ElementType.Node);
  }

  isEnabled(arg: Partial<SchemaArg>): boolean {
    if (!super.isEnabled(arg)) return false;

    const $d = this.context.model.activeDiagram;
    const selectedElement = $d.selection.elements[0];

    // Check if the selected element has external data linked to this schema
    const dataEntry = selectedElement?.metadata.data?.data?.find(
      d => d.schema === arg.schemaId && d.type === 'external'
    );

    if (!dataEntry?.external?.uid) return false;

    // Check if there are any templates for this schema
    const $doc = this.context.model.activeDocument;
    const templates = $doc.data.templates.bySchema(arg.schemaId!);

    return templates.length > 0;
  }

  execute(arg: Partial<SchemaArg>): void {
    const $d = this.context.model.activeDiagram;
    const $doc = this.context.model.activeDocument;

    const selectedElement = $d.selection.elements[0];
    assert.present(selectedElement);

    const templates = $doc.data.templates.bySchema(arg.schemaId!);

    const updateTemplate = (template: DataTemplate) => {
      const oldTemplate = deepClone(template);
      const newTemplate = deepClone(template);
      newTemplate.template = serializeDiagramElement(selectedElement);

      // Update all elements that use this template
      this.updateElementsUsingTemplate(
        $doc,
        template.id,
        oldTemplate.template,
        newTemplate.template
      );

      $d.undoManager.addAndExecute(
        makeUndoableAction('Update template', {
          redo: () => $doc.data.templates.update(newTemplate),
          undo: () => $doc.data.templates.update(oldTemplate)
        })
      );
    };

    // If only one template, update it directly
    if (templates.length === 1) {
      updateTemplate(templates[0]!);
    } else {
      // Show dialog to select which template to update
      this.context.ui.showDialog({
        id: 'selectTemplate',
        props: {
          title: 'Update Template',
          label: 'Select template to update',
          templates: templates
        },
        onCancel: () => {},
        onOk: (templateId: string) => {
          const template = $doc.data.templates.byId(templateId);
          assert.present(template);
          updateTemplate(template);
        }
      });
    }
  }

  private updateElementsUsingTemplate(
    $doc: DiagramDocument,
    templateId: string,
    oldTemplate: SerializedElement,
    newTemplate: SerializedElement
  ): void {
    // Iterate through all diagrams in the document
    for (const diagram of $doc.diagrams) {
      const uow = new UnitOfWork(diagram, true);
      let hasUpdates = false;

      // Find all elements that use this template
      for (const element of diagram.visibleElements()) {
        if (element.metadata.data?.templateId !== templateId) continue;

        // Update the element's props based on the template change
        element.updateProps(props => {
          // Remove old template props that haven't been customized
          this.removeOldTemplateProps(props, oldTemplate.props as NodeProps | EdgeProps);

          // Add new template props (only if not already set)
          this.addNewTemplateProps(props, newTemplate.props as NodeProps | EdgeProps);
        }, uow);

        hasUpdates = true;
      }

      if (hasUpdates) {
        commitWithUndo(uow, 'Update elements from template');
      }
    }
  }

  private removeOldTemplateProps(
    elementProps: NodeProps | EdgeProps,
    oldTemplateProps: NodeProps | EdgeProps
  ): void {
    // Helper to check if two values are equal (deep comparison for objects)
    const valuesEqual = (a: unknown, b: unknown): boolean => {
      if (a === b) return true;
      if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;

      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;

      return keysA.every(key =>
        valuesEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
      );
    };

    // Recursively remove props that match the old template
    const removeMatchingProps = (
      target: Record<string, unknown>,
      template: Record<string, unknown>
    ) => {
      for (const key of Object.keys(template)) {
        if (!(key in target)) continue;

        const targetValue = target[key];
        const templateValue = template[key];

        if (
          typeof templateValue === 'object' &&
          templateValue !== null &&
          !Array.isArray(templateValue)
        ) {
          // Recursively handle nested objects
          if (
            typeof targetValue === 'object' &&
            targetValue !== null &&
            !Array.isArray(targetValue)
          ) {
            removeMatchingProps(
              targetValue as Record<string, unknown>,
              templateValue as Record<string, unknown>
            );

            // Remove the parent key if it's now empty
            if (Object.keys(targetValue as Record<string, unknown>).length === 0) {
              delete target[key];
            }
          }
        } else if (valuesEqual(targetValue, templateValue)) {
          // Remove the property if it matches the old template value
          delete target[key];
        }
      }
    };

    removeMatchingProps(
      elementProps as Record<string, unknown>,
      oldTemplateProps as Record<string, unknown>
    );
  }

  private addNewTemplateProps(
    elementProps: NodeProps | EdgeProps,
    newTemplateProps: NodeProps | EdgeProps
  ): void {
    // Recursively add props from the new template (only if not already set)
    const addMissingProps = (
      target: Record<string, unknown>,
      template: Record<string, unknown>
    ) => {
      for (const key of Object.keys(template)) {
        const templateValue = template[key];

        if (!(key in target)) {
          // Property doesn't exist in element, add it from template
          target[key] = deepClone(templateValue);
        } else if (
          typeof templateValue === 'object' &&
          templateValue !== null &&
          !Array.isArray(templateValue)
        ) {
          // Recursively handle nested objects
          const targetValue = target[key];
          if (
            typeof targetValue === 'object' &&
            targetValue !== null &&
            !Array.isArray(targetValue)
          ) {
            addMissingProps(
              targetValue as Record<string, unknown>,
              templateValue as Record<string, unknown>
            );
          }
        }
        // If property exists and is not an object, skip it (element has been customized)
      }
    };

    addMissingProps(
      elementProps as Record<string, unknown>,
      newTemplateProps as Record<string, unknown>
    );
  }
}
