import { EditorRegistry } from '@diagram-craft/canvas-app/PropsEditor';
import { ReactElement } from 'react';
import { DynamicAccessor, PropPath, PropPathValue } from '@diagram-craft/utils/propertyPath';
import { Property } from '../../toolwindow/ObjectToolWindow/types';
import { NodeFillEditor } from './NodeFillEditor';
import { NodeStrokeEditor } from './NodeStrokeEditor';
import { ElementShadowEditor } from './ElementShadowEditor';

export type Editor = (props: {
  props: NodeProps | EdgeProps;
  onChange: () => void;
}) => ReactElement;

export type EditorTypes = 'node' | 'edge' | 'both';

export const EDITORS: EditorRegistry<Editor, EditorTypes> = {
  fill: {
    name: 'Fill',
    type: 'node',
    editor: NodeFillEditor,
    pick: (props: NodeProps | EdgeProps) => ({ fill: props.fill })
  },
  stroke: {
    name: 'Stroke',
    type: 'node',
    editor: NodeStrokeEditor,
    pick: (props: NodeProps | EdgeProps) => ({ stroke: props.stroke })
  },
  shadow: {
    name: 'Shadow',
    type: 'both',
    editor: ElementShadowEditor,
    pick: (props: NodeProps | EdgeProps) => ({ shadow: props.shadow })
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
