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
  render: (props: RenderProps<V>) => ReactElement;
  formatValue?: (v: V) => V;
  storeValue?: (v: V) => V;
};

type RenderProps<V> = {
  value: V;
  onChange: (value: V | undefined) => void;
  isIndeterminate?: boolean;
  state?: 'set' | 'unset' | 'overridden';
};

export function Editor<T>(props: EditorProps<T>) {
  const redraw = useRedraw();
  const presentValue = props.formatValue ?? (v => v);
  const storeValue = props.storeValue ?? (v => v);

  return (
    <ResetContextMenu
      onReset={() => {
        props.set(undefined);
        redraw();
      }}
    >
      {props.render({
        value: presentValue(props.val),
        onChange: v => {
          if (v === undefined) {
            props.set(undefined);
          } else {
            props.set(storeValue(v));
          }
        },
        isIndeterminate: props.isIndeterminate,
        state: props.state
      })}
    </ResetContextMenu>
  );
}

type EditorProps<V> = {
  formatValue?: (v: V) => V;
  storeValue?: (v: V) => V;
  val: V;
  set: (v: V | undefined) => void;
  state: 'set' | 'unset' | 'overridden' | undefined;
  isIndeterminate: boolean;
  render: (props: RenderProps<V>) => ReactElement;
};
