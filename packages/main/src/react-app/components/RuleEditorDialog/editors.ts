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
  props: DiagramCraft.NodeProps | DiagramCraft.EdgeProps;
  onChange: () => void;
}) => ReactElement;

export type EditorTypes = 'node' | 'edge';

type Entry<E> = {
  editor: E;
  name: string;
  pick: (
    props: DiagramCraft.NodeProps | DiagramCraft.EdgeProps
  ) => Partial<DiagramCraft.NodeProps | DiagramCraft.EdgeProps>;
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
    pick: (props: DiagramCraft.NodeProps | DiagramCraft.EdgeProps) => ({ fill: props.fill })
  },
  stroke: {
    name: 'Stroke',
    editor: NodeStrokeEditor,
    pick: (props: DiagramCraft.NodeProps | DiagramCraft.EdgeProps) => ({ stroke: props.stroke })
  },
  shadow: {
    name: 'Shadow',
    editor: ElementShadowEditor,
    pick: (props: DiagramCraft.NodeProps | DiagramCraft.EdgeProps) => ({ shadow: props.shadow })
  },
  effects: {
    name: 'Effects',
    editor: NodeEffectsEditor,
    pick: (props: DiagramCraft.NodeProps | DiagramCraft.EdgeProps) => ({ effects: props.effects })
  },
  text: {
    name: 'Text',
    editor: NodeTextEditor,
    pick: (props: DiagramCraft.NodeProps | DiagramCraft.EdgeProps) => ({
      text: (props as DiagramCraft.NodeProps).text
    })
  },
  nodeCustom: {
    name: 'Type specific properties',
    editor: NodeCustomPropertiesEditor,
    pick: (props: DiagramCraft.NodeProps | DiagramCraft.EdgeProps) => ({
      custom: (props as DiagramCraft.NodeProps).custom
    })
  },
  indicators: {
    name: 'Indicator',
    editor: NamedIndicatorEditor,
    pick: (props: DiagramCraft.NodeProps | DiagramCraft.EdgeProps) => ({
      indicators: (props as DiagramCraft.NodeProps).indicators
    })
  },
  action: {
    name: 'Action',
    editor: NodeActionPropertiesEditor,
    pick: (props: DiagramCraft.NodeProps | DiagramCraft.EdgeProps) => ({
      action: (props as DiagramCraft.NodeProps).action
    })
  },
  advanced: {
    name: 'Advanced',
    editor: NodeAdvancedPropertiesEditor,
    pick: (props: DiagramCraft.NodeProps | DiagramCraft.EdgeProps) => ({
      capabilities: (props as DiagramCraft.NodeProps).capabilities
    })
  }
};

export const EDGE_EDITORS: EdgeEditorRegistry = {
  shadow: {
    name: 'Shadow',
    editor: ElementShadowEditor,
    pick: (props: DiagramCraft.NodeProps | DiagramCraft.EdgeProps) => ({ shadow: props.shadow })
  },
  edgeCustom: {
    name: 'Type specific properties',
    editor: EdgeCustomPropertiesEditor,
    pick: (props: DiagramCraft.NodeProps | DiagramCraft.EdgeProps) => ({
      custom: (props as DiagramCraft.EdgeProps).custom
    })
  },
  edgeEffects: {
    name: 'Effects',
    editor: EdgeEffectsEditor,
    pick: (props: DiagramCraft.NodeProps | DiagramCraft.EdgeProps) => ({ effects: props.effects })
  },
  edgeLine: {
    name: 'Line',
    editor: EdgeLineEditor,
    pick: (props: DiagramCraft.NodeProps | DiagramCraft.EdgeProps) => ({
      stroke: props.stroke,
      fill: props.fill,
      type: (props as DiagramCraft.EdgeProps).type,
      arrow: (props as DiagramCraft.EdgeProps).arrow,
      lineHops: (props as DiagramCraft.EdgeProps).lineHops
    })
  }
};
