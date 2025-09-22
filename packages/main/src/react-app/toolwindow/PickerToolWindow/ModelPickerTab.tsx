import { Accordion } from '@diagram-craft/app-components/Accordion';
import { useApplication, useDiagram, useDocument } from '../../../application';
import { Select } from '@diagram-craft/app-components/Select';
import { Data } from '@diagram-craft/model/dataProvider';
import { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { useEffect, useRef, useState } from 'react';
import { useRedraw } from '../../hooks/useRedraw';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { newid } from '@diagram-craft/utils/id';
import {
  TbChevronDown,
  TbChevronRight,
  TbPlus,
  TbRefresh,
  TbSearch,
  TbSettings
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
import * as ContextMenu from '@radix-ui/react-context-menu';
import { ActionContextMenuItem } from '../../components/ActionContextMenuItem';
import { useEventListener } from '../../hooks/useEventListener';
import { createThumbnailDiagramForNode } from '@diagram-craft/model/diagramThumbnail';
import { isRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { MessageDialogCommand } from '@diagram-craft/canvas/context';
import { EditItemDialog } from '../../components/EditItemDialog';
import { ToolWindow } from '../ToolWindow';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { ModelCenterDialogCommand } from '../../components/ModelCenterDialog/ModelCenterDialog';

const NODE_CACHE = new Map<string, DiagramNode>();

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
  const cacheKey = item._uid + '/' + template.id;

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
  }, UnitOfWork.immediate(node.diagram));

  diagram.viewBox.dimensions = { w: node.bounds.w + 10, h: node.bounds.h + 10 };
  diagram.viewBox.offset = { x: -5, y: -5 };

  NODE_CACHE.set(cacheKey, node);

  return node;
};

const makeDefaultNode = (item: Data, schema: DataSchema, definitions: Definitions): DiagramNode => {
  return createThumbnailDiagramForNode(
    (_diagram, layer) =>
      DiagramNode.create(
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
          text: `%${schema.fields[0].id}%`
        }
      ),
    definitions
  ).node;
};

