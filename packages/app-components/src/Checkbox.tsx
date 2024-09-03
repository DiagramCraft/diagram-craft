import { useState } from 'react';
import { ResetContextMenu } from './ResetContextMenu';

export const Checkbox = (props: Props) => {
  const [currentValue, setCurrentValue] = useState(props.value);

  const isDefaultValue =
    !props.hasMultipleValues &&
    props.isDefaultValue &&
    props.defaultValue !== undefined &&
    currentValue === props.defaultValue;

  return (
    <ResetContextMenu
      disabled={props.defaultValue === undefined}
      onReset={() => {
        setCurrentValue(props.defaultValue!);
        props.onChange(undefined);
      }}
    >
      <input
        type="checkbox"
        checked={props.value}
        data-is-default-value={isDefaultValue}
        onChange={e => {
          props.onChange(e.target.checked);
          setCurrentValue(e.target.checked);
        }}
      />
    </ResetContextMenu>
  );
};

type Props = {
  value: boolean;
  defaultValue?: boolean;
  isDefaultValue?: boolean;
  hasMultipleValues?: boolean;
  onChange: (value: boolean | undefined) => void;
};
