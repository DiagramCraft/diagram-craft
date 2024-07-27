import { DiagramNode, NodePropsForEditing } from './diagramNode';
import { assert } from '@diagram-craft/utils/assert';
import { DiagramElement } from './diagramElement';
import { DiagramEdge } from './diagramEdge';
import { CompoundPath } from '@diagram-craft/geometry/pathBuilder';
import { Extent } from '@diagram-craft/geometry/extent';
import { Transform } from '@diagram-craft/geometry/transform';
import { Point } from '@diagram-craft/geometry/point';
import { UnitOfWork } from './unitOfWork';
import { Anchor } from './anchor';
import { Box } from '@diagram-craft/geometry/box';
import { Diagram } from './diagram';
import { newid } from '@diagram-craft/utils/id';
import { unique } from '@diagram-craft/utils/array';
import { deepMerge } from '@diagram-craft/utils/object';
import { DiagramDocument } from './diagramDocument';
import { Layer } from './diagramLayer';
import { deserializeDiagramElements } from './serialization/deserialize';
import { EventEmitter } from '@diagram-craft/utils/event';
import { stencilLoaderRegistry } from '@diagram-craft/canvas-app/loaders';

export type NodeCapability =
  | 'children'
  | 'fill'
  | 'select'
  | 'connect-to-boundary'
  | 'custom-anchors';

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
  getCustomProperties(node: DiagramNode): Array<CustomPropertyDefinition>;

  getBoundingPath(node: DiagramNode): CompoundPath;

  // TODO: These are a bit weird, considering we allow for multiple registrations
  //       of the same definition
  getDefaultMetadata(mode: 'picker' | 'canvas'): ElementMetadata;
  getDefaultProps(mode: 'picker' | 'canvas'): NodePropsForEditing;
  getDefaultAspectRatio(node: DiagramNode): number;

  // TODO: Remove this perhaps
  getDefaultConfig(node: DiagramNode): { size: Extent };

  // This returns anchors in diagram coordinates, i.e. rotated and translated
  getAnchors(node: DiagramNode): ReadonlyArray<Anchor>;

  layoutChildren(node: DiagramNode, uow: UnitOfWork): void;

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

  requestFocus(node: DiagramNode, selectAll?: boolean): void;
}

const missing = new Set();
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).dump_missing = () => {
    console.log([...missing].join('\n'));
  };
}

type PreregistrationEntry<K extends keyof StencilLoaderOpts> = {
  type: K;
  shapes: RegExp;
  opts: StencilLoaderOpts[K];
};

export class NodeDefinitionRegistry {
  private nodes = new Map<string, NodeDefinition>();
  private preRegistrations: Array<PreregistrationEntry<keyof StencilLoaderOpts>> = [];

  public stencilRegistry = new StencilRegistry();

  preregister<K extends keyof StencilLoaderOpts>(
    shapes: RegExp,
    type: K,
    opts: StencilLoaderOpts[K]
  ) {
    this.preRegistrations.push({ shapes, type, opts });
  }

  async load(s: string): Promise<boolean> {
    if (this.hasRegistration(s)) return true;

    const idx = this.preRegistrations.findIndex(a => a.shapes.test(s));
    if (idx === -1) return false;

    const entry = this.preRegistrations[idx];
    //this.preRegistrations.splice(idx, 1);

    const loader = stencilLoaderRegistry[entry.type];
    assert.present(loader, `Stencil loader ${entry.type} not found`);

    const l = await loader();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await l(this, entry.opts as any);

    return true;
  }

  register(node: NodeDefinition) {
    this.nodes.set(node.type, node);
    return node;
  }

