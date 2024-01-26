import { AccordionTrigger } from './AccordionTrigger.tsx';
import { AccordionContent } from './AccordionContext.tsx';
import * as Accordion from '@radix-ui/react-accordion';
import { query } from '../utils/query.ts';
import { useDiagram } from './context/DiagramContext.tsx';
import { useRef, useState } from 'react';

export const QueryToolWindow = () => {
  const diagram = useDiagram();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [queryString, setQueryString] = useState<string>('.elements[]');

  const res = query(queryString, [diagram.layers.active]);
  return (
    <Accordion.Root className="cmp-accordion" type="multiple" defaultValue={['query', 'response']}>
      <Accordion.Item className="cmp-accordion__item cmp-accordion__item" value="query">
        <AccordionTrigger>Query</AccordionTrigger>
        <AccordionContent>
          <div className={'cmp-text-input'}>
            <textarea ref={ref} defaultValue={queryString} style={{ height: '100px' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'end', marginTop: '0.5rem' }}>
            <button
              className={'cmp-button'}
              onClick={() => {
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
            {res.map(e => (
              <pre style={{}}>{JSON.stringify(e, undefined, 2)}</pre>
            ))}
          </div>
        </AccordionContent>
      </Accordion.Item>
    </Accordion.Root>
  );
};
