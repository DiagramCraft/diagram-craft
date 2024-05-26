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
import { Box } from '@diagram-craft/geometry/box';

export type NodeCapability = 'children' | 'fill';

// TODO: Make make this into an interface in the global namespace we can extend
// TODO: Should we change these callbacks to have a UOW parameter?
export type CustomPropertyDefinition = {
  id: string;
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
  getCustomProperties(node: DiagramNode): Array<CustomPropertyDefinition>;

  // TODO: These are a bit weird, considering we allow for multiple registrations
  //       of the same definition
  getDefaultProps(mode: 'picker' | 'canvas'): DeepReadonly<NodeProps>;
  getDefaultAspectRatio(node: DiagramNode): number;

  // TODO: Remove this perhaps
  getDefaultConfig(node: DiagramNode): { size: Extent };

  // This returns anchors in diagram coordinates, i.e. rotated and translated
  getAnchors(node: DiagramNode): ReadonlyArray<Anchor>;

  onChildChanged(node: DiagramNode, uow: UnitOfWork): void;
  onTransform(
    transforms: ReadonlyArray<Transform>,
    node: DiagramNode,
    newBounds: Box,
    previousBounds: Box,
    uow: UnitOfWork
  ): void;
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

export type StencilOpts = {
  group?: string;
  hidden?: boolean;
  props?: NodeProps;
  key?: string;
};

// TODO: Change from NodeDefinition to Diagram
export type Stencil = StencilOpts & {
  node: NodeDefinition;
  dimensions?: Extent;
};

export type StencilPackage = {
  name: string;
  stencils: Array<Stencil>;
};

const addRegistration = (id: string, reg: Stencil, dest: Map<string, Stencil[]>) => {
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

const missing = new Set();
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).dump_missing = () => {
    console.log([...missing].join('\n'));
  };
}

export class NodeDefinitionRegistry {
  private nodes = new Map<string, Stencil[]>();
  private grouping = new Map<string, Stencil[]>();

  addGroup(group: string) {
    this.grouping.set(group, []);
  }

  register(node: NodeDefinition, opts: StencilOpts = {}) {
    addRegistration(node.type, { ...opts, node }, this.nodes);

    if (opts.group) {
      addRegistration(opts.group, { ...opts, node }, this.grouping);
    }
  }

  get(type: string): NodeDefinition {
    const r = this.nodes.get(type);

    if (!r) {
      missing.add(type);
      console.warn(`Cannot find shape '${type}'`);
      return this.nodes.get('rect')![0].node;
    }

    assert.present(r, 'Not found: ' + type);
    return r[0].node;
  }

  getRegistration(type: string): Stencil {
    const r = this.nodes.get(type);

    if (!r) {
      missing.add(type);
      console.warn(`Cannot find shape '${type}'`);
      return this.nodes.get('rect')![0];
    }

    assert.present(r, 'Not found: ' + type);
    return r[0];
  }

  getRegistrations(type: string): Stencil[] {
    return this.nodes.get(type) ?? [];
  }

  getGroups() {
    return unique([...this.grouping.keys()]);
  }

  getForGroup(group: string | undefined) {
    if (!group) {
      const dest: Stencil[] = [];
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

  hasRegistration(type: string) {
    return this.nodes.has(type);
  }
}

export type EdgeCapability = 'arrows' | 'fill' | 'line-hops';

export interface EdgeDefinition {
  type: string;
  name: string;

  supports(capability: EdgeCapability): boolean;

  onDrop(
    coord: Point,
    edge: DiagramEdge,
    elements: ReadonlyArray<DiagramElement>,
    uow: UnitOfWork,
    operation: string
  ): void;

  getCustomProperties(edge: DiagramEdge): Array<CustomPropertyDefinition>;
}

export class EdgeDefinitionRegistry {
  private edges = new Map<string, EdgeDefinition>();

  #defaultValue: EdgeDefinition | undefined = undefined;

  set defaultValue(value: EdgeDefinition | undefined) {
    this.#defaultValue = value;
  }

  register(edge: EdgeDefinition) {
    this.edges.set(edge.type, edge);
  }

  get(type: string): EdgeDefinition {
    const r = this.edges.get(type) ?? this.#defaultValue;
    assert.present(r);
    return r;
  }
}
