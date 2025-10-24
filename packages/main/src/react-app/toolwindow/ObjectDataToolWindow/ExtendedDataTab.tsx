import { Accordion } from '@diagram-craft/app-components/Accordion';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { useApplication, useDiagram } from '../../../application';
import { useRedraw } from '../../hooks/useRedraw';
import React, { ChangeEvent, useCallback, useState } from 'react';
import type { Data } from '@diagram-craft/model/dataProvider';
import { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { useEventListener } from '../../hooks/useEventListener';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { assert, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { unique } from '@diagram-craft/utils/array';
import { TbFilter, TbFilterOff, TbLink, TbLinkOff, TbPencil } from 'react-icons/tb';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { EditItemDialog } from '../../components/EditItemDialog';
import { ToolWindow } from '../ToolWindow';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { findEntryBySchema, hasDataForSchema } from '@diagram-craft/canvas-app/externalDataHelpers';

export const ExtendedDataTab = () => {
  const $d = useDiagram();
  const redraw = useRedraw();
  const application = useApplication();
  const [editItemDialog, setEditItemDialog] = useState<{
    open: boolean;
    item?: Data;
    schema?: string;
  }>({ open: false });

  const [editMode, setEditMode] = useState(true);

  useEventListener($d.selection, 'change', redraw);
  useEventListener($d, 'diagramChange', redraw);
  useEventListener($d, 'elementBatchChange', redraw);

  const changeCallback = useCallback(
    (
      type: 'data' | 'custom',
      schema: string,
      id: string,
      ev: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      const uow = new UnitOfWork($d, true);

      switch (type) {
        case 'data':
          $d.selection.elements.forEach(e => {
            e.updateMetadata(p => {
              p.data ??= {};
              p.data.data ??= [];
              let s = p.data.data.find(e => e.schema === schema);
              if (!s) {
                s = { schema, type: 'schema', data: {}, enabled: true };
                p.data.data.push(s);
              } else if (!s.enabled) {
                s.enabled = true;
              }
              s.data ??= {};
              s.data[id] = (ev.target as HTMLInputElement).value;
            }, uow);
          });
          break;
        case 'custom':
          $d.selection.elements.forEach(e => {
            e.updateMetadata(p => {
              p.data ??= {};
              p.data.customData ??= {};
              p.data.customData[id] = (ev.target as HTMLInputElement).value;
            }, uow);
          });
          break;
        default:
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
    [application, redraw]
  );

  const addSchemaToSelection = useCallback(
    (schema: string) => {
      $d.selection.elements.forEach(e => {
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
      $d.selection.elements.forEach(e => {
        const entry = findEntryBySchema(e, schema);
        if (entry) {
          const uow = new UnitOfWork($d, true);
          e.updateMetadata(p => {
            p.data ??= {};
            p.data.data ??= [];
            p.data.data = p.data.data.filter(s => s.schema !== schema);
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
    [application]
  );

  const editExternalData = useCallback(
    (schema: string) => {
      const db = $d.document.data.db;
      assert.present(db);

      // Get the external data item for editing
      const e = $d.selection.elements[0]!;
      const externalData = findEntryBySchema(e, schema);
      assert.true(externalData?.type === 'external');

      if (externalData?.enabled) {
        const items = db.getById(db.getSchema(externalData.schema), [externalData.external!.uid]);
        assert.arrayWithExactlyOneElement(items);

        setEditItemDialog({
          open: true,
          item: items[0],
          schema: schema
        });
      }
    },
    [$d]
  );

  const customDataKeys = unique(
    $d.selection.elements.flatMap(e => Object.keys(e.metadata.data?.customData ?? {}))
  ).toSorted();

  // Get all schemas that are enabled from all selected elements
  const enabledSchemas = unique(
    $d.selection.elements.flatMap(e =>
      e.metadata.data?.data?.filter(d => d.enabled).map(d => d.schema)
    )
  ).filter((schema): schema is string => schema !== undefined);

  if ($d.selection.elements.length !== 1) return null;

  return (
    <>
      <ToolWindow.TabContent>
        <ToolWindow.TabActions>
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
            {$d.document.data.db.schemas
              .filter(schema => {
                const isSchemaEnabled = enabledSchemas.includes(schema.id);
                const metadata = $d.document.data.getSchemaMetadata(schema.id);
                const isAvailableForLocalData = metadata.availableForElementLocalData ?? false;
                return isSchemaEnabled || isAvailableForLocalData;
              })
              .map(schema => {
                const isSchemaEnabled = enabledSchemas.includes(schema.id);
                const isExternal = $d.selection.elements.some(
                  e => e.metadata.data?.data?.find(d => d.schema === schema.id)?.type === 'external'
                );
                const isExternalSchema = schema.providerId !== 'document';

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
                              const accordionContent = accordionItem.querySelector(
                                '.cmp-accordion__content'
                              ) as HTMLElement;
                              const accordionHeader = accordionItem.querySelector(
                                '.cmp-accordion__header'
                              ) as HTMLElement;

                              if (isChecked) {
                                accordionItem.dataset.state = 'open';
                                accordionContent.dataset.state = 'open';
                                accordionHeader.dataset.state = 'open';
                                addSchemaToSelection(schema.id);
                              } else {
                                // Check if any element has data for this schema
                                const hasData = $d.selection.elements.some(el =>
                                  hasDataForSchema(el, schema.id)
                                );

                                if (hasData) {
                                  // Show confirmation dialog
                                  application.ui.showDialog(
                                    new MessageDialogCommand(
                                      {
                                        title: 'Disable schema',
                                        message: `This will remove all data for "${schema.name}" from the selected element(s). Are you sure?`,
                                        okLabel: 'Remove',
                                        okType: 'danger',
                                        cancelLabel: 'Cancel'
                                      },
                                      () => {
                                        accordionItem.dataset.state = 'closed';
                                        accordionContent.dataset.state = 'closed';
                                        accordionHeader.dataset.state = 'closed';
                                        removeSchemaFromSelection(schema.id);
                                        redraw();
                                      },
                                      () => {
                                        // On cancel, reset the checkbox
                                        e.target.checked = true;
                                        redraw();
                                      }
                                    )
                                  );
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

                        <span>{schema.name}</span>
                      </div>
                      <Accordion.ItemHeaderButtons>
                        {isExternal && (
                          <a
                            className={'cmp-button cmp-button--icon-only'}
                            style={{ marginRight: '0.5rem' }}
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
                      </Accordion.ItemHeaderButtons>
                    </Accordion.ItemHeader>
                    <Accordion.ItemContent forceMount={true}>
                      <div className={'cmp-labeled-table'}>
                        {schema.fields.map(f => {
                          const v = unique(
                            $d.selection.elements.map(e => {
                              const d = findEntryBySchema(e, schema.id);
                              try {
                                return d?.data?.[f.id] ?? '';
                              } catch (_e) {
                                return '';
                              }
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
                        $d.selection.elements.map(
                          e => e.metadata.data?.customData?.[k]?.toString() ?? ''
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
        onClose={() => setEditItemDialog(prev => ({ ...prev, open: false }))}
        selectedSchema={editItemDialog.schema}
        editItem={editItemDialog.item}
      />
    </>
  );
};
