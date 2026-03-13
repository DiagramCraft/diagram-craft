import React, { ChangeEvent, useRef, useState } from 'react';
import { PropsUtils } from '@diagram-craft/utils/propsUtils';
import { extractDataAttributes } from './utils';
import styles from './TextInput.module.css';
import { Button } from './Button';
import { TbX } from 'react-icons/tb';

export const TextInput = React.forwardRef<HTMLInputElement, Props>((props, ref) => {
  const [error, setError] = useState(false);
  const [origValue, setOrigValue] = useState(props.value.toString());
  const [currentValue, setCurrentValue] = useState(props.value.toString());
  const hasFocus = useRef(false);

  if (origValue !== props.value.toString() && !props.isIndeterminate) {
    setOrigValue(props.value.toString());
    setCurrentValue(props.value.toString());
  }

  return (
    <div
      className={styles.cTextInput}
      {...extractDataAttributes(props)}
      data-error={error}
      data-field-state={props.isIndeterminate ? 'indeterminate' : props.state}
      style={props.style ?? {}}
    >
      {props.label && <div className={styles.eLabel}>{props.label}</div>}
      <input
        ref={ref}
        className={styles.eInput}
        {...PropsUtils.filterDomProperties(props)}
        placeholder={props.isIndeterminate ? '···' : props.placeholder}
        type={props.type}
        value={props.isIndeterminate ? '' : currentValue}
        disabled={props.disabled}
        onFocus={() => {
          hasFocus.current = true;
        }}
        onBlur={() => {
          hasFocus.current = false;
        }}
        onChange={ev => {
          const p = ev.target.value;
          setCurrentValue(p);

          if (ev.target.value === '') {
            setError(false);
            props.onChange?.(undefined, ev);
            return;
          }

          if (!p) {
            setError(true);
            return;
          }

          setError(false);
          props.onChange?.(p, ev);
          return;
        }}
        {...extractDataAttributes(props)}
      />
      {props.onClear && currentValue !== '' && (
        <Button
          variant={'icon-only'}
          className={styles.eClear}
          onClick={() => {
            setCurrentValue('');
            props.onClear!();
          }}
        >
          <TbX />
        </Button>
      )}
    </div>
  );
});

type Props = {
  value: string;
  label?: string;
  isIndeterminate?: boolean;
  state?: 'set' | 'unset' | 'overridden';
  onClear?: () => void;
  onChange?: (value: string | undefined, ev: ChangeEvent<HTMLInputElement>) => void;
} & Omit<
  React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>,
  'onChange' | 'value'
>;
