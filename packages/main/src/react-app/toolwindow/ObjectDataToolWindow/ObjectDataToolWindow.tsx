import React, { ChangeEvent, useCallback, useState } from 'react';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { TbDots, TbLink, TbLinkOff, TbPencil, TbTrash } from 'react-icons/tb';
import { EditSchemaDialog } from '../../components/EditSchemaDialog';
import {
  AddSchemaUndoableAction,
  DataSchema,
  DeleteSchemaUndoableAction,
  ModifySchemaUndoableAction
} from '@diagram-craft/model/diagramDocumentDataSchemas';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo, SnapshotUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { CompoundUndoableAction } from '@diagram-craft/model/undoManager';
import { unique } from '@diagram-craft/utils/array';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { Popover } from '@diagram-craft/app-components/Popover';
import { Button } from '@diagram-craft/app-components/Button';
import { useApplication, useDiagram } from '../../../application';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { ObjectNamePanel } from './ObjectNamePanel';
import type { Data } from '@diagram-craft/model/dataProvider';
import type { DiagramElement } from '@diagram-craft/model/diagramElement';
import { EditItemDialog } from '../../components/EditItemDialog';

const findEntryBySchema = (e: DiagramElement, schema: string) => {
  return e.metadata.data?.data?.find(s => s.schema === schema);
};

