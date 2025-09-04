import React, { useRef } from 'react';
import { Accordion } from '@diagram-craft/app-components/Accordion';

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
  } else if (props.mode === 'headless') {
    return (
      <>
        <div className={'cmp-panel__headless'}>{props.children}</div>
      </>
    );
  } else if (props.mode === 'headless-no-padding') {
    return (
      <>
        <div className={'cmp-panel__headless cmp-panel__headless--no-padding'}>
          {props.children}
        </div>
      </>
    );
  } else {
    return (
      <Accordion.Item value={props.id}>
        <Accordion.ItemHeader ref={ref}>
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
        </Accordion.ItemHeader>
        <Accordion.ItemContent>{props.children}</Accordion.ItemContent>
      </Accordion.Item>
    );
  }
};

export type ToolWindowPanelMode = 'accordion' | 'panel' | 'headless' | 'headless-no-padding';

type Props = {
  mode: ToolWindowPanelMode;
  children: React.ReactNode;

  id: string;
  title: string;
  hasCheckbox?: boolean;
  value?: boolean;
  onChange?: (value: boolean) => void;
};
