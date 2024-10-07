import { extractMouseEvents } from './utils';
import { ToggleButtonGroup } from './ToggleButtonGroup';
import { TbCheckbox, TbSquare } from 'react-icons/tb';
import { useEffect, useRef } from 'react';

export const Checkbox = (props: Props) => {
  // TODO: Implement indeterminate state
  const ref = useRef<HTMLInputElement>(null);

  // Note: it's not clear why this is needed, but for some reason,
  //       without it, the checkbox in data schema popup doesn't work
  useEffect(() => {
    setTimeout(() => {
      ref.current!.checked = props.value;
    });
  }, [props.value]);

  return (
    <>
      <input
        {...extractMouseEvents(props)}
        ref={ref}
        type="checkbox"
        checked={props.value}
        data-field-state={props.isIndeterminate ? 'indeterminate' : props.state}
        onChange={e => {
          props.onChange(e.target.checked);
        }}
      />
      {props.label && <span>&nbsp;{props.label}</span>}
    </>
  );
};

export const FancyCheckbox = (props: Props) => {
  return (
    <>
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
            {props.value ? <TbCheckbox /> : <TbSquare />} {props.label}
          </div>
        </ToggleButtonGroup.Item>
      </ToggleButtonGroup.Root>
    </>
  );
};

type Props = {
  value: boolean;
  state?: 'set' | 'unset' | 'overridden';
  isIndeterminate?: boolean;
  onChange: (value: boolean | undefined) => void;
  label?: string;
};
