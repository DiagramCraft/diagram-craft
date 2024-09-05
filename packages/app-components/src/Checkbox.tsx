export const Checkbox = (props: Props) => {
  // TODO: Implement interminate state
  return (
    /* @ts-ignore */
    <input
      {...props}
      type="checkbox"
      checked={props.value}
      data-is-default-value={props.state === 'unset'}
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
