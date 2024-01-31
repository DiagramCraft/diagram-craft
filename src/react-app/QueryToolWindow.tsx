import { AccordionTrigger } from './AccordionTrigger.tsx';
import { AccordionContent } from './AccordionContext.tsx';
import * as Accordion from '@radix-ui/react-accordion';
import { query } from '../utils/query.ts';
import { useDiagram } from './context/DiagramContext.tsx';
import { useRef, useState } from 'react';
import { TbChevronDown, TbChevronRight, TbFile, TbHistory } from 'react-icons/tb';
import { Select } from './components/Select.tsx';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Diagram } from '../model/diagram.ts';
import { useRedraw } from '../react-canvas-viewer/useRedraw.tsx';

const replacer = (_key: string, value: unknown) => {
  if (value instanceof Map) {
    return {
      __type: 'Map',
      ...Object.fromEntries(value.entries())
    };
  } else {
    return value;
  }
};

// TODO: Maybe add max-depth to the JSON conversion

const getSource = (source: string, diagram: Diagram) => {
  switch (source) {
    case 'active-layer':
      return diagram.layers.active;
    case 'active-diagram':
      return diagram;
    case 'active-document':
      return diagram.document;
    case 'selection':
      return diagram.selectionState;
  }
};

export const QueryToolWindow = () => {
  const redraw = useRedraw();
  const diagram = useDiagram();
  const ref = useRef<HTMLTextAreaElement>(null);
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const [queryString, setQueryString] = useState<string>('.elements[]');
  const [expanded, setExpanded] = useState<number[]>([]);
  const [source, setSource] = useState<string>('active-layer');
  const [downloadLink, setDownloadLink] = useState('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let res: any[] | undefined = undefined;
  let error = undefined;
  try {
    res = query(queryString, [getSource(source, diagram)]);

    diagram.document.props.query ??= {};
    diagram.document.props.query.history ??= [];

    diagram.document.props.query.history.unshift(['active-layer', queryString]);
    diagram.document.props.query.history = diagram.document.props.query.history.filter((e, idx) => {
      return idx === 0 || e[0] !== 'active-layer' || e[1] !== queryString;
    });
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
    <Accordion.Root className="cmp-accordion" type="multiple" defaultValue={['query', 'response']}>
      <Accordion.Item className="cmp-accordion__item cmp-accordion__item" value="query">
        <AccordionTrigger>Query</AccordionTrigger>
        <AccordionContent>
          <div
            style={{
              marginBottom: '0.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <Select
              onValueChange={setSource}
              value={source}
              values={[
                { label: 'Active Layer', value: 'active-layer' },
                { label: 'Active Diagram', value: 'active-diagram' },
                { label: 'Active Document', value: 'active-document' },
                { label: 'Selection', value: 'selection' }
              ]}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className={'cmp-button'}>
                    <TbHistory />
                  </button>
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
                  <button className={'cmp-button'}>
                    <TbFile />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="cmp-context-menu" sideOffset={5}>
                    <DropdownMenu.Item
                      className="cmp-context-menu__item"
                      onClick={() => {
                        diagram.document.props.query ??= {};
                        diagram.document.props.query.saved ??= [];
                        diagram.document.props.query.saved.push([source, ref.current!.value]);
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

          <div className={'cmp-text-input'}>
            <textarea ref={ref} defaultValue={queryString} style={{ height: '100px' }} />
          </div>
          <div
            style={{ display: 'flex', justifyContent: 'end', marginTop: '0.5rem', gap: '0.5rem' }}
          >
            <button
              className={'cmp-button cmp-button--secondary'}
              onClick={() => {
                setExpanded([]);
              }}
            >
              Save as...
            </button>
            <button
              className={'cmp-button cmp-button--secondary'}
              onClick={() => {
                exportToFile();
              }}
            >
              Export
            </button>
            <a
              style={{ display: 'none' }}
              download={'export.json'}
              href={downloadLink}
              ref={downloadRef}
            >
              -
            </a>
            <button
              className={'cmp-button cmp-button--primary'}
              onClick={() => {
                if (ref.current?.value === queryString) {
                  redraw();
                } else {
                  setExpanded([]);
                  setQueryString(ref.current?.value ?? '');
                }
              }}
            >
              Run
            </button>
          </div>
        </AccordionContent>
      </Accordion.Item>

      <Accordion.Item className="cmp-accordion__item cmp-accordion__item--fill" value="response">
        <AccordionTrigger>Response</AccordionTrigger>
        <AccordionContent>
          <div className={'cmp-query-response'}>
            {!!error && <div className={'cmp-text-input__error'}>{error.toString()}</div>}
            {res &&
              res.map((e, idx) => (
                <div
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
                  <pre key={idx}>
                    {JSON.stringify(e, replacer, expanded.includes(idx) ? 2 : undefined)}
                  </pre>
                </div>
              ))}
          </div>
        </AccordionContent>
      </Accordion.Item>
    </Accordion.Root>
  );
};
