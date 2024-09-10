import { Property } from '../toolwindow/ObjectToolWindow/types';
import React, { ReactElement } from 'react';
import { useRedraw } from '../hooks/useRedraw';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import styles from '@diagram-craft/app-components/Tooltip.module.css';

export function PropertyEditor<T>(props: Props<T>) {
  const redraw = useRedraw();

  const presentValue = props.formatValue ?? (v => v);
  const storeValue = props.storeValue ?? (v => v);

  let state: 'set' | 'unset' | 'overridden' | undefined = props.property.isSet ? 'set' : 'unset';
  const info = props.property.info ?? [];
  if (info.some(e => e.type === 'rule')) {
    state = 'overridden';
  }

  const renderValue =
    props.renderValue ??
    (props => (
      <span>
        {typeof props.value === 'string'
          ? props.value
          : typeof props.value === 'boolean'
            ? props.value
              ? 'on'
              : 'off'
            : JSON.stringify(props.value)}
      </span>
    ));

  return (
    <RadixTooltip.Provider>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>
          <span>
            {props.render({
              value: presentValue(props.property.val),
              onChange: v => {
                if (v === undefined) {
                  props.property.set(undefined);
                } else {
                  props.property.set(storeValue(v));
                }
              },
              isIndeterminate: props.property.hasMultipleValues,
              state: state
            })}
          </span>
        </RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content className={styles.cmpTooltip} sideOffset={5} side={'bottom'}>
            {props.property.hasMultipleValues && (
              <div style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>Multiple values</div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'max-content 1fr min-content',
                  gap: '0.5rem',
                  alignItems: 'center'
                }}
              >
                {props.property.hasMultipleValues &&
                  props.property.values !== undefined &&
                  props.property.values?.map((e, i) => (
                    <React.Fragment key={i}>
                      <div>{e.count}</div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {renderValue({
                          value: presentValue(e.val)
                        })}
                      </div>
                      <div>
                        <a
                          href={'#'}
                          onClick={() => {
                            props.property.set(e.val);
                            redraw();
                          }}
                        >
                          Use
                        </a>
                      </div>
                    </React.Fragment>
                  ))}

                {props.property.hasMultipleValues && props.property.values === undefined && (
                  <div>Multiple values</div>
                )}

                {info.length === 0 && state === 'set' && (
                  <div>
                    <a
                      href={'#'}
                      onClick={() => {
                        props.property.set(undefined);
                        redraw();
                      }}
                    >
                      Reset
                    </a>
                  </div>
                )}

                {info.length === 0 && state !== 'set' && <div>State: {state}</div>}

                {info.map((e, i) => (
                  <React.Fragment key={i}>
                    <div>
                      {e.type === 'default' && 'Default value'}
                      {e.type === 'stored' && 'Element value'}
                      {e.type === 'style' && 'Element stylesheet'}
                      {e.type === 'textStyle' && 'Text stylesheet'}
                      {e.type === 'rule' && 'Layer rule'}
                      {e.type === 'ruleStyle' && 'Layer rule element stylesheet'}
                      {e.type === 'ruleTextStyle' && 'Layer rule text stylesheet'}
                      {e.type === 'parent' && 'Parent element'}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {renderValue({
                        value: presentValue(e.val)
                      })}
                    </div>
                    <div>
                      {e.type === 'stored' && (
                        <a
                          href={'#'}
                          onClick={() => {
                            props.property.set(undefined);
                            redraw();
                          }}
                        >
                          Reset
                        </a>
                      )}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
            <RadixTooltip.Arrow className={styles.cmpTooltipArrow} />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}

type Props<V> = {
  property: Property<V>;
  render: (props: RenderProps<V>) => ReactElement;
  renderValue?: (props: { value: V }) => ReactElement;
  formatValue?: (v: V) => V;
  storeValue?: (v: V) => V;
};

type RenderProps<V> = {
  value: V;
  onChange: (value: V | undefined) => void;
  isIndeterminate?: boolean;
  state?: 'set' | 'unset' | 'overridden';
};
