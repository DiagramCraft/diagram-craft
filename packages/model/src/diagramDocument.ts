import { DiagramPalette } from './diagramPalette';
import { DiagramStyles } from './diagramStyles';
import { DataSchema, DiagramDataSchemas } from './diagramDataSchemas';
import { Diagram, diagramIterator, DiagramIteratorOpts } from './diagram';
import { AttachmentConsumer, AttachmentManager } from './attachment';
import { EventEmitter } from '@diagram-craft/utils/event';
import { range } from '@diagram-craft/utils/array';
import { EdgeDefinitionRegistry, NodeDefinitionRegistry } from './elementDefinitionRegistry';
import { precondition } from '@diagram-craft/utils/assert';
import { isNode } from './diagramElement';
import { UnitOfWork } from './unitOfWork';
import { Data, DataProvider, DataProviderRegistry } from './dataProvider';
import { DefaultDataProvider, DefaultDataProviderId } from './dataProviderDefault';
import { UrlDataProvider, UrlDataProviderId } from './dataProviderUrl';
import { Generators } from '@diagram-craft/utils/generator';
import { deepEquals } from '@diagram-craft/utils/object';
import { SerializedElement } from './serialization/types';

const byUid = (uid: string) => (dt: ElementDataEntry) =>
  dt.type === 'external' && dt.external?.uid === uid;

export type DocumentEvents = {
  diagramchanged: { after: Diagram };
  diagramadded: { node: Diagram };
  diagramremoved: { node: Diagram };
};

export type DataTemplate = {
  id: string;
  schemaId: string;
  name: string;
  template: SerializedElement;
};

export class DiagramDocument extends EventEmitter<DocumentEvents> implements AttachmentConsumer {
  attachments = new AttachmentManager(this);
  customPalette = new DiagramPalette(range(0, 14).map(() => '#000000'));
  styles = new DiagramStyles(this);

  // TODO: To be loaded from file
  schemas = new DiagramDataSchemas(this, [
    {
      id: 'default',
      name: 'Default',
      source: 'document',
      fields: [
        {
          id: 'name',
          name: 'Name',
          type: 'text'
        },
        {
          id: 'notes',
          name: 'Notes',
          type: 'longtext'
        }
      ]
    }
  ]);

  #dataProvider: DataProvider | undefined;

