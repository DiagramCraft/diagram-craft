import React, { useRef, useState } from 'react';
import { propsUtils } from '@diagram-craft/utils/propsUtils';
import { extractDataAttributes } from './utils';
import styles from './TextArea.module.css';

export const TextArea = (props: Props) => {
  const [error, setError] = useState(false);
  const [origValue, setOrigValue] = useState(props.value.toString());
  const [currentValue, setCurrentValue] = useState(props.value.toString());
  const hasFocus = useRef(false);

  if (origValue !== props.value.toString() && !hasFocus.current && !props.isIndeterminate) {
    setOrigValue(props.value.toString());
    setCurrentValue(props.value.toString());
  }

  console.log(props);
  console.log(props.isIndeterminate ? '' : currentValue);

  return (
    <div
      className={styles.cmpTextArea}
      {...extractDataAttributes(props)}
      data-error={error}
      data-field-state={props.isIndeterminate ? 'indeterminate' : props.state}
      style={props.style ?? {}}
    >
      <textarea
        {...propsUtils.filterDomProperties(props)}
        placeholder={props.isIndeterminate ? '···' : undefined}
        disabled={props.disabled}
        onFocus={() => {
          hasFocus.current = true;
        }}
        onBlur={() => {
          hasFocus.current = true;
        }}
        onChange={ev => {
          const p = ev.target.value;
          setCurrentValue(p);

          if (ev.target.value === '') {
            setError(false);
            props.onChange(undefined);
            return;
          }

          if (!p) {
            setError(true);
            return;
          }

          setError(false);
          props.onChange(p);
          return;
        }}
        value={props.isIndeterminate ? '' : currentValue}
        {...extractDataAttributes(props)}
      >
        {props.isIndeterminate ? '' : currentValue}
      </textarea>
    </div>
  );
};

type Props = {
  value: string | number;
  isIndeterminate?: boolean;
  state?: 'set' | 'unset' | 'overridden';
  onChange: (value: string | undefined) => void;
} & Omit<
  React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>,
  'onChange' | 'value'
>;
