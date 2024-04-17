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
import { Anchor } from './types';

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

  // TODO: These are a bit weird, considering we allow for multiple registrations
  //       of the same definition
  getDefaultProps(mode: 'picker' | 'canvas'): DeepReadonly<NodeProps>;
  getDefaultAspectRatio(node: DiagramNode): number;
  getDefaultConfig(node: DiagramNode): { size: Extent };

  getAnchors(node: DiagramNode): ReadonlyArray<Anchor>;

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

export type RegistrationOpts = {
  group?: string;
  hidden?: boolean;
  props?: NodeProps;
  key?: string;
};

export type Registration = RegistrationOpts & {
  node: NodeDefinition;
};

const addRegistration = (id: string, reg: Registration, dest: Map<string, Registration[]>) => {
  if (!dest.has(id)) {
    dest.set(id, []);
  }

  const arr = dest.get(id)!;
  if (reg.key && arr.find(e => e.key === reg.key)) {
    arr.splice(
      arr.findIndex(e => e.key === reg.key),
      1,
      reg
    );
  } else {
    arr.push(reg);
  }
};

export class NodeDefinitionRegistry {
  private nodes = new Map<string, Registration[]>();
  private grouping = new Map<string, Registration[]>();

  register(node: NodeDefinition, opts: RegistrationOpts = {}) {
    addRegistration(node.type, { ...opts, node }, this.nodes);

    if (opts.group) {
      addRegistration(opts.group, { ...opts, node }, this.grouping);
    }
  }

  get(type: string): NodeDefinition {
    const r = this.nodes.get(type);

    assert.present(r, 'Not found: ' + type);
    return r[0].node;
  }

  getRegistrations(type: string): Registration[] {
    return this.nodes.get(type) ?? [];
  }

  getGroups() {
    return unique([...this.grouping.keys()]);
  }

  getForGroup(group: string | undefined) {
    if (!group) {
      const dest: Registration[] = [];
      for (const v of this.nodes.values()) {
        for (const r of v) {
          if (r.hidden) continue;
          if (r.group) continue;
          dest.push(r);
        }
      }
      return dest;
    } else {
      return this.grouping.get(group)!.filter(e => !e.hidden);
    }
  }

  getAll() {
    return [...this.nodes.values()].flat().map(e => e.node);
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
