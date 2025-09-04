import { Select } from '@diagram-craft/app-components/Select';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Button } from '@diagram-craft/app-components/Button';
import {
  TbArrowDownRight,
  TbChevronDown,
  TbChevronRight,
  TbClipboardCopy,
  TbFile,
  TbHistory
} from 'react-icons/tb';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { useRedraw } from '../../hooks/useRedraw';
import { useDiagram } from '../../../application';
import { useRef, useState } from 'react';
import { parseAndQuery } from 'embeddable-jq';
import { Diagram } from '@diagram-craft/model/diagram';
import { ToolWindowPanel } from '../ToolWindowPanel';

const replacer = (key: string, value: unknown) => {
  // Skip private properties (starting with _)
  if (key.startsWith('_')) {
    return undefined;
  }

  if (key === 'trackableType') return undefined;

  // Handle known circular references
  if (key === 'parent') return value ? '...' : undefined;

  // Handle Map objects
  if (value instanceof Map) {
    return {
      __type: 'Map',
      ...Object.fromEntries(value.entries())
    };
  }

  return value;
};

// TODO: Maybe add max-depth to the JSON conversion

const getSource = (source: string, diagram: Diagram) => {
  switch (source) {
    case 'active-layer':
      return diagram.activeLayer;
    case 'active-diagram':
      return diagram;
    case 'active-document':
      return diagram.document;
    case 'selection':
      return diagram.selectionState;
  }
};

