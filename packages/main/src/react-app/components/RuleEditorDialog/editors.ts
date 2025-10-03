import { ReactElement } from 'react';
import { NodeFillEditor } from './NodeFillEditor';
import { NodeStrokeEditor } from './NodeStrokeEditor';
import { ElementShadowEditor } from './ElementShadowEditor';
import { NodeEffectsEditor } from './NodeEffectsEditor';
import { NodeTextEditor } from './NodeTextEditor';
import { NodeAdvancedPropertiesEditor } from './NodeAdvancedPropertiesEditor';
import { NodeCustomPropertiesEditor } from './NodeCustomPropertiesEditor';
import { EdgeCustomPropertiesEditor } from './EdgeCustomPropertiesEditor';
import { EdgeEffectsEditor } from './EdgeEffectsEditor';
import { EdgeLineEditor } from './EdgeLineEditor';
import { NamedIndicatorEditor } from './NamedIndicatorEditor';
import { NodeActionPropertiesEditor } from './NodeActionPropertiesEditor';

export type Editor = (props: {
  props: NodeProps | EdgeProps;
  onChange: () => void;
}) => ReactElement;

export type EditorTypes = 'node' | 'edge';

type Entry<E> = {
  editor: E;
  name: string;
  pick: (props: NodeProps | EdgeProps) => Partial<NodeProps | EdgeProps>;
};

export type NodeEditorRegistry = Record<
  | 'fill'
  | 'stroke'
  | 'shadow'
  | 'effects'
  | 'text'
  | 'nodeCustom'
  | 'indicators'
  | 'action'
  | 'advanced',
  Entry<Editor>
>;

export type EdgeEditorRegistry = Record<
  'shadow' | 'edgeCustom' | 'edgeEffects' | 'edgeLine',
  Entry<Editor>
>;

export const NODE_EDITORS: NodeEditorRegistry = {
  fill: {
    name: 'Fill',
    editor: NodeFillEditor,
    pick: (props: NodeProps | EdgeProps) => ({ fill: props.fill })
  },
  stroke: {
    name: 'Stroke',
    editor: NodeStrokeEditor,
    pick: (props: NodeProps | EdgeProps) => ({ stroke: props.stroke })
  },
  shadow: {
    name: 'Shadow',
    editor: ElementShadowEditor,
    pick: (props: NodeProps | EdgeProps) => ({ shadow: props.shadow })
  },
  effects: {
    name: 'Effects',
    editor: NodeEffectsEditor,
    pick: (props: NodeProps | EdgeProps) => ({ effects: props.effects })
  },
  text: {
    name: 'Text',
    editor: NodeTextEditor,
    pick: (props: NodeProps | EdgeProps) => ({ text: (props as NodeProps).text })
  },
  nodeCustom: {
    name: 'Type specific properties',
    editor: NodeCustomPropertiesEditor,
    pick: (props: NodeProps | EdgeProps) => ({ custom: (props as NodeProps).custom })
  },
  indicators: {
    name: 'Indicator',
    editor: NamedIndicatorEditor,
    pick: (props: NodeProps | EdgeProps) => ({ indicators: (props as NodeProps).indicators })
  },
  action: {
    name: 'Action',
    editor: NodeActionPropertiesEditor,
    pick: (props: NodeProps | EdgeProps) => ({
      action: (props as NodeProps).action
    })
  },
  advanced: {
    name: 'Advanced',
    editor: NodeAdvancedPropertiesEditor,
    pick: (props: NodeProps | EdgeProps) => ({
      capabilities: (props as NodeProps).capabilities
    })
  }
};

export const EDGE_EDITORS: EdgeEditorRegistry = {
  shadow: {
    name: 'Shadow',
    editor: ElementShadowEditor,
    pick: (props: NodeProps | EdgeProps) => ({ shadow: props.shadow })
  },
  edgeCustom: {
    name: 'Type specific properties',
    editor: EdgeCustomPropertiesEditor,
    pick: (props: NodeProps | EdgeProps) => ({ custom: (props as EdgeProps).custom })
  },
  edgeEffects: {
    name: 'Effects',
    editor: EdgeEffectsEditor,
    pick: (props: NodeProps | EdgeProps) => ({ effects: props.effects })
  },
  edgeLine: {
    name: 'Line',
    editor: EdgeLineEditor,
    pick: (props: NodeProps | EdgeProps) => ({
      stroke: props.stroke,
      fill: props.fill,
      type: (props as EdgeProps).type,
      arrow: (props as EdgeProps).arrow,
      lineHops: (props as EdgeProps).lineHops
    })
  }
};
