import { Accordion } from '@diagram-craft/app-components/Accordion';
import { Application, useApplication, useDiagram, useDocument } from '../../../application';
import { Select } from '@diagram-craft/app-components/Select';
import { Data } from '@diagram-craft/model/dataProvider';
import { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';
import React, { useEffect, useRef, useState } from 'react';
import { useRedraw } from '../../hooks/useRedraw';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { newid } from '@diagram-craft/utils/id';
import {
  TbChevronDown,
  TbChevronRight,
  TbLayoutGrid,
  TbLayoutList,
  TbPencil,
  TbPlus,
  TbRefresh,
  TbSearch,
  TbSettings,
  TbTrash
} from 'react-icons/tb';
import { DRAG_DROP_MANAGER } from '@diagram-craft/canvas/dragDropManager';
import { ObjectPickerDrag } from './objectPickerDrag';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { assert } from '@diagram-craft/utils/assert';
import { Button } from '@diagram-craft/app-components/Button';
import { PickerCanvas } from '../../PickerCanvas';
import { DataTemplate } from '@diagram-craft/model/diagramDocument';
import { deserializeDiagramElements } from '@diagram-craft/model/serialization/deserialize';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { deepClone } from '@diagram-craft/utils/object';
import { Definitions } from '@diagram-craft/model/elementDefinitionRegistry';
import { ActionMenuItem } from '../../components/ActionMenuItem';
import { useEventListener } from '../../hooks/useEventListener';
import { createThumbnailDiagramForNode } from '@diagram-craft/canvas-app/diagramThumbnail';
import { isRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { EditItemDialog } from '../../components/EditItemDialog';
import { ToolWindow } from '../ToolWindow';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { ModelCenterDialogCommand } from '../../components/ModelCenterDialog/ModelCenterDialog';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import type { ElementDataEntry } from '@diagram-craft/model/diagramProps';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';
import type { Diagram } from '@diagram-craft/model/diagram';
import { ContextMenu } from '@diagram-craft/app-components/ContextMenu';
import { Menu } from '@diagram-craft/app-components/Menu';

const NODE_CACHE = new Map<string, DiagramNode>();
const PICKER_CANVAS_SIZE = 42;

const useSchemaAndData = (selectedSchema: string, search: string) => {
  const diagram = useDiagram();
  const db = diagram.document.data.db;

  const [, setDataVersion] = useState<number>(0);

  // Redraw on any data changes
  useEffect(() => {
    const handleDataChange = () => setDataVersion(prev => prev + 1);

    db.on('addData', handleDataChange);
    db.on('updateData', handleDataChange);
    db.on('deleteData', handleDataChange);

    return () => {
      db.off('addData', handleDataChange);
      db.off('updateData', handleDataChange);
      db.off('deleteData', handleDataChange);
    };
  }, [db]);

  const schema = db.schemas.find(s => s.id === selectedSchema) ?? db.schemas[0];
  const data = schema ? (search.trim() ? db.queryData(schema, search) : db.getData(schema)) : [];

  return { schema, data, document: diagram.document, diagram, db };
};

const ItemContextMenu = (props: {
  item: Data;
  onEditItem: (item: Data) => void;
  onDeleteItem: (item: Data) => void;
}) => (
  <ContextMenu.Menu>
    <Menu.Item onClick={() => props.onEditItem(props.item)}>Edit Item</Menu.Item>
    <Menu.Item onClick={() => props.onDeleteItem(props.item)}>Delete Item</Menu.Item>
  </ContextMenu.Menu>
);

const handleDragStart = (
  ev: React.MouseEvent,
  node: DiagramNode,
  diagram: Diagram,
  app: Application,
  isRegularLayer: boolean
) => {
  if (!isRegularLayer) return;
  if (ev.button !== 0) return;

  DRAG_DROP_MANAGER.initiate(new ObjectPickerDrag(ev.nativeEvent, node, diagram, undefined, app));

  ev.preventDefault();
  ev.stopPropagation();
};

const makeDataReference = (item: Data, schema: DataSchema): ElementDataEntry => {
  return {
    type: 'external',
    external: {
      uid: item._uid
    },
    data: item,
    schema: schema.id,
    enabled: true
  };
};

const makeTemplateNode = (
  item: Data,
  schema: DataSchema,
  definitions: Definitions,
  template: DataTemplate
) => {
  const cacheKey = `${item._uid}/${template.id}`;

  if (NODE_CACHE.has(cacheKey)) {
    return NODE_CACHE.get(cacheKey)!;
  }

  const tpl = deepClone(template.template);
  const { node, diagram } = createThumbnailDiagramForNode(
    (diagram, layer) => deserializeDiagramElements([tpl], diagram, layer)[0] as DiagramNode,
    definitions
  );
  node.setBounds({ ...node.bounds, x: 0, y: 0 }, UnitOfWork.immediate(node.diagram));

  node.updateMetadata(cb => {
    cb.data ??= {};
    cb.data.data ??= [];

    cb.data.data = cb.data.data.filter(e => e.schema !== schema.id);

    cb.data.data.push(makeDataReference(item, schema));

    cb.data.templateId = template.id;
  }, UnitOfWork.immediate(node.diagram));

  diagram.viewBox.dimensions = { w: node.bounds.w + 10, h: node.bounds.h + 10 };
  diagram.viewBox.offset = { x: -5, y: -5 };

  NODE_CACHE.set(cacheKey, node);

  return node;
};

const makeDefaultNode = (item: Data, schema: DataSchema, definitions: Definitions): DiagramNode => {
  return createThumbnailDiagramForNode(
    (_diagram, layer) =>
      ElementFactory.node(
        newid(),
        'rect',
        { w: 100, h: 100, y: 0, x: 0, r: 0 },
        layer,
        {},
        {
          data: {
            data: [makeDataReference(item, schema)]
          }
        },
        {
          text: `%${schema.fields[0]!.id}%`
        }
      ),
    definitions
  ).node;
};

const TemplateGridItem = (props: {
  item: Data;
  schema: DataSchema;
  node: DiagramNode;
  onEditItem: (item: Data) => void;
  onDeleteItem: (item: Data) => void;
}) => {
  const app = useApplication();
  const diagram = useDiagram();
  const { item, schema, node } = props;

  return (
    <div
      key={item._uid}
      style={{ background: 'transparent' }}
      data-width={node.diagram.viewBox.dimensions.w}
    >
      <ContextMenu.Root>
        <ContextMenu.Trigger
          element={
            <div
              onMouseDown={ev =>
                handleDragStart(ev, node, diagram, app, isRegularLayer(diagram.activeLayer))
              }
              className={'light-theme'}
            >
              <PickerCanvas
                width={PICKER_CANVAS_SIZE}
                height={PICKER_CANVAS_SIZE}
                diagramWidth={node.diagram.viewBox.dimensions.w}
                diagramHeight={node.diagram.viewBox.dimensions.h}
                diagram={node.diagram}
                showHover={true}
                name={item[schema.fields[0]!.id] as string}
                onMouseDown={() => {}}
              />
            </div>
          }
        />
        <ItemContextMenu
          item={item}
          onEditItem={props.onEditItem}
          onDeleteItem={props.onDeleteItem}
        />
      </ContextMenu.Root>
    </div>
  );
};

type DataViewProps = {
  selectedSchema: string;
  search: string;
  onEditItem: (item: Data) => void;
  onDeleteItem: (item: Data) => void;
};

const DataProviderGridView = (props: DataViewProps) => {
  const app = useApplication();
  const { schema, data, document } = useSchemaAndData(props.selectedSchema, props.search);

  if (!schema) return <div>Loading...</div>;

  const dataTemplates = document.data.templates.bySchema(schema.id);

  const handleDeleteTemplate = (template: DataTemplate) => {
    app.ui.showDialog(
      new MessageDialogCommand(
        {
          title: 'Delete Template',
          message: `Are you sure you want to delete the template "${template.name}"?`,
          okLabel: 'Delete',
          okType: 'danger',
          cancelLabel: 'Cancel'
        },
        () => {
          app.actions['EXTERNAL_DATA_LINK_REMOVE_TEMPLATE']?.execute({
            templateId: template.id
          });
        }
      )
    );
  };

  return dataTemplates.map(t => (
    <ToolWindowPanel
      id={t.id}
      key={t.id}
      title={t.name}
      mode={'accordion'}
      value={true}
      headerButtons={
        <div style={{ gap: '0.5rem', display: 'flex' }}>
          <a
            className={'cmp-button--icon-only'}
            onClick={() => {
              app.actions['EXTERNAL_DATA_LINK_RENAME_TEMPLATE']?.execute({
                templateId: t.id
              });
            }}
          >
            <TbPencil />
          </a>
          <a className={'cmp-button--icon-only'} onClick={() => handleDeleteTemplate(t)}>
            <TbTrash />
          </a>
        </div>
      }
    >
      <div className={'cmp-object-picker'}>
        {data.map(item => (
          <TemplateGridItem
            key={item._uid}
            item={item}
            schema={schema}
            node={makeTemplateNode(item, schema, document.definitions, t)}
            onEditItem={props.onEditItem}
            onDeleteItem={props.onDeleteItem}
          />
        ))}
      </div>
    </ToolWindowPanel>
  ));
};

const DataProviderListView = (props: DataViewProps) => {
  const app = useApplication();
  const { schema, data, document, diagram } = useSchemaAndData(props.selectedSchema, props.search);
  const [expanded, setExpanded] = useState<string[]>([]);

  if (!schema) return <div>Loading...</div>;

  const isRuleLayer = diagram.activeLayer.type === 'rule';
  const dataTemplates = document.data.templates.bySchema(schema.id);

  return (
    <ToolWindowPanel id={'response'} title={'Data'} mode={'accordion'}>
      <div className={'cmp-query-response'}>
        {data.map(item => {
          return (
            <ContextMenu.Root key={item._uid}>
              <ContextMenu.Trigger
                element={
                  <div
                    className={`util-draggable cmp-query-response__item ${expanded.includes(item._uid) ? 'cmp-query-response__item--expanded' : ''}`}
                    style={{ cursor: isRuleLayer ? 'default' : 'pointer' }}
                  >
                    <div
                      style={{ cursor: 'default' }}
                      onClick={() => {
                        if (expanded.includes(item._uid)) {
                          setExpanded(expanded.filter(e => e !== item._uid));
                        } else {
                          setExpanded([...expanded, item._uid]);
                        }
                      }}
                    >
                      {expanded.includes(item._uid) ? <TbChevronDown /> : <TbChevronRight />}
                    </div>

                    <div
                      style={{ color: isRuleLayer ? 'var(--base-fg-more-dim)' : 'default' }}
                      onMouseDown={ev => {
                        const node =
                          dataTemplates.length > 0
                            ? makeTemplateNode(
                                item,
                                schema,
                                document.definitions,
                                dataTemplates[0]!
                              )
                            : makeDefaultNode(item, schema, document.definitions);
                        handleDragStart(
                          ev,
                          node,
                          diagram,
                          app,
                          isRegularLayer(diagram.activeLayer)
                        );
                      }}
                    >
                      {item[schema.fields[0]!.id]}

                      {expanded.includes(item._uid) && (
                        <>
                          <div>
                            {schema.fields
                              .filter(f => f.type !== 'reference')
                              .map(k => (
                                <div key={k.id}>
                                  {k.name}: {item[k.id] ?? '-'}
                                </div>
                              ))}
                          </div>

                          {dataTemplates.length > 0 && (
                            <div
                              className={'cmp-object-picker'}
                              style={{
                                border: '1px solid var(--cmp-border)',
                                borderRadius: 'var(--cmp-radius)',
                                background: 'var(--cmp-bg)',
                                padding: '0.25rem',
                                margin: '0.25rem 0.5rem 0 0'
                              }}
                            >
                              {dataTemplates
                                .map(
                                  t =>
                                    [
                                      t,
                                      makeTemplateNode(item, schema, document.definitions, t)
                                    ] as [DataTemplate, DiagramNode]
                                )
                                .map(([t, n]) => (
                                  <div
                                    key={n.id}
                                    style={{ background: 'transparent' }}
                                    data-width={n.diagram.viewBox.dimensions.w}
                                  >
                                    <ContextMenu.Root>
                                      <ContextMenu.Trigger
                                        element={
                                          <div
                                            onMouseDown={ev =>
                                              handleDragStart(
                                                ev,
                                                n,
                                                diagram,
                                                app,
                                                isRegularLayer(diagram.activeLayer)
                                              )
                                            }
                                            className={'light-theme'}
                                          >
                                            <PickerCanvas
                                              width={PICKER_CANVAS_SIZE}
                                              height={PICKER_CANVAS_SIZE}
                                              diagramWidth={n.diagram.viewBox.dimensions.w}
                                              diagramHeight={n.diagram.viewBox.dimensions.h}
                                              diagram={n.diagram}
                                              showHover={true}
                                              name={t.name}
                                              onMouseDown={() => {}}
                                            />
                                          </div>
                                        }
                                      />
                                      <ContextMenu.Menu>
                                        <ActionMenuItem
                                          action={'EXTERNAL_DATA_LINK_RENAME_TEMPLATE'}
                                          arg={{ templateId: t.id }}
                                        >
                                          Rename...
                                        </ActionMenuItem>
                                        <ActionMenuItem
                                          action={'EXTERNAL_DATA_LINK_REMOVE_TEMPLATE'}
                                          arg={{ templateId: t.id }}
                                        >
                                          Remove
                                        </ActionMenuItem>
                                      </ContextMenu.Menu>
                                    </ContextMenu.Root>
                                  </div>
                                ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                }
              />
              <ItemContextMenu
                item={item}
                onEditItem={props.onEditItem}
                onDeleteItem={props.onDeleteItem}
              />
            </ContextMenu.Root>
          );
        })}
      </div>
    </ToolWindowPanel>
  );
};

const DataProviderQueryView = (props: {
  selectedSchema: string;
  onChangeSchema: (s: string | undefined) => void;
  onSearch: (s: string) => void;
  displayMode: 'list' | 'grid';
  onChangeDisplayMode: (mode: 'list' | 'grid') => void;
  showItemAddDialog: () => void;
}) => {
  const document = useDocument();
  const db = document.data.db;
  const ref = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState<string>('');

  return (
    <div style={{ width: '100%' }} className={'util-vstack'}>
      <div className={'util-hstack'}>
        <div style={{ flexGrow: 1, display: 'flex' }}>
          <Select.Root value={props.selectedSchema} onChange={props.onChangeSchema}>
            {db.schemas.map(schema => (
              <Select.Item key={schema.id} value={schema.id}>
                {schema.name}
              </Select.Item>
            ))}
          </Select.Root>
        </div>

        <Button
          type={'secondary'}
          onClick={() => props.showItemAddDialog()}
          disabled={!('addData' in db)}
        >
          <TbPlus />
        </Button>
      </div>
      <div className={'util-hstack'}>
        <TextInput
          ref={ref}
          value={search}
          style={{ flexGrow: 1 }}
          onChange={v => setSearch(v ?? '')}
          onKeyDown={ev => {
            if (ev.key === 'Enter') {
              props.onSearch(search);
            } else if (ev.key === 'Escape') {
              ev.preventDefault();
              ev.stopPropagation();
              setSearch('');
              props.onSearch('');
              // Force the TextInput's internal state to clear
              setTimeout(() => {
                if (ref.current) {
                  ref.current.value = '';
                }
              }, 0);
            }
          }}
          onClear={() => {
            setSearch('');
            props.onSearch('');
          }}
        />

        <Button
          onClick={() => {
            props.onSearch(search);
            ref.current?.blur();
          }}
          type={'secondary'}
        >
          <TbSearch />
        </Button>

        <div style={{ marginLeft: '0.5rem' }}>
          <ToggleButtonGroup.Root
            onChange={e => props.onChangeDisplayMode(e as 'list' | 'grid')}
            value={props.displayMode}
            type={'single'}
          >
            <ToggleButtonGroup.Item value={'list'}>
              <TbLayoutList />
            </ToggleButtonGroup.Item>
            <ToggleButtonGroup.Item value={'grid'}>
              <TbLayoutGrid />
            </ToggleButtonGroup.Item>
          </ToggleButtonGroup.Root>
        </div>
      </div>
    </div>
  );
};

export const ModelPickerTab = () => {
  const redraw = useRedraw();
  const $diagram = useDiagram();
  const application = useApplication();
  const [addItemDialog, setAddItemDialog] = useState<boolean>(false);
  const [editItemDialog, setEditItemDialog] = useState<{ open: boolean; item?: Data }>({
    open: false
  });
  const document = $diagram.document;
  const [search, setSearch] = useState<string>('');
  const [displayMode, setDisplayMode] = useState<'list' | 'grid'>('list');

  const db = document.data.db;

  useEffect(() => {
    const rd = () => redraw();

    db.on('addData', rd);
    db.on('updateData', rd);
    db.on('deleteData', rd);
    return () => {
      db.off('addData', rd);
      db.off('updateData', rd);
      db.off('deleteData', rd);
    };
  }, [db, redraw]);

  const clearTemplateCache = (templateId: string) => {
    for (const key of NODE_CACHE.keys()) {
      if (key.endsWith(`/${templateId}`)) {
        NODE_CACHE.delete(key);
      }
    }
  };

  useEventListener(document.data.templates, 'add', redraw);
  useEventListener(document.data.templates, 'update', e => {
    clearTemplateCache(e.template.id);
    redraw();
  });
  useEventListener(document.data.templates, 'remove', e => {
    clearTemplateCache(e.template.id);
    redraw();
  });

  const [selectedSchema, setSelectedSchema] = useState<string | undefined>(db.schemas[0]!.id);

  if (db.schemas.length > 0 && db.schemas.find(s => s.id === selectedSchema) === undefined) {
    setSelectedSchema(db.schemas[0]!.id);
  }

  // Handle delete confirmation
  const handleDeleteItem = (item: Data) => {
    if (!('deleteData' in db)) return;

    const schema = db.schemas.find(s => s.id === selectedSchema) ?? db.schemas[0];
    if (!schema) return;

    const itemName = item[schema.fields[0]?.id ?? ''] ?? 'this item';

    application.ui.showDialog(
      new MessageDialogCommand(
        {
          title: 'Delete Item',
          message: `Are you sure you want to delete "${itemName}"?`,
          okLabel: 'Delete',
          okType: 'danger',
          cancelLabel: 'Cancel'
        },
        async () => {
          try {
            await db.deleteData(schema, item);
          } catch (error) {
            console.error('Failed to delete item:', error);
          }
        }
      )
    );
  };

  return (
    <>
      <ToolWindow.TabActions>
        <a
          className={'cmp-button cmp-button--icon-only'}
          aria-disabled={!('refreshData' in db) && !('refreshSchemas' in db)}
          onClick={async () => {
            assert.present(db);

            if ('refreshData' in db) {
              await db.refreshData();
            }
            if ('refreshSchemas' in db) {
              await db.refreshSchemas();
            }
          }}
        >
          <TbRefresh />
        </a>
        <a
          className={'cmp-button cmp-button--icon-only'}
          onClick={() => {
            application.ui.showDialog(
              new ModelCenterDialogCommand(
                { defaultTab: 'model-providers' },
                () => {},
                () => {}
              )
            );
          }}
        >
          <TbSettings />
        </a>
      </ToolWindow.TabActions>
      <ToolWindow.TabContent>
        <Accordion.Root type="multiple" defaultValue={['query', 'response']}>
          <ToolWindowPanel id={'query'} title={'Data Source'} mode={'headless'}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <DataProviderQueryView
                onSearch={setSearch}
                selectedSchema={selectedSchema!}
                onChangeSchema={setSelectedSchema}
                displayMode={displayMode}
                onChangeDisplayMode={setDisplayMode}
                showItemAddDialog={() => setAddItemDialog(true)}
              />
            </div>
          </ToolWindowPanel>

          {displayMode === 'list' && (
            <DataProviderListView
              selectedSchema={selectedSchema!}
              search={search}
              onEditItem={item => setEditItemDialog({ open: true, item })}
              onDeleteItem={handleDeleteItem}
            />
          )}

          {displayMode === 'grid' && (
            <DataProviderGridView
              selectedSchema={selectedSchema!}
              search={search}
              onEditItem={item => setEditItemDialog({ open: true, item })}
              onDeleteItem={handleDeleteItem}
            />
          )}
        </Accordion.Root>

        <EditItemDialog
          open={addItemDialog}
          onClose={() => setAddItemDialog(false)}
          selectedSchema={selectedSchema}
        />
        <EditItemDialog
          open={editItemDialog.open}
          onClose={() => setEditItemDialog({ open: false })}
          selectedSchema={selectedSchema}
          editItem={editItemDialog.item}
        />
      </ToolWindow.TabContent>
    </>
  );
};
