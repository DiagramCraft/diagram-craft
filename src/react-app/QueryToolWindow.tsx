import { AccordionTrigger } from './AccordionTrigger.tsx';
import { AccordionContent } from './AccordionContext.tsx';
import * as Accordion from '@radix-ui/react-accordion';
import { query } from '../utils/query.ts';
import { useDiagram } from './context/DiagramContext.tsx';
import { useRef, useState } from 'react';
import { TbChevronDown, TbChevronRight, TbFileSpreadsheet, TbHistory } from 'react-icons/tb';
import { Select } from './components/Select.tsx';

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

export const QueryToolWindow = () => {
  const diagram = useDiagram();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [queryString, setQueryString] = useState<string>('.elements[]');
  const [expanded, setExpanded] = useState<number[]>([]);

  let res = undefined;
  let error = undefined;
  try {
    res = query(queryString, [diagram.layers.active]);
  } catch (e) {
    error = e;
  }
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
              onValueChange={() => {}}
              value={'active-layer'}
              values={[
                { label: 'Active Layer', value: 'active-layer' },
                { label: 'Active Diagram', value: 'active-diagram' },
                { label: 'Active Document', value: 'active-document' },
                { label: 'Selection', value: 'selection' }
              ]}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className={'cmp-button'}>
                <TbHistory />
              </button>
              <button className={'cmp-button'}>
                <TbFileSpreadsheet />
              </button>
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
                setExpanded([]);
              }}
            >
              Export
            </button>
            <button
              className={'cmp-button cmp-button--primary'}
              onClick={() => {
                setExpanded([]);
                setQueryString(ref.current?.value ?? '');
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
