import { extractMouseEvents } from './utils';
import { ToggleButtonGroup } from './ToggleButtonGroup';
import { TbCheckbox, TbSquare, TbSquareMinus } from 'react-icons/tb';
import { useEffect, useRef } from 'react';
import styles from './Checkbox.module.css';

export const Checkbox = (props: Props) => {
  const ref = useRef<HTMLInputElement>(null);

  // Note: it's not clear why this is needed, but for some reason,
  //       without it, the checkbox in data schema popup doesn't work
  useEffect(() => {
    setTimeout(() => {
      ref.current!.checked = props.value;
      ref.current!.indeterminate = props.isIndeterminate ?? false;
    });
  }, [props.value, props.isIndeterminate]);

  return (
    <>
      <input
        {...extractMouseEvents(props)}
        ref={ref}
        type="checkbox"
        className={styles.cmpCheckbox}
        checked={props.value}
        data-field-state={props.isIndeterminate ? 'indeterminate' : props.state}
        onChange={e => {
          props.onChange(e.target.checked);
        }}
        disabled={props.disabled}
      />
      {props.label && <span>&nbsp;{props.label}</span>}
    </>
  );
};

export const FancyCheckbox = (props: Props) => {
  const getIcon = () => {
    if (props.isIndeterminate) return <TbSquareMinus />;
    if (props.value) return <TbCheckbox />;
    return <TbSquare />;
  };

  return (
    <ToggleButtonGroup.Root
        type={'single'}
        value={props.value ? 'set' : ''}
        data-field-state={props.isIndeterminate ? 'indeterminate' : props.state}
        onChange={value => {
          props.onChange(value === 'set');
        }}
      >
        <ToggleButtonGroup.Item value={'set'}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {getIcon()} {props.label}
          </div>
        </ToggleButtonGroup.Item>
      </ToggleButtonGroup.Root>
  );
};

type Props = {
  value: boolean;
  state?: 'set' | 'unset' | 'overridden';
  isIndeterminate?: boolean;
  onChange: (value: boolean | undefined) => void;
  label?: string;
  disabled?: boolean;
};
