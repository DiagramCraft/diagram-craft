import React, { ChangeEvent, useCallback, useState } from 'react';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { TbDots, TbLink, TbLinkOff, TbPencil, TbTrash } from 'react-icons/tb';
import { JSONDialog } from '../../components/JSONDialog';
import {
  AddSchemaUndoableAction,
  DataSchema,
  DeleteSchemaUndoableAction,
  ModifySchemaUndoableAction
} from '@diagram-craft/model/diagramDataSchemas';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo, SnapshotUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { CompoundUndoableAction } from '@diagram-craft/model/undoManager';
import { newid } from '@diagram-craft/utils/id';
import { unique } from '@diagram-craft/utils/array';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { useElementMetadata } from '../../hooks/useProperty';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { Popover } from '@diagram-craft/app-components/Popover';
import { Button } from '@diagram-craft/app-components/Button';
import { useApplication, useDiagram, useDocument } from '../../../application';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { Dialog } from '@diagram-craft/app-components/Dialog';

const makeTemplate = (): DataSchema => {
  return {
    id: newid(),
    name: 'New schema',
    source: 'document',
    fields: [
      {
        id: 'field1',
        name: 'Field 1',
        type: 'text'
      },
      {
        id: 'field2',
        name: 'Field 2',
        type: 'longtext'
      }
    ]
  };
};

const ExternalLinkDialog = (props: {
  onSave: (s: string) => void;
  onCancel: () => void;
  schema: DataSchema;
}) => {
  const $d = useDocument();
  const [search, setSearch] = useState('');
  const [activeQuery, setActiveQuery] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<string | undefined>(undefined);

  const data =
    activeQuery !== undefined && activeQuery.trim() !== ''
      ? $d.dataProvider?.queryData(props.schema, activeQuery)
      : $d.dataProvider?.getData(props.schema);

  return (
    <Dialog
      buttons={[
        {
          type: 'default',
          onClick: () => (selected ? props.onSave(selected) : props.onCancel()),
          label: 'Ok'
        },
        {
          type: 'cancel',
          onClick: props.onCancel,
          label: 'Cancel'
        }
      ]}
      onClose={() => props.onCancel()}
      open={true}
      title={'Link data'}
    >
      <div className={'util-vstack'} style={{ gap: '1rem' }}>
        <div className={'util-hstack'}>
          <input
            className={'cmp-text-input'}
            type={'text'}
            value={search}
            onChange={ev => setSearch(ev.target.value)}
            onKeyDown={ev => {
              if (ev.key === 'Enter') {
                setActiveQuery(search);
              }
            }}
          />

          <Button onClick={() => setActiveQuery(search)}>Search</Button>
        </div>

        <div
          className={'util-vstack'}
          style={{
            background: 'var(--cmp-bg)',
            border: '1px solid var(--cmp-border)',
            borderRadius: 'var(--cmp-radius)',
            padding: '0.5rem 0.25rem',
            overflow: 'auto',
            maxHeight: '100%',
            scrollbarGutter: 'stable',
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--tertiary-fg) var(--primary-bg)'
          }}
        >
          {data?.map(item => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                gap: '0.25rem',
                alignItems: 'center'
              }}
            >
              <input
                type={'radio'}
                name={'dataItemId'}
                onClick={() => {
                  setSelected(item._uid);
                }}
              />
              <span style={{ paddingTop: '3px' }}>
                {item['name'] ?? item[props.schema.fields[0].id]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  );
};

