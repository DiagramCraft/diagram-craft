import React, { useRef, useState } from 'react';
import { extractDataAttributes } from './utils';
import textStyles from './TextInput.module.css';
import dateStyles from './DateInput.module.css';

type Props = {
  value: string;
  label?: string;
  onChange?: (value: string | undefined) => void;
} & Omit<
  React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>,
  'onChange' | 'value' | 'type'
>;

export const DateInput = React.forwardRef<HTMLInputElement, Props>((props, ref) => {
  const { value, label, onChange, ...rest } = props;
  const [currentValue, setCurrentValue] = useState(value);
  const hasFocus = useRef(false);

  if (currentValue !== value && !hasFocus.current) {
    setCurrentValue(value);
  }

  return (
    <div
      className={textStyles.cTextInput}
      {...extractDataAttributes(props)}
      style={props.style ?? {}}
    >
      {label && <div className={textStyles.eLabel}>{label}</div>}
      <input
        ref={ref}
        className={`${textStyles.eInput} ${dateStyles.eInput}`}
        {...rest}
        type="date"
        value={currentValue}
        onFocus={() => {
          hasFocus.current = true;
        }}
        onBlur={() => {
          hasFocus.current = false;
        }}
        onChange={ev => {
          const v = ev.target.value;
          setCurrentValue(v);
          onChange?.(v === '' ? undefined : v);
        }}
        {...extractDataAttributes(props)}
      />
    </div>
  );
});
