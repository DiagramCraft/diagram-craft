import { Accordion } from '@diagram-craft/app-components/Accordion';
import { useApplication, useDiagram } from '../../../application';
import { Select } from '@diagram-craft/app-components/Select';
import { Data, DataProvider } from '@diagram-craft/model/dataProvider';
import { useEffect, useState } from 'react';
import { useRedraw } from '../../hooks/useRedraw';
import { TbChevronDown, TbChevronRight } from 'react-icons/tb';
import { DRAG_DROP_MANAGER } from '@diagram-craft/canvas/dragDropManager';
import { ObjectPickerDrag } from '../PickerToolWindow/ObjectPickerDrag';
import { Diagram } from '@diagram-craft/model/diagram';
import { newid } from '@diagram-craft/utils/id';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { isRegularLayer } from '@diagram-craft/model/diagramLayer';
import { DataSchema } from '@diagram-craft/model/diagramDataSchemas';

const makeDiagramNode = (diagram: Diagram, item: Data, schema: DataSchema): DiagramNode => {
  return Diagram.createForNode(
    (d, l) =>
      new DiagramNode(
        newid(),
        'rect',
        { w: 100, h: 100, y: 0, x: 0, r: 0 },
        d,
        l,
        {},
        {
          data: {
            data: [
              {
                type: 'external',
                external: {
                  uid: item._uid
                },
                data: item,
                schema: schema.id
              }
            ]
          }
        },
        {
          text: `%${schema.fields[0].id}%`
        }
      ),
    diagram.document.nodeDefinitions,
    diagram.document.edgeDefinitions
  ).node;
};

const DataProviderResponse = (props: { dataProvider: DataProvider; selectedSchema: string }) => {
  const app = useApplication();
  const diagram = useDiagram();
  const [expanded, setExpanded] = useState<string[]>([]);

  const schema =
    props.dataProvider?.schemas?.find(s => s.id === props.selectedSchema) ??
    props.dataProvider?.schemas?.[0];

  return (
    <div className={'cmp-query-response'}>
      {props.dataProvider.getData(schema)?.map(item => (
        <div
          key={item._uid}
          className={`cmp-query-response__item ${expanded.includes(item._uid) ? 'cmp-query-response__item--expanded' : ''}`}
          style={{ cursor: 'move' }}
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

                DRAG_DROP_MANAGER.initiate(
                  // @ts-ignore
                  new ObjectPickerDrag(ev, makeDiagramNode(diagram, item, schema), diagram, app)
                );
              }}
            >
              {item['name'] ?? item[schema.fields[0].id]}
              {expanded.includes(item._uid) && (
                <div>
                  {Object.keys(item)
                    .filter(k => !k.startsWith('_'))
                    .map(k => (
                      <div key={k}>
                        {k}: {item[k]}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </>
        </div>
      ))}
    </div>
  );
};

const DataProviderQueryView = (props: {
  dataProvider: DataProvider;
  selectedSchema: string;
  onChangeSchema: (s: string | undefined) => void;
}) => {
  return (
    <div style={{ width: '100%' }}>
      <div>
        <Select.Root value={props.selectedSchema} onChange={props.onChangeSchema}>
          {props.dataProvider.schemas?.map?.(schema => (
            <Select.Item key={schema.id} value={schema.id}>
              {schema.name}
            </Select.Item>
          ))}
        </Select.Root>
      </div>
    </div>
  );
};

export const DataToolWindow = () => {
  const redraw = useRedraw();
  const $diagram = useDiagram();
  const document = $diagram.document;

  const dataProvider = document.dataProvider;

  useEffect(() => {
    if (!dataProvider) return;

    const rd = () => redraw();

    dataProvider.on('add', rd);
    dataProvider.on('update', rd);
    dataProvider.on('delete', rd);
    return () => {
      dataProvider.off('add', rd);
      dataProvider.off('update', rd);
      dataProvider.off('delete', rd);
    };
  }, [dataProvider]);

  const [selectedSchema, setSelectedSchema] = useState<string | undefined>(
    dataProvider?.schemas?.[0]?.id
  );

  if (
    dataProvider?.schemas &&
    dataProvider?.schemas.find(s => s.id === selectedSchema) === undefined
  ) {
    setSelectedSchema(dataProvider.schemas[0].id);
  }

  return (
    <Accordion.Root type="multiple" defaultValue={['query', 'response']}>
      <Accordion.Item value="query">
        <Accordion.ItemHeader>Data Query</Accordion.ItemHeader>
        <Accordion.ItemContent>
          <div
            style={{
              marginBottom: '0.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            {dataProvider === undefined && <div></div>}

            {dataProvider !== undefined && (
              <DataProviderQueryView
                dataProvider={dataProvider}
                selectedSchema={selectedSchema!}
                onChangeSchema={setSelectedSchema}
              />
            )}
          </div>
        </Accordion.ItemContent>
      </Accordion.Item>
      <Accordion.Item value="response">
        <Accordion.ItemHeader>Items</Accordion.ItemHeader>
        <Accordion.ItemContent>
          {dataProvider !== undefined && (
            <DataProviderResponse dataProvider={dataProvider} selectedSchema={selectedSchema!} />
          )}
        </Accordion.ItemContent>
      </Accordion.Item>
    </Accordion.Root>
  );
};