  get(type: string): NodeDefinition {
    const r = this.nodes.get(type);

    if (!r) {
      missing.add(type);
      console.warn(`Cannot find shape '${type}'`);
      return this.nodes.get('rect')!;
    }

    assert.present(r, 'Not found: ' + type);
    return r;
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

const isNodeDefinition = (type: string | NodeDefinition): type is NodeDefinition =>
  typeof type !== 'string';

export type MakeStencilNodeOpts = {
  id?: string;
  name?: string;
  aspectRatio?: number;
  size?: { w: number; h: number };
  props?: MakeStencilNodeOptsProps;
};

export type MakeStencilNodeOptsProps = (t: 'picker' | 'canvas') => Partial<NodeProps>;

export const makeStencilNode =
  (type: string | NodeDefinition, opts?: MakeStencilNodeOpts) => ($d: Diagram) => {
    const typeId = isNodeDefinition(type) ? type.type : type;
    const typeDef = $d.document.nodeDefinitions.get(typeId);

    const n = new DiagramNode(
      newid(),
      typeId,
      Box.applyAspectRatio(
        { x: 0, y: 0, w: $d.canvas.w, h: $d.canvas.h, r: 0 },
        opts?.aspectRatio ?? 1
      ),
      $d,
      $d.layers.active,
      deepMerge(typeDef.getDefaultProps('picker'), {
        ...(opts?.props?.('picker') ?? {})
      }),
      typeDef.getDefaultMetadata('picker')
    );

    const size = typeDef.getDefaultConfig(n).size;

    n.setBounds(
      Box.applyAspectRatio(
        { x: 0, y: 0, w: opts?.size?.w ?? size.w, h: opts?.size?.h ?? size.h, r: 0 },
        opts?.aspectRatio ?? 1
      ),
      UnitOfWork.immediate($d)
    );

    return n;
  };

export const registerStencil = (
  reg: NodeDefinitionRegistry,
  pkg: StencilPackage,
  def: NodeDefinition,
  opts?: MakeStencilNodeOpts
) => {
  pkg.stencils.push({
    id: opts?.id ?? def.type,
    name: opts?.name ?? def.name,
    node: makeStencilNode(reg.register(def), opts)
  });
};

export type Stencil = {
  id: string;
  name?: string;
  node: (diagram: Diagram) => DiagramNode;
};

export type StencilPackage = {
  id: string;
  name: string;
  group?: string;
  stencils: Array<Stencil>;
};

export type StencilEvents = {
  /* Stencils registered, activated or deactivated */
  change: { stencilRegistry: StencilRegistry };
};

export class StencilRegistry extends EventEmitter<StencilEvents> {
  private stencils = new Map<string, StencilPackage>();
  private activeStencils = new Set<string>();

  register(pkg: StencilPackage, activate = false) {
    if (this.stencils.has(pkg.id)) {
      this.stencils.get(pkg.id)!.stencils = unique(
        [...this.stencils.get(pkg.id)!.stencils, ...pkg.stencils],
        e => e.id
      );
    } else {
      this.stencils.set(pkg.id, pkg);
    }

    if (activate) {
      this.activeStencils.add(pkg.id);
    }

    this.emitAsync('change', { stencilRegistry: this });
  }

  get(id: string): StencilPackage {
    return this.stencils.get(id)!;
  }

  activate(id: string) {
    this.activeStencils.add(id);

    this.emitAsync('change', { stencilRegistry: this });
  }

  getActiveStencils() {
    return [...this.activeStencils.values()]
      .filter(s => this.stencils.has(s))
      .map(s => this.stencils.get(s)!);
  }
}

// eslint-disable-next-line
export const loadStencilsFromYaml = (stencils: any) => {
  const dest: Array<Stencil> = [];
  for (const stencil of stencils.stencils) {
    dest.push({
      id: stencil.id,
      name: stencil.name,
      node: (diagram: Diagram) => {
        const uow = UnitOfWork.immediate(diagram);

        const dest = new Diagram(
          newid(),
          stencil.name,
          new DiagramDocument(diagram.document.nodeDefinitions, diagram.document.edgeDefinitions)
        );

        dest.layers.add(new Layer('default', 'Default', [], dest), uow);

        const node = deserializeDiagramElements(
          [stencil.node],
          dest,
          dest.layers.active,
          {},
          {}
        )[0] as DiagramNode;
        dest.layers.active.addElement(node, uow);

        return node;
      }
    });
  }
  return dest;
};