export const ObjectDataToolWindow = () => {
  const $d = useDiagram();
  const redraw = useRedraw();
  const application = useApplication();

  const [externalLinkDialog, setExternalLinkDialog] = useState<DataSchema | undefined>(undefined);

  useEventListener($d.selectionState, 'change', redraw);
  useEventListener($d, 'change', redraw);

  const name = useElementMetadata($d, 'name', '');

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
      const uow = new UnitOfWork($d, true);
      $d.selectionState.elements.forEach(e => {
        e.updateMetadata(p => {
          p.data ??= { data: [] };
          const item = p.data.data!.find(d => d.type === 'external' && d.schema === schemaId);
          assert.present(item);
          item.external = undefined;
          item.type = 'schema';
        }, uow);
      });
      commitWithUndo(uow, 'Break external data link');
      redraw();
    },
    [$d]
  );

  const addSchemaToSelection = useCallback(
    (schema: string) => {
      $d.selectionState.elements.forEach(e => {
        const entry = e.metadata.data?.data?.find(s => s.schema === schema);
        if (!entry) {
          const uow = new UnitOfWork($d, true);
          e.updateMetadata(p => {
            p.data ??= {};
            p.data.data ??= [];
            p.data.data.push({ enabled: true, schema, type: 'schema', data: {} });
          }, uow);
          commitWithUndo(uow, 'Add schema to selection');
        } else if (!entry.enabled) {
          const uow = new UnitOfWork($d, true);
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
        const entry = e.metadata.data?.data?.find(s => s.schema === schema);
        if (entry?.enabled) {
          const uow = new UnitOfWork($d, true);
          e.updateMetadata(p => {
            p.data!.data!.find(s => s.schema === schema)!.enabled = false;
          }, uow);
          commitWithUndo(uow, 'Add schema to selection');
        }
      });
    },
    [$d]
  );

  const removeDataFromSelection = useCallback(
    (schema: string) => {
      $d.selectionState.elements.forEach(e => {
        const entry = e.metadata.data?.data?.find(s => s.schema === schema);
        if (entry?.enabled) {
          const uow = new UnitOfWork($d, true);
          e.updateMetadata(p => {
            p.data!.data ??= [];
            p.data!.data = p.data!.data!.filter(s => s.schema !== schema);
          }, uow);
          commitWithUndo(uow, 'Add schema to selection');
        }
      });
    },
    [$d]
  );

  const addExternalLinkage = useCallback(
    (schema: DataSchema) => {
      setExternalLinkDialog(schema);
    },
    [$d]
  );

  const saveSchema = useCallback((s: DataSchema) => {
    const schemas = $d.document.schemas;
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
  const schemas = $d.selectionState.elements.flatMap(e =>
    e.metadata.data?.data?.filter(d => d.enabled).map(d => d.schema)
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
        {$d.selectionState.elements.length === 1 && (
          <Accordion.Item value="basic">
            <Accordion.ItemHeader>Name</Accordion.ItemHeader>
            <Accordion.ItemContent>
              <div className={'cmp-labeled-table'}>
                <div className={'cmp-labeled-table__label util-a-top-center'}>Name:</div>
                <div className={'cmp-labeled-table__value cmp-text-input'}>
                  <input type={'text'} value={name.val} onChange={e => name.set(e.target.value)} />
                </div>
              </div>
            </Accordion.ItemContent>
          </Accordion.Item>
        )}
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
                      {$d.document.schemas.all.map(s => (
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
                                  application.ui.showDialog(
                                    JSONDialog.create(
                                      {
                                        title: 'Modify schema',
                                        label: 'Schema',
                                        data: s
                                      },
                                      saveSchema
                                    )
                                  );
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
                                        const schemas = $d.document.schemas;
                                        schemas.removeSchema(s, uow);

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
                          application.ui.showDialog(
                            JSONDialog.create(
                              {
                                title: 'New schema',
                                label: 'Schema',
                                data: makeTemplate()
                              },
                              saveSchema
                            )
                          );
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

                const schema = $d.document.schemas.get(schemaName!);

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
                        <a
                          className={'cmp-button cmp-button--icon-only'}
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
                              return e.metadata.data?.data?.find(d => d.schema === schemaName)
                                ?.data[f.id];
                            })
                          );

                          return (
                            <React.Fragment key={f.id}>
                              <div className={'cmp-labeled-table__label util-a-top-center'}>
                                {f.name}:
                              </div>
                              <div className={'cmp-labeled-table__value cmp-text-input'}>
                                {f.type === 'text' && (
                                  <input
                                    type={'text'}
                                    value={v.length > 1 ? '***' : (v[0]?.toString() ?? '')}
                                    disabled={isExternal}
                                    onChange={e => changeCallback('data', schemaName, f.id, e)}
                                  />
                                )}
                                {f.type === 'longtext' && (
                                  <textarea
                                    style={{ height: '40px' }}
                                    value={v.length > 1 ? '***' : (v[0]?.toString() ?? '')}
                                    disabled={isExternal}
                                    onChange={e => changeCallback('data', schemaName, f.id, e)}
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
                            <div className={'cmp-labeled-table__value cmp-text-input'}>
                              <textarea
                                style={{ height: '40px' }}
                                value={v.length > 1 ? '***' : (v[0] ?? '')}
                                onChange={e => changeCallback('custom', '', k, e)}
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
      {externalLinkDialog && (
        <ExternalLinkDialog
          schema={externalLinkDialog}
          onCancel={() => {
            setExternalLinkDialog(undefined);
          }}
          onSave={(id: string) => {
            const uow = new UnitOfWork($d, true);
            $d.selectionState.elements.forEach(e => {
              e.updateMetadata(p => {
                p.data ??= { data: [] };
                const item = p.data.data!.find(d => d.schema === externalLinkDialog.id);
                assert.present(item);
                item.external = {
                  uid: id
                };
                item.type = 'external';

                const [data] = $d.document.dataProvider!.getById([id]);
                for (const k of Object.keys(data)) {
                  if (k.startsWith('_')) continue;
                  item.data[k] = data[k];
                }
              }, uow);
            });
            commitWithUndo(uow, 'Break external data link');
            redraw();

            setExternalLinkDialog(undefined);
          }}
        />
      )}
    </>
  );
};
