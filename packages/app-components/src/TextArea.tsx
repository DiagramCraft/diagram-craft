import React, { ChangeEvent, useRef, useState } from 'react';
import { PropsUtils } from '@diagram-craft/utils/propsUtils';
import { extractDataAttributes } from './utils';
import styles from './TextArea.module.css';
import { MaximizedTextDialog } from './MaximizedTextDialog';
import { MaximizeButton } from './MaximizeButton';

export const TextArea = React.forwardRef<HTMLTextAreaElement, Props>((props, ref) => {
  const [error, setError] = useState(false);
  const [origValue, setOrigValue] = useState(props.value.toString());
  const [currentValue, setCurrentValue] = useState(props.value.toString());
  const hasFocus = useRef(false);
  const [maximized, setMaximized] = useState(false);

  if (origValue !== props.value.toString() && !hasFocus.current && !props.isIndeterminate) {
    setOrigValue(props.value.toString());
    setCurrentValue(props.value.toString());
  }

  const inner = (
    <>
      <div
        className={styles.cTextArea}
        {...extractDataAttributes(props)}
        data-error={error}
        data-field-state={props.isIndeterminate ? 'indeterminate' : props.state}
        style={
          props.style ?? {
            position: 'relative'
          }
        }
      >
        <textarea
          ref={ref}
          {...PropsUtils.filterDomProperties(props)}
          className={props.className ? `${props.className} ${styles.eTextArea}` : styles.eTextArea}
          placeholder={props.isIndeterminate ? '···' : undefined}
          disabled={props.disabled}
          onFocus={e => {
            hasFocus.current = true;
            props?.onFocus?.(e);
          }}
          onBlur={e => {
            hasFocus.current = true;
            props?.onBlur?.(e);
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
          value={props.isIndeterminate ? '' : currentValue}
          {...extractDataAttributes(props)}
        >
          {props.isIndeterminate ? '' : currentValue}
        </textarea>

        {!maximized && <MaximizeButton onClick={() => setMaximized(true)} />}
      </div>
    </>
  );

  if (maximized) {
    return (
      <MaximizedTextDialog
        open={maximized}
        onClose={() => setMaximized(false)}
        contentClassName={styles.cTextAreaMaximizedContent}
      >
        {inner}
      </MaximizedTextDialog>
    );
  }
  return <div>{inner}</div>;
});

type Props = {
  value: string | number;
  isIndeterminate?: boolean;
  state?: 'set' | 'unset' | 'overridden';
  onChange?: (value: string | undefined, ev: ChangeEvent<HTMLTextAreaElement>) => void;
} & Omit<
  React.DetailedHTMLProps<React.TextareaHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>,
  'onChange' | 'value'
>;
