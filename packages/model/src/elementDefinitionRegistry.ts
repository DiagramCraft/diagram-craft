import { DiagramNode } from './diagramNode';
import { assert } from '@diagram-craft/utils';
import { UnitOfWork } from './index';
import { DiagramElement } from './diagramElement';
import { DiagramEdge } from './diagramEdge';
import { DeepReadonly } from '@diagram-craft/utils';
import { Extent, Path, PathBuilder, Point, Transform } from '@diagram-craft/geometry';

export type NodeCapability = 'children';

// TODO: Make make this into an interface in the global namespace we can extend
// TODO: Should we change these callbacks to have a UOW parameter?
export type CustomPropertyDefinition = {
  label: string;
} & (
  | {
      type: 'number';
      value: number;
      minValue?: number;
      maxValue?: number;
      step?: number;
      unit?: string;
      onChange: (value: number, uow: UnitOfWork) => void;
    }
  | {
      type: 'select';
      value: string;
      options: ReadonlyArray<{ value: string; label: string }>;
      onChange: (value: string, uow: UnitOfWork) => void;
    }
  | {
      type: 'boolean';
      value: boolean;
      onChange: (value: boolean, uow: UnitOfWork) => void;
    }
);

export interface NodeDefinition {
  type: string;
  name: string;

  supports(capability: NodeCapability): boolean;

  getBoundingPathBuilder(node: DiagramNode): PathBuilder;
  getBoundingPath(node: DiagramNode): Path;
  getCustomProperties(node: DiagramNode): Record<string, CustomPropertyDefinition>;

  getDefaultProps(mode: 'picker' | 'canvas'): DeepReadonly<NodeProps>;

  // TODO: This should support adding children and more than just the size
  getInitialConfig(): { size: Extent };

  onChildChanged(node: DiagramNode, uow: UnitOfWork): void;
  onTransform(transforms: ReadonlyArray<Transform>, node: DiagramNode, uow: UnitOfWork): void;
  onDrop(
    coord: Point,
    node: DiagramNode,
    elements: ReadonlyArray<DiagramElement>,
    uow: UnitOfWork,
    operation: string
  ): void;
  onPropUpdate(node: DiagramNode, uow: UnitOfWork): void;

  requestFocus(node: DiagramNode): void;
}

export class NodeDefinitionRegistry {
  private nodes = new Map<string, NodeDefinition>();

  register(node: NodeDefinition) {
    this.nodes.set(node.type, node);
  }

  get(type: string): NodeDefinition {
    const r = this.nodes.get(type);
    assert.present(r, 'Not found: ' + type);
    return r;
  }

  getAll() {
    return [...this.nodes.values()];
  }
}

export type EdgeCapability = string;

export interface EdgeDefinition {
  type: string;

  supports(capability: EdgeCapability): boolean;

  onDrop(
    coord: Point,
    edge: DiagramEdge,
    elements: ReadonlyArray<DiagramElement>,
    uow: UnitOfWork,
    operation: string
  ): void;
}

export class EdgeDefinitionRegistry {
  private edges = new Map<string, EdgeDefinition>();

  register(edge: EdgeDefinition) {
    this.edges.set(edge.type, edge);
  }

  get(type: string): EdgeDefinition {
    const r = this.edges.get(type);
    assert.present(r);
    return r;
  }
}