export const ObjectDataToolWindow = () => {
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

  const removeDataFromSelection = useCallback(
    (schema: string) => {
      $d.selectionState.elements.forEach(e => {
        const entry = findEntryBySchema(e, schema);
        if (entry?.enabled) {
          const uow = new UnitOfWork($d, true);
          e.updateMetadata(p => {
            p.data!.data!.find(s => s.schema === schema)!.enabled = false;
          }, uow);
          commitWithUndo(uow, 'Remove data from selection');
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
    if (isNew) {
      $d.undoManager.addAndExecute(new AddSchemaUndoableAction($d, s));
    } else {
      $d.undoManager.addAndExecute(new ModifySchemaUndoableAction($d, s));
    }
    redraw();
  }, []);

  const customDataKeys = unique(
    $d.selectionState.elements.flatMap(e => Object.keys(e.metadata.data?.customData ?? {}))
  ).toSorted();

  // Get all schemas from all selected elements
  const schemas = unique(
    $d.selectionState.elements.flatMap(e =>
      e.metadata.data?.data?.filter(d => d.enabled).map(d => d.schema)
    )
  );

  if ($d.selectionState.elements.length === 0)
    return (
      <Accordion.Root type="single" defaultValue={'data'}>
        <Accordion.Item value="data">
          <Accordion.ItemHeader>Data</Accordion.ItemHeader>
          <Accordion.ItemContent>&nbsp;</Accordion.ItemContent>
        </Accordion.Item>
      </Accordion.Root>
    );

  return (
    <>
      <Accordion.Root type="multiple" defaultValue={['data', 'basic']}>
        {$d.selectionState.elements.length === 1 && <ObjectNamePanel mode="accordion" />}
        <Accordion.Item value="data">
          <Accordion.ItemHeader>
            Data
            <Accordion.ItemHeaderButtons>
              <Popover.Root>
                <Popover.Trigger>
                  <a href={'#'}>
                    <TbDots />
                  </a>
                </Popover.Trigger>
                <Popover.Content sideOffset={15}>
                  <div className={'cmp-schema-selector'}>
                    <h2
                      className={'util-hstack'}
                      style={{ gap: '0.5rem', marginBottom: '0.75rem' }}
                    >
                      Schemas
                    </h2>
                    <div className={'cmp-schema-selector__schemas'}>
                      {$d.document.data.schemas.all.map(s => (
                        <div key={s.id} className={'cmp-schema-selector__schema'}>
                          <Checkbox
                            value={schemas.includes(s.id)}
                            onChange={v => {
                              if (v) {
                                addSchemaToSelection(s.id);
                              } else {
                                removeSchemaFromSelection(s.id);
                              }
                            }}
                          />
                          {s.name}

                          {s.source !== 'external' && (
                            <div className={'cmp-schema-selector__schema-actions'}>
                              <button
                                onClick={() => {
                                  setEditSchemaDialog({ open: true, schema: s });
                                }}
                              >
                                <TbPencil />
                              </button>
                              <button
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
                                        schemas.removeAndClearUsage(s, uow);

                                        const snapshots = uow.commit();
                                        $d.undoManager.add(
                                          new CompoundUndoableAction([
                                            new DeleteSchemaUndoableAction(uow.diagram, s),
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
                                <TbTrash />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className={'cmp-schema-selector__buttons'}>
                      <Button
                        type={'secondary'}
                        onClick={() => {
                          setEditSchemaDialog({ open: true, schema: undefined });
                        }}
                      >
                        Add Schema
                      </Button>
                    </div>
                  </div>
                </Popover.Content>
              </Popover.Root>
            </Accordion.ItemHeaderButtons>
          </Accordion.ItemHeader>
          <Accordion.ItemContent>
            <Accordion.Root
              type={'multiple'}
              defaultValue={['_custom', ...schemas.map(s => s ?? '')]}
            >
              {schemas.map(schemaName => {
                if (schemaName === undefined) return undefined;

                const schema = $d.document.data.schemas.get(schemaName!);

                const isExternal = $d.selectionState.elements.some(e => {
                  return (
                    e.metadata.data?.data?.find(d => d.schema === schemaName)?.type === 'external'
                  );
                });
                const isExternalSchema = schema.source === 'external';

                return (
                  <Accordion.Item key={schema.id} value={schema.id}>
                    <Accordion.ItemHeader>
                      {schema.name} {isExternal ? '(external)' : ''}
                      <Accordion.ItemHeaderButtons>
                        {isExternal && (
                          <a
                            className={'cmp-button cmp-button--icon-only'}
                            onClick={() => editExternalData(schema.id)}
                          >
                            <TbPencil />
                          </a>
                        )}
                        <a
                          className={'cmp-button cmp-button--icon-only'}
                          style={{ marginLeft: isExternal ? '0.5rem' : '0' }}
                          onClick={() => removeDataFromSelection(schema.id)}
                        >
                          <TbTrash />
                        </a>
                        {isExternal && (
                          <a
                            className={'cmp-button cmp-button--icon-only'}
                            style={{ marginLeft: '0.5rem' }}
                            onClick={() => clearExternalLinkage(schema.id)}
                          >
                            <TbLinkOff />
                          </a>
                        )}
                        {!isExternal && isExternalSchema && (
                          <a
                            className={'cmp-button cmp-button--icon-only'}
                            style={{ marginLeft: '0.5rem' }}
                            onClick={() => addExternalLinkage(schema)}
                          >
                            <TbLink />
                          </a>
                        )}
                      </Accordion.ItemHeaderButtons>
                    </Accordion.ItemHeader>
                    <Accordion.ItemContent>
                      <div className={'cmp-labeled-table'}>
                        {schema.fields.map(f => {
                          const v = unique(
                            $d.selectionState.elements.map(e => {
                              return findEntryBySchema(e, schemaName)?.data?.[f.id];
                            })
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
                                    onChange={(_, e) => changeCallback('data', schemaName, f.id, e)}
                                  />
                                )}
                                {f.type === 'longtext' && (
                                  <TextArea
                                    style={{ height: '40px' }}
                                    value={v.length > 1 ? '***' : (v[0]?.toString() ?? '')}
                                    disabled={isExternal}
                                    onChange={(_, e) => changeCallback('data', schemaName, f.id, e)}
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
                          $d.selectionState.elements.map(e => {
                            return e.metadata.data?.customData?.[k]?.toString();
                          })
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
          </Accordion.ItemContent>
        </Accordion.Item>
      </Accordion.Root>
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
      />
    </>
  );
};