export const AdvancedSearchTab = () => {
  const redraw = useRedraw();
  const diagram = useDiagram();
  const ref = useRef<HTMLTextAreaElement>(null);
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const [queryString, setQueryString] = useState<string>('.elements[]');
  const [expanded, setExpanded] = useState<number[]>([]);
  const [source, setSource] = useState<string | undefined>('active-layer');
  const [downloadLink, setDownloadLink] = useState('');
  const [queryIdx, setQueryIdx] = useState(0);
  const [queryInput, setQueryInput] = useState<unknown>({});

  const queries: { q: string; output: unknown }[] = [];

  let qs = queryString;
  while (true) {
    const m = qs.match(/^(.*?)\|\s*?drilldown\(([^)]+)\)\s*?\|(.*)$/);

    if (!m) {
      queries.push({ q: qs, output: undefined });
      break;
    }

    qs = m[3];

    queries.push({ q: m[1], output: m[2] });
  }

  //console.log(queries);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let res: any[] | undefined = undefined;
  let error = undefined;
  try {
    const q = queries[queryIdx].q;
    const input = queryIdx === 0 ? getSource(source!, diagram) : queryInput;

    res = parseAndQuery(q, [input]);

    diagram.document.props.query.addHistory(['active-layer', queryString]);
  } catch (e) {
    error = e;
  }

  const exportToFile = () => {
    const data = new Blob([JSON.stringify(res, replacer, '  ')], { type: 'application/json' });
    if (downloadLink !== '') window.URL.revokeObjectURL(downloadLink);
    const link = window.URL.createObjectURL(data);
    setDownloadLink(link);
    downloadRef.current!.href = link;
    downloadRef.current!.click();
  };

  return (
    <Accordion.Root type="multiple" defaultValue={['query', 'response']}>
      <ToolWindowPanel mode={'headless'} id={'query'} title={'Query'}>
        <div
          style={{
            marginBottom: '0.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <Select.Root onChange={setSource} value={source}>
            <Select.Item value={'active-layer'}>Active Layer</Select.Item>
            <Select.Item value={'active-diagram'}>Active Diagram</Select.Item>
            <Select.Item value={'active-document'}>Active Document</Select.Item>
            <Select.Item value={'selection'}>Selection</Select.Item>
          </Select.Root>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button>
                  <TbHistory />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="cmp-context-menu" sideOffset={5}>
                  {(diagram.document.props.query?.history ?? []).map(h => (
                    <DropdownMenu.Item
                      key={h[1]}
                      className="cmp-context-menu__item"
                      onClick={() => {
                        setSource(h[0]);
                        ref.current!.value = h[1];
                      }}
                    >
                      {h[1]}
                    </DropdownMenu.Item>
                  ))}
                  <DropdownMenu.Arrow className="cmp-context-menu__arrow" />
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button>
                  <TbFile />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="cmp-context-menu" sideOffset={5}>
                  <DropdownMenu.Item
                    className="cmp-context-menu__item"
                    onClick={() => {
                      diagram.document.props.query.addSaved([source!, ref.current!.value]);
                    }}
                  >
                    Save
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="cmp-context-menu__item"
                    onClick={() => {
                      // TODO: To be implemented
                    }}
                  >
                    Manage
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="cmp-context-menu__separator" />
                  {(diagram.document.props.query?.saved ?? []).map(h => (
                    <DropdownMenu.Item
                      key={h[1]}
                      className="cmp-context-menu__item"
                      onClick={() => {
                        setSource(h[0]);
                        ref.current!.value = h[1];
                      }}
                    >
                      {h[1]}
                    </DropdownMenu.Item>
                  ))}
                  <DropdownMenu.Arrow className="cmp-context-menu__arrow" />
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>

        <TextArea ref={ref} value={queryString} style={{ minHeight: '100px' }} />
        <div
          style={{
            display: 'flex',
            justifyContent: 'end',
            marginTop: '0.5rem',
            gap: '0.5rem'
          }}
        >
          <Button
            type={'secondary'}
            onClick={() => {
              setExpanded([]);
            }}
          >
            Save as...
          </Button>
          <Button
            type={'secondary'}
            onClick={() => {
              exportToFile();
            }}
          >
            Export
          </Button>
          <a
            style={{ display: 'none' }}
            download={'export.json'}
            href={downloadLink}
            ref={downloadRef}
          >
            -
          </a>
          <Button
            onClick={() => {
              if (ref.current?.value === queryString) {
                redraw();
              } else {
                setQueryIdx(0);
                setQueryInput({});
                setExpanded([]);
                setQueryString(ref.current?.value ?? '');
              }
            }}
          >
            Run
          </Button>
        </div>
      </ToolWindowPanel>

      <ToolWindowPanel mode={'accordion'} id={'response'} title={'Query Response'}>
        <div className={'cmp-query-response'}>
          {!!error && <div className={'cmp-error'}>{error.toString()}</div>}
          {res &&
            res.map((e, idx) => (
              <div
                key={idx}
                className={`cmp-query-response__item ${expanded.includes(idx) ? 'cmp-query-response__item--expanded' : ''}`}
                onClick={() => {
                  if (expanded.includes(idx)) {
                    setExpanded(expanded.filter(e => e !== idx));
                  } else {
                    setExpanded([...expanded, idx]);
                  }
                }}
              >
                {expanded.includes(idx) ? <TbChevronDown /> : <TbChevronRight />}
                {expanded.includes(idx) && (
                  <div
                    style={{
                      position: 'absolute',
                      right: '0.5rem',
                      top: '0.125rem',
                      display: 'flex',
                      gap: '0.25rem'
                    }}
                  >
                    <Button type={'icon-only'}>
                      <TbArrowDownRight />
                    </Button>
                    <Button
                      type={'icon-only'}
                      onClick={ev => {
                        navigator.clipboard.writeText(
                          JSON.stringify(e, replacer, expanded.includes(idx) ? 2 : undefined)
                        );
                        ev.preventDefault();
                        ev.stopPropagation();
                      }}
                    >
                      <TbClipboardCopy />
                    </Button>
                  </div>
                )}
                <pre key={idx}>
                  {JSON.stringify(e, replacer, expanded.includes(idx) ? 2 : undefined)}
                </pre>
              </div>
            ))}
        </div>
      </ToolWindowPanel>
    </Accordion.Root>
  );
};
