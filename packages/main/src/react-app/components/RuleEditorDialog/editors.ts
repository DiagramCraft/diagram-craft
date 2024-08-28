import { EditorRegistry } from '@diagram-craft/canvas-app/PropsEditor';
import { ReactElement } from 'react';
import { DynamicAccessor, PropPath, PropPathValue } from '@diagram-craft/utils/propertyPath';
import { Property } from '../../toolwindow/ObjectToolWindow/types';
import { FillColor } from './FillColorEditor';

export type Editor = (props: {
  props: NodeProps | EdgeProps;
  onChange: () => void;
}) => ReactElement;

export const EDITORS: EditorRegistry<Editor> = {
  fill: {
    name: 'Fill',
    editor: FillColor,
    pick: (props: NodeProps | EdgeProps) => ({ fill: props.fill })
  },
  stroke: {
    name: 'Stroke',
    editor: FillColor,
    pick: (props: NodeProps | EdgeProps) => ({ stroke: props.stroke })
  }
};

export function makeProperty<TObj, K extends PropPath<TObj>, V extends PropPathValue<TObj, K>>(
  obj: TObj,
  propertyPath: PropPath<TObj>,
  defaults: TObj,
  onChange: (v: V) => void
): Property<V> {
  const accessor = new DynamicAccessor<TObj>();
  return {
    val: (accessor.get(obj, propertyPath) as V) ?? (accessor.get(defaults, propertyPath) as V),
    set: (v: V) => {
      accessor.set(obj, propertyPath, v);
      onChange(v);
    },
    hasMultipleValues: false
  } as Property<V>;
}
