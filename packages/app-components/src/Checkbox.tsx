import { extractMouseEvents } from './utils';

export const Checkbox = (props: Props) => {
  // TODO: Implement interminate state
  return (
    <input
      {...extractMouseEvents(props)}
      type="checkbox"
      checked={props.value}
      data-field-state={props.isIndeterminate ? 'indeterminate' : props.state}
      onChange={e => {
        props.onChange(e.target.checked);
      }}
    />
  );
};

type Props = {
  value: boolean;
  state?: 'set' | 'unset' | 'overridden';
  isIndeterminate?: boolean;
  onChange: (value: boolean | undefined) => void;
};
