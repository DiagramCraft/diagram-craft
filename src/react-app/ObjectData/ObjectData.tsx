import { AccordionTrigger } from '../AccordionTrigger.tsx';
import { AccordionContent } from '../AccordionContext.tsx';
import * as Accordion from '@radix-ui/react-accordion';
import { Select } from '../components/Select.tsx';
import { useDiagram } from '../context/DiagramContext.tsx';
import { useElementProperty } from '../ObjectProperties/useProperty.ts';
import { ChangeEvent, useCallback } from 'react';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { commitWithUndo } from '../../model/diagramUndoActions.ts';
import { unique } from '../../utils/array.ts';
import React from 'react';
import { useRedraw } from '../../react-canvas-viewer/useRedraw.tsx';
import { useEventListener } from '../hooks/useEventListener.ts';

export const ObjectData = () => {
  const $d = useDiagram();
  const redraw = useRedraw();

  useEventListener($d.selectionState, 'change', redraw);
  useEventListener($d, 'change', redraw);

  const schema = useElementProperty($d, 'data.schema', 'none');

  const changeCallback = useCallback(
    (id: string, ev: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const uow = new UnitOfWork($d, true);
      $d.selectionState.elements.forEach(e => {
        e.updateProps(p => {
          p.data ??= {};
          p.data.data ??= {};
          p.data.data[id] = (ev.target! as HTMLInputElement).value;
        }, uow);
      });
      commitWithUndo(uow, 'Update data');
    },
    [$d]
  );

  return (
    <Accordion.Root className="cmp-accordion" type="multiple" defaultValue={['data', 'local']}>
      <Accordion.Item className="cmp-accordion__item" value="data">
        <AccordionTrigger>Data</AccordionTrigger>
        <AccordionContent>
          {/*<div className={'cmp-labeled-table'}>
            <div className={'cmp-labeled-table__label util-a-top-center'}>Type:</div>
            <div className={'cmp-labeled-table__value'}>
              Derived (overrides) | Standalone (schema)
            </div>
          </div>*/}
          <div className={'cmp-labeled-table'}>
            <div className={'cmp-labeled-table__label util-a-top-center'}>Schema:</div>
            <div className={'cmp-labeled-table__value util-hstack'}>
              <Select
                value={schema.val}
                values={[
                  {
                    value: 'none',
                    label: 'None'
                  },
                  ...$d.document.schemas.all.map(s => ({
                    value: s.id,
                    label: s.name
                  }))
                ]}
                hasMultipleValues={schema.hasMultipleValues}
                onValueChange={v => {
                  schema.set(v);
                }}
              />
            </div>
            {$d.document.schemas.get(schema.val).fields.map(f => {
              const v = unique(
                $d.selectionState.elements.map(e => {
                  return e.props.data?.data?.[f.id];
                })
              );
              // TODO: Handle multiple values (mixed)

              return (
                <React.Fragment key={f.id}>
                  <div className={'cmp-labeled-table__label util-a-top-center'}>{f.name}:</div>
                  <div className={'cmp-labeled-table__value cmp-text-input'}>
                    {f.type === 'text' && (
                      <input type={'text'} value={v[0]} onChange={e => changeCallback(f.id, e)} />
                    )}
                    {f.type === 'longtext' && (
                      <textarea
                        style={{ height: '40px' }}
                        value={v[0]}
                        onChange={e => changeCallback(f.id, e)}
                      />
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </AccordionContent>
      </Accordion.Item>
      {/*      <Accordion.Item className="cmp-accordion__item" value="local">
        <AccordionTrigger>Local Data</AccordionTrigger>
      </Accordion.Item>
      <Accordion.Item className="cmp-accordion__item" value="schema">
        <AccordionTrigger>Schemas</AccordionTrigger>
      </Accordion.Item>*/}
    </Accordion.Root>
  );
};
