import { Accordion } from '@diagram-craft/app-components/Accordion';
import { useApplication, useDiagram } from '../../../application';
import { Select } from '@diagram-craft/app-components/Select';
import {
  Data,
  DataProvider,
  RefreshableDataProvider,
  RefreshableSchemaProvider
} from '@diagram-craft/model/dataProvider';
import { useEffect, useState } from 'react';
import { useRedraw } from '../../hooks/useRedraw';
import { TbChevronDown, TbChevronRight, TbRefresh, TbSettings } from 'react-icons/tb';
import { DRAG_DROP_MANAGER } from '@diagram-craft/canvas/dragDropManager';
import { ObjectPickerDrag } from '../PickerToolWindow/ObjectPickerDrag';
import { Diagram } from '@diagram-craft/model/diagram';
import { newid } from '@diagram-craft/utils/id';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { isRegularLayer } from '@diagram-craft/model/diagramLayer';
import { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { assert } from '@diagram-craft/utils/assert';
import { DataProviderSettingsDialog } from './DataProviderSettingsDialog';
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
import { TextInput } from '@diagram-craft/app-components/TextInput';

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
  const { node, diagram } = Diagram.createThumbnailDiagramForNode(
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
  return Diagram.createThumbnailDiagramForNode(
    (diagram, layer) =>
      new DiagramNode(
        newid(),
        'rect',
        { w: 100, h: 100, y: 0, x: 0, r: 0 },
        diagram,
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
  dataProvider: DataProvider;
  selectedSchema: string;
  search: string;
}) => {
  const app = useApplication();
  const diagram = useDiagram();
  const document = diagram.document;
  const [expanded, setExpanded] = useState<string[]>([]);

  const schema =
    props.dataProvider?.schemas?.find(s => s.id === props.selectedSchema) ??
    props.dataProvider?.schemas?.[0];

  const data =
    props.search.trim() !== ''
      ? props.dataProvider.queryData(schema, props.search)
      : props.dataProvider.getData(schema);

  return (
    <div className={'cmp-query-response'}>
      {data?.map(item => {
        const dataTemplates = document.data.templates.bySchema(schema.id);
        return (
          <div
            key={item._uid}
            className={`util-draggable cmp-query-response__item ${expanded.includes(item._uid) ? 'cmp-query-response__item--expanded' : ''}`}
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
                onMouseDown={ev => {
                  if (!isRegularLayer(diagram.activeLayer)) return;

                  const node =
                    dataTemplates.length > 0
                      ? makeTemplateNode(item, schema, document.definitions, dataTemplates[0])
                      : makeDefaultNode(item, schema, document.definitions);

                  DRAG_DROP_MANAGER.initiate(
                    new ObjectPickerDrag(
                      // @ts-expect-error
                      ev,
                      node,
                      diagram,
                      undefined,
                      app
                    )
                  );
                }}
              >
                {item[schema.fields[0].id]}

                {expanded.includes(item._uid) && (
                  <>
                    <div>
                      {schema.fields.map(k => (
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
                                          // @ts-expect-error
                                          ev,
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
        );
      })}
    </div>
  );
};

const DataProviderQueryView = (props: {
  dataProvider: DataProvider;
  selectedSchema: string;
  onChangeSchema: (s: string | undefined) => void;
  onSearch: (s: string) => void;
}) => {
  const [search, setSearch] = useState<string>('');
  return (
    <div style={{ width: '100%' }} className={'util-vstack'}>
      <div>
        <Select.Root value={props.selectedSchema} onChange={props.onChangeSchema}>
          {props.dataProvider.schemas?.map?.(schema => (
            <Select.Item key={schema.id} value={schema.id}>
              {schema.name}
            </Select.Item>
          ))}
        </Select.Root>
      </div>
      <div className={'util-hstack'}>
        <TextInput
          value={search}
          onChange={v => setSearch(v ?? '')}
          onKeyDown={ev => {
            if (ev.key === 'Enter') {
              props.onSearch(search);
            }
          }}
        />

        <Button onClick={() => props.onSearch(search)}>Search</Button>
      </div>
    </div>
  );
};

export const DataToolWindow = () => {
  const redraw = useRedraw();
  const $diagram = useDiagram();
  const [providerSettingsWindow, setProviderSettingsWindow] = useState<boolean>(false);
  const document = $diagram.document;
  const [search, setSearch] = useState<string>('');

  const dataProvider = document.data.provider;

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

  const provider = document.data.provider;

  return (
    <>
      <Accordion.Root type="multiple" defaultValue={['query', 'response']}>
        <Accordion.Item value="query">
          <Accordion.ItemHeader>
            Data Source
            <Accordion.ItemHeaderButtons>
              <a
                className={'cmp-button cmp-button--icon-only'}
                style={{ marginRight: '0.5rem' }}
                aria-disabled={
                  !provider || (!('refreshData' in provider) && !('refreshSchemas' in provider))
                }
                onClick={async () => {
                  assert.present(provider);

                  if ('refreshData' in provider) {
                    await (provider as RefreshableDataProvider).refreshData();
                  }
                  if ('refreshSchemas' in provider) {
                    await (provider as RefreshableSchemaProvider).refreshSchemas();
                  }
                }}
              >
                <TbRefresh />
              </a>
              <a
                className={'cmp-button cmp-button--icon-only'}
                onClick={() => setProviderSettingsWindow(true)}
              >
                <TbSettings />
              </a>
            </Accordion.ItemHeaderButtons>
          </Accordion.ItemHeader>
          <Accordion.ItemContent>
            <div
              style={{
                marginBottom: '0.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              {dataProvider === undefined && <div>No data provider configured</div>}

              {dataProvider !== undefined && (
                <DataProviderQueryView
                  onSearch={setSearch}
                  dataProvider={dataProvider}
                  selectedSchema={selectedSchema!}
                  onChangeSchema={setSelectedSchema}
                />
              )}
            </div>
          </Accordion.ItemContent>
        </Accordion.Item>
        {dataProvider !== undefined && (
          <Accordion.Item value="response">
            <Accordion.ItemHeader>Items</Accordion.ItemHeader>
            <Accordion.ItemContent>
              <DataProviderResponse
                dataProvider={dataProvider}
                selectedSchema={selectedSchema!}
                search={search}
              />
            </Accordion.ItemContent>
          </Accordion.Item>
        )}
      </Accordion.Root>
      <DataProviderSettingsDialog
        onClose={() => setProviderSettingsWindow(false)}
        open={providerSettingsWindow}
      />
    </>
  );
};