  #dataProviderUpdateDataListener = (data: { data: Data[] }) => {
    for (const d of this.diagramIterator({ nest: true })) {
      const uow = new UnitOfWork(d);
      for (const e of d.allElements()) {
        const externalData = e.metadata.data?.data?.filter(d => d.type === 'external') ?? [];
        if (externalData.length === 0) continue;

        for (const dt of data.data) {
          const predicate = byUid(dt._uid);
          const existing = externalData.find(predicate);
          if (existing && !deepEquals<unknown>(existing, dt)) {
            e.updateMetadata(cb => {
              const toUpdate = cb.data!.data!.find(predicate)!;
              toUpdate.data = dt;
            }, uow);
          }
        }
      }
      uow.commit();
    }
  };

  #dataProviderDeleteDataListener = (data: { data: Data[] }) => {
    for (const d of this.diagramIterator({ nest: true })) {
      const uow = new UnitOfWork(d);
      for (const e of d.allElements()) {
        const externalData = e.metadata.data?.data?.filter(d => d.type === 'external') ?? [];
        if (externalData.length === 0) continue;

        for (const dt of data.data) {
          const predicate = byUid(dt._uid);
          const existing = externalData.find(predicate);
          if (existing && !deepEquals<unknown>(existing, dt)) {
            e.updateMetadata(cb => {
              cb.data ??= {};
              cb.data!.data = cb.data?.data?.filter(dt => !predicate(dt));
            }, uow);
          }
        }
      }
      uow.commit();
    }
  };

  #dataProviderDeleteSchemaListener = (s: DataSchema) => {
    this.schemas.removeSchema(s, UnitOfWork.immediate(this.#diagrams[0]));
  };

  #dataProviderUpdateSchemaListener = (s: DataSchema) => {
    if (this.schemas.has(s.id)) {
      this.schemas.changeSchema(s);
    } else {
      this.schemas.addSchema(s);
    }
  };

  #dataProviderTemplates: DataTemplate[] = [];

  // TODO: To be loaded from file
  props: DocumentProps = {
    query: {
      saved: [
        ['active-layer', '.elements[]'],
        ['active-layer', '.elements[] | select(.edges | length > 0)']
      ]
    }
  };

  #diagrams: Diagram[] = [];

  url: string | undefined;

  constructor(
    public readonly nodeDefinitions: NodeDefinitionRegistry,
    public readonly edgeDefinitions: EdgeDefinitionRegistry
  ) {
    super();
  }

  // TODO: Consider moving all of this to a DataTemplates class, with methods
  //       such as .add, .remove and .getAll
  addDataTemplate(template: DataTemplate) {
    this.#dataProviderTemplates.push(template);
  }

  removeDataTemplate(template: DataTemplate | string) {
    const idx = this.#dataProviderTemplates.findIndex(
      t => t.id === (typeof template === 'string' ? template : template.id)
    );
    if (idx !== -1) {
      this.#dataProviderTemplates.splice(idx, 1);
    }
  }

  updateDataTemplate(_template: DataTemplate) {
    // Do nothing for now
  }

  get dataTemplates() {
    return this.#dataProviderTemplates;
  }

  get topLevelDiagrams() {
    return this.#diagrams;
  }

  get definitions() {
    return {
      nodeDefinitions: this.nodeDefinitions,
      edgeDefinitions: this.edgeDefinitions
    };
  }

  *diagramIterator(opts: DiagramIteratorOpts = {}) {
    yield* diagramIterator(this.#diagrams, opts);
  }

  get dataProvider() {
    return this.#dataProvider;
  }

  set dataProvider(dataProvider: DataProvider | undefined) {
    this.#dataProvider?.off?.('addData', this.#dataProviderUpdateDataListener);
    this.#dataProvider?.off?.('updateData', this.#dataProviderUpdateDataListener);
    this.#dataProvider?.off?.('deleteData', this.#dataProviderDeleteDataListener);
    this.#dataProvider?.off?.('addSchema', this.#dataProviderUpdateSchemaListener);
    this.#dataProvider?.off?.('updateSchema', this.#dataProviderUpdateSchemaListener);
    this.#dataProvider?.off?.('deleteSchema', this.#dataProviderDeleteSchemaListener);

    this.#dataProvider = dataProvider;

    if (this.#dataProvider) {
      this.#dataProvider.on('addData', this.#dataProviderUpdateDataListener);
      this.#dataProvider.on('updateData', this.#dataProviderUpdateDataListener);
      this.#dataProvider.on('deleteData', this.#dataProviderDeleteDataListener);
      this.#dataProvider.on('addSchema', this.#dataProviderUpdateSchemaListener);
      this.#dataProvider.on('updateSchema', this.#dataProviderUpdateSchemaListener);
      this.#dataProvider.on('deleteSchema', this.#dataProviderDeleteSchemaListener);
    }
  }

  getById(id: string) {
    return Generators.first(
      this.diagramIterator({
        nest: true,
        filter: (d: Diagram) => d.id === id,
        earlyExit: true
      })
    );
  }

  addDiagram(diagram: Diagram) {
    precondition.is.false(!!this.#diagrams.find(d => d.id === diagram.id));

    this.#diagrams.push(diagram);
    diagram.document = this;
    this.emit('diagramadded', { node: diagram });
  }

  removeDiagram(diagram: Diagram) {
    const idx = this.#diagrams.indexOf(diagram);
    if (idx !== -1) {
      this.#diagrams.splice(idx, 1);
      this.emit('diagramremoved', { node: diagram });
    }
  }

  changeDiagram(diagram: Diagram) {
    this.emit('diagramchanged', { after: diagram });
  }

  toJSON() {
    return {
      diagrams: this.#diagrams,
      styles: this.styles,
      props: this.props,
      customPalette: this.customPalette
    };
  }

  getAttachmentsInUse() {
    return [...this.diagramIterator({ nest: true }).flatMap(e => e.getAttachmentsInUse())];
  }

  // TODO: We should probably move this into the diagram loaders and/or deserialization
  //       This way, warnings as anchors are determined during deserialization are triggered
  async load() {
    const loadedTypes = new Set<string>();
    for (const diagram of this.diagramIterator({ nest: true })) {
      const uow = UnitOfWork.immediate(diagram);
      for (const element of diagram.allElements()) {
        if (isNode(element)) {
          const s = element.nodeType;
          if (!this.nodeDefinitions.hasRegistration(s)) {
            if (!(await this.nodeDefinitions.load(s))) {
              console.warn(`Node definition ${s} not loaded`);
            } else {
              element.invalidate(uow);
              loadedTypes.add(s);
            }
          } else if (loadedTypes.has(s)) {
            element.invalidate(uow);
          }
        }
      }
    }
  }
}

/*
 * Register default data providers
 */
DataProviderRegistry.register(DefaultDataProviderId, (s: string) => new DefaultDataProvider(s));
DataProviderRegistry.register(UrlDataProviderId, (s: string) => new UrlDataProvider(s));