const DataProviderResponse = (props: {
  selectedSchema: string;
  search: string;
  onEditItem: (item: Data) => void;
  onDeleteItem: (item: Data) => void;
}) => {
  const app = useApplication();
  const diagram = useDiagram();
  const document = diagram.document;
  const db = document.data.db;
  const [expanded, setExpanded] = useState<string[]>([]);
  const [, setDataVersion] = useState<number>(0);

  useEffect(() => {
    if (!db) return;

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

  const schema = db?.schemas?.find(s => s.id === props.selectedSchema) ?? db?.schemas?.[0];
  if (!schema) return <div>Loading...</div>;

  const data = props.search.trim() !== '' ? db.queryData(schema, props.search) : db.getData(schema);
  const isRuleLayer = diagram.activeLayer.type === 'rule';

  return (
    <div className={'cmp-query-response'}>
      {data?.map(item => {
        const dataTemplates = document.data.templates.bySchema(schema.id);
        return (
          <ContextMenu.Root key={item._uid}>
            <ContextMenu.Trigger asChild>
              <div
                className={`util-draggable cmp-query-response__item ${expanded.includes(item._uid) ? 'cmp-query-response__item--expanded' : ''}`}
                style={{ cursor: isRuleLayer ? 'default' : 'pointer' }}
              >
                <>
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
                      if (!isRegularLayer(diagram.activeLayer)) return;
                      if (ev.button !== 0) return; // Only handle left mouse button

                      const node =
                        dataTemplates.length > 0
                          ? makeTemplateNode(item, schema, document.definitions, dataTemplates[0])
                          : makeDefaultNode(item, schema, document.definitions);

                      DRAG_DROP_MANAGER.initiate(
                        new ObjectPickerDrag(ev.nativeEvent, node, diagram, undefined, app)
                      );
                    }}
                  >
                    {item[schema.fields[0].id]}

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
                                  [t, makeTemplateNode(item, schema, document.definitions, t)] as [
                                    DataTemplate,
                                    DiagramNode
                                  ]
                              )
                              .map(([t, n]) => (
                                <div
                                  key={n.id}
                                  style={{ background: 'transparent' }}
                                  data-width={n.diagram.viewBox.dimensions.w}
                                >
                                  <ContextMenu.Root>
                                    <ContextMenu.Trigger asChild>
                                      <div
                                        onPointerDown={ev => {
                                          if (!isRegularLayer(diagram.activeLayer)) return;
                                          if (ev.button !== 0) return;

                                          DRAG_DROP_MANAGER.initiate(
                                            new ObjectPickerDrag(
                                              ev.nativeEvent,
                                              n,
                                              diagram,
                                              undefined,
                                              app
                                            )
                                          );
                                        }}
                                      >
                                        <PickerCanvas
                                          width={42}
                                          height={42}
                                          diagramWidth={n.diagram.viewBox.dimensions.w}
                                          diagramHeight={n.diagram.viewBox.dimensions.h}
                                          diagram={n.diagram}
                                          showHover={true}
                                          name={t.name ?? ''}
                                          onMouseDown={() => {}}
                                        />
                                      </div>
                                    </ContextMenu.Trigger>
                                    <ContextMenu.Portal>
                                      <ContextMenu.Content className="cmp-context-menu">
                                        <ActionContextMenuItem
                                          action={'EXTERNAL_DATA_LINK_RENAME_TEMPLATE'}
                                          arg={{ templateId: t.id }}
                                        >
                                          Rename...
                                        </ActionContextMenuItem>
                                        <ActionContextMenuItem
                                          action={'EXTERNAL_DATA_LINK_REMOVE_TEMPLATE'}
                                          arg={{ templateId: t.id }}
                                        >
                                          Remove
                                        </ActionContextMenuItem>
                                      </ContextMenu.Content>
                                    </ContextMenu.Portal>
                                  </ContextMenu.Root>
                                </div>
                              ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              </div>
            </ContextMenu.Trigger>
            <ContextMenu.Portal>
              <ContextMenu.Content className="cmp-context-menu">
                <ContextMenu.Item
                  className="cmp-context-menu__item"
                  onClick={() => props.onEditItem(item)}
                >
                  Edit Item
                </ContextMenu.Item>
                <ContextMenu.Item
                  className="cmp-context-menu__item"
                  onClick={() => props.onDeleteItem(item)}
                >
                  Delete Item
                </ContextMenu.Item>
              </ContextMenu.Content>
            </ContextMenu.Portal>
          </ContextMenu.Root>
        );
      })}
    </div>
  );
};

const DataProviderQueryView = (props: {
  selectedSchema: string;
  onChangeSchema: (s: string | undefined) => void;
  onSearch: (s: string) => void;
}) => {
  const document = useDocument();
  const db = document.data.db;
  const ref = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState<string>('');

  return (
    <div style={{ width: '100%' }} className={'util-vstack'}>
      <div className={'util-hstack'}>
        <div style={{ flexGrow: 1 }}>
          <Select.Root value={props.selectedSchema} onChange={props.onChangeSchema}>
            {db.schemas?.map?.(schema => (
              <Select.Item key={schema.id} value={schema.id}>
                {schema.name}
              </Select.Item>
            ))}
          </Select.Root>
        </div>
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

  const dataProvider = document.data.db;

  useEffect(() => {
    if (!dataProvider) return;

    const rd = () => redraw();

    dataProvider.on('addData', rd);
    dataProvider.on('updateData', rd);
    dataProvider.on('deleteData', rd);
    return () => {
      dataProvider.off('addData', rd);
      dataProvider.off('updateData', rd);
      dataProvider.off('deleteData', rd);
    };
  }, [dataProvider]);

  useEventListener(document.data.templates, 'add', redraw);
  useEventListener(document.data.templates, 'update', redraw);
  useEventListener(document.data.templates, 'remove', redraw);

  const [selectedSchema, setSelectedSchema] = useState<string | undefined>(
    dataProvider?.schemas?.[0]?.id
  );

  if (
    dataProvider?.schemas &&
    dataProvider?.schemas?.length > 0 &&
    dataProvider?.schemas.find(s => s.id === selectedSchema) === undefined
  ) {
    setSelectedSchema(dataProvider.schemas[0].id);
  }

  const db = document.data.db;

  // Handle delete confirmation
  const handleDeleteItem = (item: Data) => {
    if (!dataProvider || !('deleteData' in dataProvider)) return;

    const schema =
      dataProvider.schemas?.find(s => s.id === selectedSchema) ?? dataProvider.schemas?.[0];
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
            await dataProvider.deleteData(schema, item);
          } catch (error) {
            console.error('Failed to delete item:', error);
          }
        }
      )
    );
  };

  return (
    <ToolWindow.TabContent>
      <ToolWindow.TabActions>
        <a
          className={'cmp-button cmp-button--icon-only'}
          aria-disabled={!db || (!('refreshData' in db) && !('refreshSchemas' in db))}
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

      <Accordion.Root type="multiple" defaultValue={['query', 'response']}>
        <ToolWindowPanel id={'query'} title={'Data Source'} mode={'headless'}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            {dataProvider === undefined && <div>No data provider configured</div>}

            {dataProvider !== undefined && (
              <DataProviderQueryView
                onSearch={setSearch}
                selectedSchema={selectedSchema!}
                onChangeSchema={setSelectedSchema}
              />
            )}
          </div>
        </ToolWindowPanel>

        {dataProvider !== undefined && (
          <ToolWindowPanel
            id={'response'}
            title={'Data'}
            mode={'accordion'}
            headerButtons={
              'addData' in dataProvider && (
                <a className={'cmp-button--icon-only'} onClick={() => setAddItemDialog(true)}>
                  <TbPlus />
                </a>
              )
            }
          >
            <DataProviderResponse
              selectedSchema={selectedSchema!}
              search={search}
              onEditItem={item => setEditItemDialog({ open: true, item })}
              onDeleteItem={handleDeleteItem}
            />
          </ToolWindowPanel>
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
  );
};
