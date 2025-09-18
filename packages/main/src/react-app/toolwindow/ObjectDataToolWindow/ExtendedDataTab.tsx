import { Accordion } from '@diagram-craft/app-components/Accordion';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { useApplication, useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import React, { ChangeEvent, useCallback, useState } from 'react';
import type { Data } from '@diagram-craft/model/dataProvider';
import {
  AddSchemaUndoableAction,
  DataSchema,
  DeleteSchemaUndoableAction,
  ModifySchemaUndoableAction
} from '@diagram-craft/model/diagramDocumentDataSchemas';
import { useEventListener } from '../../hooks/useEventListener';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { commitWithUndo, SnapshotUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { unique } from '@diagram-craft/utils/array';
import type { DiagramElement } from '@diagram-craft/model/diagramElement';
import {
  TbDots,
  TbFilter,
  TbFilterOff,
  TbLink,
  TbLinkOff,
  TbPencil,
  TbTablePlus
} from 'react-icons/tb';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { CompoundUndoableAction } from '@diagram-craft/model/undoManager';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { EditItemDialog } from '../../components/EditItemDialog';
import { EditSchemaDialog } from '../../components/EditSchemaDialog';
import { ToolWindow } from '../ToolWindow';
import { ToolWindowPanel } from '../ToolWindowPanel';

const findEntryBySchema = (e: DiagramElement, schema: string) => {
  return e.metadata.data?.data?.find(s => s.schema === schema);
};

export const ExtendedDataTab = () => {
  const $d = useDiagram();
  const redraw = useRedraw();
  const application = useApplication();
  const [editItemDialog, setEditItemDialog] = useState<{
    open: boolean;
    item?: Data;
    schema?: string;
  }>({ open: false });

  const [editSchemaDialog, setEditSchemaDialog] = useState<{
    open: boolean;
    schema?: DataSchema;
  }>({ open: false });
  const [editMode, setEditMode] = useState(true);

  useEventListener($d.selectionState, 'change', redraw);
  useEventListener($d, 'change', redraw);
  useEventListener($d, 'uowCommit', redraw);

  const changeCallback = useCallback(
    (
      type: 'data' | 'custom',
      schema: string,
      id: string,
      ev: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      const uow = new UnitOfWork($d, true);

      if (type === 'data') {
        $d.selectionState.elements.forEach(e => {
          e.updateMetadata(p => {
            p.data ??= {};
            p.data.data ??= [];
            let s = p.data.data.find(e => e.schema === schema);
            if (!s) {
              s = { schema, type: 'schema', data: {} };
              p.data.data.push(s);
            }
            s.data ??= {};
            s.data[id] = (ev.target! as HTMLInputElement).value;
          }, uow);
        });
      } else if (type === 'custom') {
        $d.selectionState.elements.forEach(e => {
          e.updateMetadata(p => {
            p.data ??= {};
            p.data.customData ??= {};
            p.data.customData[id] = (ev.target! as HTMLInputElement).value;
          }, uow);
        });
      } else {
        VERIFY_NOT_REACHED();
      }
      commitWithUndo(uow, 'Update data');
    },
    [$d]
  );

  const clearExternalLinkage = useCallback(
    (schemaId: string) => {
      application.actions['EXTERNAL_DATA_UNLINK']!.execute({
        schemaId: schemaId
      });
      redraw();
    },
    [$d]
  );

  const addSchemaToSelection = useCallback(
    (schema: string) => {
      $d.selectionState.elements.forEach(e => {
        const entry = findEntryBySchema(e, schema);
        const uow = new UnitOfWork($d, true);
        if (!entry) {
          e.updateMetadata(p => {
            p.data ??= {};
            p.data.data ??= [];
            p.data.data.push({ enabled: true, schema, type: 'schema', data: {} });
          }, uow);
          commitWithUndo(uow, 'Add schema to selection');
        } else if (!entry.enabled) {
          e.updateMetadata(p => {
            p.data!.data!.find(s => s.schema === schema)!.enabled = true;
          }, uow);
          commitWithUndo(uow, 'Add schema to selection');
        }
      });
    },
    [$d]
  );

  const removeSchemaFromSelection = useCallback(
    (schema: string) => {
      $d.selectionState.elements.forEach(e => {
        const entry = findEntryBySchema(e, schema);
        if (entry?.enabled) {
          const uow = new UnitOfWork($d, true);
          e.updateMetadata(p => {
            p.data!.data!.find(s => s.schema === schema)!.enabled = false;
          }, uow);
          commitWithUndo(uow, 'Remove schema from selection');
        }
      });
    },
    [$d]
  );

  const addExternalLinkage = useCallback(
    (schema: DataSchema) => {
      application.actions['EXTERNAL_DATA_LINK']!.execute({
        schemaId: schema.id
      });
    },
    [$d]
  );

  const editExternalData = useCallback(
    (schema: string) => {
      const dataProvider = $d.document.data.provider;
      assert.present(dataProvider);

      // Get the external data item for editing
      const e = $d.selectionState.elements[0];
      const externalData = findEntryBySchema(e, schema);
      assert.true(externalData?.type === 'external');

      if (externalData?.enabled) {
        const items = dataProvider.getById([externalData.external!.uid]);
        assert.arrayWithExactlyOneElement(items);

        setEditItemDialog({
          open: true,
          item: items[0],
          schema: schema
        });
      }
    },
    [$d, setEditItemDialog]
  );

  const saveSchema = useCallback((s: DataSchema) => {
    const schemas = $d.document.data.schemas;
    const isNew = schemas.get(s.id).id === '';
    $d.undoManager.addAndExecute(
      isNew ? new AddSchemaUndoableAction($d, s) : new ModifySchemaUndoableAction($d, s)
    );
    redraw();
  }, []);

  const customDataKeys = unique(
    $d.selectionState.elements.flatMap(e => Object.keys(e.metadata.data?.customData ?? {}))
  ).toSorted();

  // Get all schemas that are enabled from all selected elements
  const enabledSchemas = unique(
    $d.selectionState.elements.flatMap(e =>
      e.metadata.data?.data?.filter(d => d.enabled).map(d => d.schema)
    )
  ).filter((schema): schema is string => schema !== undefined);

  if ($d.selectionState.elements.length !== 1) return null;

  return (
    <>
      <ToolWindow.TabContent>
        <ToolWindow.TabActions>
          <a
            className={'cmp-button cmp-button--icon-only'}
            onClick={() => setEditSchemaDialog({ open: true, schema: undefined })}
            title="Add new schema"
          >
            <TbTablePlus />
          </a>
          <a
            className={'cmp-button cmp-button--icon-only'}
            style={{ color: !editMode ? 'var(--accent-fg)' : undefined }}
            onClick={() => setEditMode(v => !v)}
          >
            {editMode ? <TbFilterOff /> : <TbFilter />}
          </a>
        </ToolWindow.TabActions>
        <ToolWindowPanel
          id={'extended'}
          title={'Extended data'}
          mode={'headless-no-padding'}
          style={{ padding: '0', borderBottom: 'none' }}
        >
          <Accordion.Root type={'multiple'} defaultValue={['_custom', ...enabledSchemas]}>
            {/* Show all schemas, but conditionally render content */}
            {$d.document.data.schemas.all.map(schema => {
              const isSchemaEnabled = enabledSchemas.includes(schema.id);
              const isExternal = $d.selectionState.elements.some(
                e => e.metadata.data?.data?.find(d => d.schema === schema.id)?.type === 'external'
              );
              const isExternalSchema = schema.source === 'external';

              if (!editMode && !isSchemaEnabled) return null;
              return (
                <Accordion.Item key={schema.id} value={schema.id}>
                  <Accordion.ItemHeader>
                    <div className={'util-hstack'} style={{ gap: '0.5rem' }}>
                      {editMode && (
                        <input
                          className="cmp-accordion__enabled"
                          type={'checkbox'}
                          checked={isSchemaEnabled}
                          onChange={e => {
                            const isChecked = e.target.checked;
                            const accordionItem = e.target.closest(
                              '.cmp-accordion__item'
                            ) as HTMLElement;
                            const accordionContent = accordionItem?.querySelector(
                              '.cmp-accordion__content'
                            ) as HTMLElement;
                            const accordionHeader = accordionItem?.querySelector(
                              '.cmp-accordion__header'
                            ) as HTMLElement;

                            if (accordionItem) {
                              if (isChecked) {
                                accordionItem.dataset.state = 'open';
                                accordionContent.dataset.state = 'open';
                                accordionHeader.dataset.state = 'open';
                                addSchemaToSelection(schema.id);
                              } else {
                                accordionItem.dataset.state = 'closed';
                                accordionContent.dataset.state = 'closed';
                                accordionHeader.dataset.state = 'closed';
                                removeSchemaFromSelection(schema.id);
                              }
                            }
                          }}
                          onClick={e => e.stopPropagation()}
                        />
                      )}

                      <span>
                        {schema.name} {isExternal ? '(external)' : ''}
                      </span>
                    </div>
                    <Accordion.ItemHeaderButtons>
                      {isExternal && (
                        <a
                          className={'cmp-button cmp-button--icon-only'}
                          onClick={() => editExternalData(schema.id)}
                          title="Edit external data"
                        >
                          <TbPencil />
                        </a>
                      )}
                      {isExternal && (
                        <a
                          className={'cmp-button cmp-button--icon-only'}
                          onClick={() => clearExternalLinkage(schema.id)}
                          title="Unlink external data"
                          style={{ color: 'var(--accent-fg)' }}
                        >
                          <TbLinkOff />
                        </a>
                      )}
                      {!isExternal && isExternalSchema && (
                        <a
                          className={'cmp-button cmp-button--icon-only'}
                          onClick={() => addExternalLinkage(schema)}
                          title="Link to external data"
                        >
                          <TbLink />
                        </a>
                      )}
                      {schema.source !== 'external' && (
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <a
                              className={'cmp-button cmp-button--icon-only'}
                              title="Schema options"
                            >
                              <TbDots />
                            </a>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.Content className="cmp-context-menu" sideOffset={2}>
                              <DropdownMenu.Item
                                className="cmp-context-menu__item"
                                onClick={() => setEditSchemaDialog({ open: true, schema: schema })}
                              >
                                Edit Schema
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                className="cmp-context-menu__item"
                                onClick={() => {
                                  application.ui.showDialog(
                                    new MessageDialogCommand(
                                      {
                                        title: 'Confirm delete',
                                        message: 'Are you sure you want to delete this schema?',
                                        okLabel: 'Yes',
                                        okType: 'danger',
                                        cancelLabel: 'No'
                                      },
                                      () => {
                                        const uow = new UnitOfWork($d, true);
                                        const schemas = $d.document.data.schemas;
                                        schemas.removeAndClearUsage(schema, uow);

                                        const snapshots = uow.commit();
                                        $d.undoManager.add(
                                          new CompoundUndoableAction([
                                            new DeleteSchemaUndoableAction(uow.diagram, schema),
                                            new SnapshotUndoableAction(
                                              'Delete schema',
                                              uow.diagram,
                                              snapshots
                                            )
                                          ])
                                        );
                                        redraw();
                                      }
                                    )
                                  );
                                }}
                              >
                                Delete Schema
                              </DropdownMenu.Item>
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      )}
                    </Accordion.ItemHeaderButtons>
                  </Accordion.ItemHeader>
                  <Accordion.ItemContent forceMount={true}>
                    <div className={'cmp-labeled-table'}>
                      {schema.fields.map(f => {
                        const v = unique(
                          $d.selectionState.elements.map(
                            e => findEntryBySchema(e, schema.id)?.data?.[f.id]
                          )
                        );

                        return (
                          <React.Fragment key={f.id}>
                            <div className={'cmp-labeled-table__label util-a-top-center'}>
                              {f.name}:
                            </div>
                            <div className={'cmp-labeled-table__value'}>
                              {f.type === 'text' && (
                                <TextInput
                                  value={v.length > 1 ? '***' : (v[0]?.toString() ?? '')}
                                  disabled={isExternal}
                                  onChange={(_, e) => changeCallback('data', schema.id, f.id, e)}
                                />
                              )}
                              {f.type === 'longtext' && (
                                <TextArea
                                  style={{ height: '40px' }}
                                  value={v.length > 1 ? '***' : (v[0]?.toString() ?? '')}
                                  disabled={isExternal}
                                  onChange={(_, e) => changeCallback('data', schema.id, f.id, e)}
                                />
                              )}
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </Accordion.ItemContent>
                </Accordion.Item>
              );
            })}

            {customDataKeys.length > 0 && (
              <Accordion.Item value={'_custom'}>
                <Accordion.ItemHeader>Custom data</Accordion.ItemHeader>
                <Accordion.ItemContent>
                  <div className={'cmp-labeled-table'}>
                    {customDataKeys.map(k => {
                      const v = unique(
                        $d.selectionState.elements.map(e =>
                          e.metadata.data?.customData?.[k]?.toString()
                        )
                      );

                      return (
                        <React.Fragment key={k}>
                          <div className={'cmp-labeled-table__label util-a-top-center'}>{k}:</div>
                          <div className={'cmp-labeled-table__value'}>
                            <TextArea
                              value={v[0] ?? ''}
                              isIndeterminate={v.length > 1}
                              style={{ height: '40px' }}
                              onChange={(_, e) => changeCallback('custom', '', k, e)}
                            />
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </Accordion.ItemContent>
              </Accordion.Item>
            )}
          </Accordion.Root>
        </ToolWindowPanel>
      </ToolWindow.TabContent>
      <EditItemDialog
        open={editItemDialog.open}
        onClose={() => setEditItemDialog({ open: false })}
        dataProvider={$d.document.data.provider}
        selectedSchema={editItemDialog.schema}
        editItem={editItemDialog.item}
      />
      <EditSchemaDialog
        title={editSchemaDialog.schema ? 'Edit Schema' : 'New Schema'}
        open={editSchemaDialog.open}
        schema={editSchemaDialog.schema}
        onOk={schema => {
          saveSchema(schema);
          setEditSchemaDialog({ open: false });
        }}
        onCancel={() => setEditSchemaDialog({ open: false })}
        availableSchemas={$d.document.data.schemas.all}
      />
    </>
  );
};
