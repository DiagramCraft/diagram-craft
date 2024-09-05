import { Property } from '../toolwindow/ObjectToolWindow/types';
import { ReactElement } from 'react';
import { ResetContextMenu } from '@diagram-craft/app-components/ResetContextMenu';
import { useRedraw } from '../hooks/useRedraw';

export function PropertyEditor<T>(props: Props<T>) {
  const redraw = useRedraw();

  const presentValue = props.formatValue ?? (v => v);
  const storeValue = props.storeValue ?? (v => v);

  return (
    <ResetContextMenu
      onReset={() => {
        props.property.set(undefined);
        redraw();
      }}
    >
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
        state: props.property.isSet ? 'set' : 'unset'
      })}
    </ResetContextMenu>
  );
}

type Props<V> = {
  property: Property<V>;
  render: (props: EditorProps<V>) => ReactElement;
  formatValue?: (v: V) => V;
  storeValue?: (v: V) => V;
};

type EditorProps<V> = {
  value: V;
  onChange: (value: V | undefined) => void;
  isIndeterminate?: boolean;
  state?: 'set' | 'unset' | 'overridden';
};
