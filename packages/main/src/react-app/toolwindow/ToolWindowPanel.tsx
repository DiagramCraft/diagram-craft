import * as Accordion from '@radix-ui/react-accordion';
import { AccordionTrigger } from '../components/AccordionTrigger';
import { AccordionContent } from '../components/AccordionContent';
import React, { useRef } from 'react';

export const ToolWindowPanel = (props: Props) => {
  const ref = useRef<HTMLButtonElement>(null);

  if (props.mode === 'panel') {
    return (
      <>
        <h2 className={'util-hstack'} style={{ gap: '0.5rem' }}>
          {props.hasCheckbox && (
            <input
              className="cmp-panel__enabled"
              type={'checkbox'}
              checked={props.value ?? false}
              onChange={() => {
                props.onChange!(!props.value);
              }}
              onClick={e => {
                if (props.value || ref.current?.dataset['state'] === 'open') {
                  e.stopPropagation();
                }
              }}
            />
          )}
          <span>{props.title}</span>
        </h2>
        <div className={'cmp-panel__children'}>{props.children}</div>
      </>
    );
  } else {
    return (
      <Accordion.Item className="cmp-accordion__item" value={props.id}>
        <AccordionTrigger ref={ref}>
          <div className={'util-hstack'} style={{ gap: '0.5rem' }}>
            {props.hasCheckbox && (
              <input
                className="cmp-accordion__enabled"
                type={'checkbox'}
                checked={props.value ?? false}
                onChange={() => {
                  props.onChange!(!props.value);
                }}
                onClick={e => {
                  if (props.value || ref.current?.dataset['state'] === 'open') {
                    e.stopPropagation();
                  }
                }}
              />
            )}
            <span>{props.title}</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>{props.children}</AccordionContent>
      </Accordion.Item>
    );
  }
};

type Props = {
  mode: 'accordion' | 'panel';
  children: React.ReactNode;

  id: string;
  title: string;
  hasCheckbox?: boolean;
  value?: boolean;
  onChange?: (value: boolean) => void;
};
