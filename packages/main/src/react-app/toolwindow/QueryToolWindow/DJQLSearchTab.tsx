import { Select } from '@diagram-craft/app-components/Select';
import { Button } from '@diagram-craft/app-components/Button';
import { TbArrowDownRight, TbChevronDown, TbChevronRight, TbClipboardCopy } from 'react-icons/tb';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { useRedraw } from '../../hooks/useRedraw';
import { useDiagram } from '../../../application';
import { useRef, useState } from 'react';
import { useQueryToolWindowContext } from './QueryToolWindowContext';
import { parseAndQuery } from 'embeddable-jq';
import { Diagram } from '@diagram-craft/model/diagram';
import { ToolWindowPanel } from '../ToolWindowPanel';
import { addHighlight, Highlights, removeHighlight } from '@diagram-craft/canvas/highlight';
import { ToolWindow } from '../ToolWindow';
import { SearchToolMenu } from './SearchToolMenu';

const replacer = (key: string, value: unknown) => {
  // Skip private properties (starting with _)
  if (key.startsWith('_')) {
    return undefined;
  }

  if (key === 'trackableType') return undefined;
  if (key === 'diagram') return undefined;

  // Handle known circular references
  if (key === 'parent') return value ? '...' : undefined;

  // Handle Map objects
  if (value instanceof Map) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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

export const DJQLSearchTab = () => {
  const redraw = useRedraw();
  const diagram = useDiagram();
  const { djqlQuery, djqlScope, setDjqlQuery } = useQueryToolWindowContext();
  const ref = useRef<HTMLTextAreaElement>(null);
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const [expanded, setExpanded] = useState<number[]>([]);
  const [downloadLink, setDownloadLink] = useState('');
  const [queryIdx, setQueryIdx] = useState(0);
  const [queryInput, setQueryInput] = useState<unknown>({});

  const queries: { q: string; output: unknown }[] = [];

  let qs = djqlQuery;
  while (true) {
    const m = qs.match(/^(.*?)\|\s*?drilldown\(([^)]+)\)\s*?\|(.*)$/);

    if (!m) {
      queries.push({ q: qs, output: undefined });
      break;
    }

    qs = m[3]!;

    queries.push({ q: m[1]!, output: m[2]! });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let res: any[] | undefined = undefined;
  let error: string | undefined = undefined;
  try {
    const q = queries[queryIdx]!.q;
    const input = queryIdx === 0 ? getSource(djqlScope, diagram) : queryInput;

    res = parseAndQuery(q, [input]);

    diagram.document.props.query.addHistory(
      'djql',
      djqlQuery,
      djqlScope ?? 'active-layer',
      djqlQuery
    );
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unnecessary-condition
    error = (e as Error).message ?? (e as any).toString();
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
    <ToolWindow.TabContent>
      <ToolWindow.TabActions>
        <SearchToolMenu
          type={'djql'}
          onQuerySelect={(scope, query) => {
            setDjqlQuery(query, scope);
            ref.current!.value = query;
          }}
          getQuery={() => ref.current!.value}
          getLabel={() => ref.current!.value}
          getScope={() => djqlScope}
        />
      </ToolWindow.TabActions>
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
            <Select.Root
              onChange={s => setDjqlQuery(djqlQuery, s ?? 'active-layer')}
              value={djqlScope}
            >
              <Select.Item value={'active-layer'}>Active Layer</Select.Item>
              <Select.Item value={'active-diagram'}>Active Diagram</Select.Item>
              <Select.Item value={'active-document'}>Active Document</Select.Item>
              <Select.Item value={'selection'}>Selection</Select.Item>
            </Select.Root>
          </div>

          <TextArea ref={ref} value={djqlQuery} style={{ minHeight: '100px' }} />
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
            <Button type={'secondary'} onClick={() => exportToFile()}>
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
                if (ref.current?.value === djqlQuery) {
                  redraw();
                } else {
                  setQueryIdx(0);
                  setQueryInput({});
                  setExpanded([]);
                  setDjqlQuery(ref.current?.value ?? '', djqlScope);
                }
              }}
            >
              Run
            </Button>
          </div>
        </ToolWindowPanel>

        <ToolWindowPanel mode={'accordion'} id={'response'} title={'Query Response'}>
          <div className={'cmp-query-response'}>
            {!!error && <div className={'cmp-error'}>{error}</div>}
            {res &&
              res.map((e, idx) => (
                <div
                  key={idx}
                  className={`cmp-query-response__item ${expanded.includes(idx) ? 'cmp-query-response__item--expanded' : ''}`}
                  style={{
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    if (expanded.includes(idx)) {
                      setExpanded(expanded.filter(e => e !== idx));
                    } else {
                      setExpanded([...expanded, idx]);
                    }
                  }}
                  onMouseEnter={() => {
                    if (e.type && e.id) {
                      const el = diagram.lookup(e.id);
                      if (el) addHighlight(el, Highlights.NODE__HIGHLIGHT);
                    }
                  }}
                  onMouseLeave={() => {
                    if (e.type && e.id) {
                      const el = diagram.lookup(e.id);
                      if (el) removeHighlight(el, Highlights.NODE__HIGHLIGHT);
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
    </ToolWindow.TabContent>
  );
};
