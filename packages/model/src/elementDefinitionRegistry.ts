import { DiagramNode } from './diagramNode';
import { assert } from '@diagram-craft/utils/assert';
import { DiagramElement } from './diagramElement';
import { DiagramEdge } from './diagramEdge';
import { CompoundPath, PathBuilder } from '@diagram-craft/geometry/pathBuilder';
import { Extent } from '@diagram-craft/geometry/extent';
import { Transform } from '@diagram-craft/geometry/transform';
import { Point } from '@diagram-craft/geometry/point';
import { UnitOfWork } from './unitOfWork';
import { DeepReadonly } from '@diagram-craft/utils/types';
import { unique } from '@diagram-craft/utils/array';

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
  getBoundingPath(node: DiagramNode): CompoundPath;
  getCustomProperties(node: DiagramNode): Record<string, CustomPropertyDefinition>;

  getDefaultProps(mode: 'picker' | 'canvas'): DeepReadonly<NodeProps>;

  getDefaultAspectRatio(): number;

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
  private grouping = new Map<string, string>();

  register(node: NodeDefinition, group?: string) {
    this.nodes.set(node.type, node);
    if (group) {
      this.grouping.set(node.type, group);
    }
  }

  get(type: string): NodeDefinition {
    const r = this.nodes.get(type);
    assert.present(r, 'Not found: ' + type);
    return r;
  }

  getGroups() {
    return unique([...this.grouping.values()]);
  }

  getForGroup(group: string | undefined) {
    if (!group) {
      const dest: NodeDefinition[] = [];
      for (const [k, v] of this.nodes) {
        if (this.grouping.has(k)) continue;
        dest.push(v);
      }
      return dest;
    }
    const nodes = [...this.grouping.entries()].filter(([, v]) => v === group).map(([k]) => k);
    return nodes.map(n => this.get(n));
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
