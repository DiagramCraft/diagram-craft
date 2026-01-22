import { DiagramNode, NodeTexts } from './diagramNode';
import { assert } from '@diagram-craft/utils/assert';
import { DiagramElement } from './diagramElement';
import { Transform } from '@diagram-craft/geometry/transform';
import { Point } from '@diagram-craft/geometry/point';
import { UnitOfWork } from './unitOfWork';
import { Anchor } from './anchor';
import { Box } from '@diagram-craft/geometry/box';
import type { Diagram } from './diagram';
import { newid } from '@diagram-craft/utils/id';
import { unique } from '@diagram-craft/utils/array';
import { EventEmitter } from '@diagram-craft/utils/event';
import { PathList } from '@diagram-craft/geometry/pathList';
import { assertRegularLayer } from './diagramLayerUtils';
import { safeSplit } from '@diagram-craft/utils/safe';
import { ElementFactory } from './elementFactory';
import type { Property } from './property';
import type { EdgeDefinition } from './edgeDefinition';
import type { EdgeProps, ElementMetadata, NodeProps } from './diagramProps';
import { DynamicAccessor, PropPath } from '@diagram-craft/utils/propertyPath';
import { DiagramEdge } from '@diagram-craft/model/diagramEdge';

export type NodeCapability =
  | 'children'
  | 'fill'
  | 'rounding'
  | 'select'
  | 'connect-to-boundary'
  | 'anchors-configurable'
  | 'can-be-container'
  | 'can-have-layout'
  | 'collapsible'
  | 'children.select-parent';

// biome-ignore lint/suspicious/noExplicitAny: convenient
export interface CustomPropertyType<T = any> {
  id: string;
  type: string;
  label: string;

  isSet: boolean;
  value: T;
  set: (value: T | undefined, uow: UnitOfWork) => void;
}

export interface NumberCustomPropertyType extends CustomPropertyType<number> {
  type: 'number';
  minValue?: number;
  maxValue?: number;
  step?: number;
  unit?: string;
}

export interface SelectCustomPropertyType extends CustomPropertyType<string> {
  type: 'select';
  options: ReadonlyArray<{ value: string; label: string }>;
}

export interface BooleanCustomPropertyType extends CustomPropertyType<boolean> {
  type: 'boolean';
}

declare global {
  namespace DiagramCraft {
    interface CustomPropertyTypes {
      number: NumberCustomPropertyType;
      select: SelectCustomPropertyType;
      boolean: BooleanCustomPropertyType;
    }
  }
}

type CommonCustomPropertyOpts<T> = {
  validate?: (value: T) => boolean;
  format?: (value: T) => T;
};

const makeCustomPropertyHelper = <T extends DiagramElement, P>() => {
  return {
    number: (
      el: T,
      label: string,
      property: PropPath<P>,
      opts?: Partial<NumberCustomPropertyType & CommonCustomPropertyOpts<number>>
    ): NumberCustomPropertyType => {
      const acc = new DynamicAccessor<P>();
      return {
        id: label.toLowerCase().replace(/\s/g, '-'),
        type: 'number',
        label,
        isSet: acc.get(el.storedProps as P, property) !== undefined,
        value: acc.get(el.renderProps as P, property) as number,
        set: (value: number | undefined, uow: UnitOfWork) => {
          if (value !== undefined && opts?.validate && !opts.validate(value)) return;
          if (value !== undefined && opts?.format) value = opts.format(value);
          // @ts-expect-error
          el.updateProps(p => acc.set(p, property, value), uow);
        },
        ...opts
      };
    },

    boolean: (
      el: T,
      label: string,
      property: PropPath<P>,
      opts?: Partial<BooleanCustomPropertyType>
    ): BooleanCustomPropertyType => {
      const acc = new DynamicAccessor<P>();
      return {
        id: label.toLowerCase().replace(/\s/g, '-'),
        type: 'boolean',
        label,
        isSet: acc.get(el.storedProps as P, property) !== undefined,
        value: acc.get(el.renderProps as P, property) as boolean,
        set: (value: boolean | undefined, uow: UnitOfWork) => {
          // @ts-expect-error
          el.updateProps(p => acc.set(p, property, value), uow);
        },
        ...opts
      };
    },

    select: (
      el: T,
      label: string,
      property: PropPath<P>,
      options: ReadonlyArray<{ value: string; label: string }>,
      opts?: Partial<SelectCustomPropertyType>
    ): SelectCustomPropertyType => {
      const acc = new DynamicAccessor<P>();
      return {
        id: label.toLowerCase().replace(/\s/g, '-'),
        type: 'select',
        label,
        options,
        isSet: acc.get(el.storedProps as P, property) !== undefined,
        value: acc.get(el.renderProps as P, property) as string,
        set: (value: string | undefined, uow: UnitOfWork) => {
          // @ts-expect-error
          el.updateProps(p => acc.set(p, property, value), uow);
        },
        ...opts
      };
    },

    delimiter: (label: string) => ({ type: 'delimiter', label })
  };
};

export const CustomProperty = {
  node: makeCustomPropertyHelper<DiagramNode, NodeProps>(),
  edge: makeCustomPropertyHelper<DiagramEdge, EdgeProps>()
};

export type CustomPropertyDefinitionEntry =
  | DiagramCraft.CustomPropertyTypes[keyof DiagramCraft.CustomPropertyTypes]
  | { type: 'delimiter'; label: string };

export class CustomPropertyDefinition {
  private readonly arr: Array<CustomPropertyDefinitionEntry>;

  constructor(
    fn: (
      p: (typeof CustomProperty)['node']
    ) => Array<CustomPropertyDefinitionEntry | CustomPropertyDefinition>
  ) {
    this.arr = fn(CustomProperty.node).flatMap(e =>
      e instanceof CustomPropertyDefinition ? e.entries : e
    );
  }

  get entries() {
    return this.arr;
  }
}

export const asProperty = (
  customProp: CustomPropertyType,
  change: (cb: (uow: UnitOfWork) => void) => void
): Property<unknown> => {
  if (!('value' in customProp) || !('set' in customProp)) throw new Error();
  return {
    val: customProp.value,
    set: (v: unknown) => {
      change(uow => {
        // biome-ignore lint/suspicious/noExplicitAny: false positive
        customProp.set(v as any, uow);
      });
    },
    hasMultipleValues: false,
    isSet: customProp.isSet
  };
};

export interface NodeDefinition {
  type: string;
  name: string;

  supports(capability: NodeCapability): boolean;

  getCustomPropertyDefinitions(node: DiagramNode): CustomPropertyDefinition;

  getBoundingPath(node: DiagramNode): PathList;

  // This returns anchors in local coordinates [0-1], [0-1]
  getAnchors(node: DiagramNode): ReadonlyArray<Anchor>;

  onChildChanged(node: DiagramNode, uow: UnitOfWork): void;

  onTransform(
    transforms: ReadonlyArray<Transform>,
    node: DiagramNode,
    newBounds: Box,
    previousBounds: Box,
    uow: UnitOfWork
  ): void;

  onDrop?: (
    coord: Point,
    node: DiagramNode,
    elements: ReadonlyArray<DiagramElement>,
    uow: UnitOfWork,
    operation: string
  ) => void;

  onPropUpdate(node: DiagramNode, uow: UnitOfWork): void;

  requestFocus(node: DiagramNode, selectAll?: boolean): void;
}

const missing = new Set();
if (typeof window !== 'undefined') {
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  (window as any).dump_missing = () => {
    console.log([...missing].join('\n'));
  };
}

// TODO: Rename this to NodeTypeLoader
declare global {
  namespace DiagramCraft {
    interface StencilLoaderOptsExtensions {}
  }
}

export type Stencil = {
  id: string;
  name?: string;
  node: (diagram: Diagram) => DiagramNode;
  canvasNode: (diagram: Diagram) => DiagramNode;
  type: string;
};

export type StencilPackage = {
  id: string;
  name: string;
  group?: string;
  stencils: Array<Stencil>;
  type: string;
};

export type StencilEvents = {
  /* Stencils registered, activated or deactivated */
  change: { stencilRegistry: StencilRegistry };
};

const DELIMITER = '@@';

export class StencilRegistry extends EventEmitter<StencilEvents> {
  private stencils = new Map<string, StencilPackage>();
  private activeStencils = new Set<string>();

  register(pkg: StencilPackage, activate = false) {
    const stencils = pkg.stencils.map(s => ({
      ...s,
      id: pkg.id + DELIMITER + s.id
    }));

    if (this.stencils.has(pkg.id)) {
      this.stencils.get(pkg.id)!.stencils = unique(
        [...(this.stencils.get(pkg.id)?.stencils ?? []), ...stencils],
        e => e.id
      );
    } else {
      this.stencils.set(pkg.id, { ...pkg, stencils });
    }

    if (activate) {
      this.activeStencils.add(pkg.id);
    }

    this.emitAsyncWithDebounce('change', { stencilRegistry: this });
  }

  getStencil(id: string) {
    assert.true(id.includes(DELIMITER), 'Invalid id');
    const [pkgId] = safeSplit(id, DELIMITER, 2);
    return this.get(pkgId).stencils.find(s => s.id === id);
  }

  get(id: string): StencilPackage {
    return this.stencils.get(id)!;
  }

  activate(id: string) {
    this.activeStencils.add(id);

    this.emitAsyncWithDebounce('change', { stencilRegistry: this });
  }

  getActiveStencils() {
    return [...this.activeStencils.values()]
      .filter(s => this.stencils.has(s))
      .map(s => this.stencils.get(s)!);
  }

  search(s: string): Stencil[] {
    const results: Stencil[] = [];
    for (const pkg of this.stencils.values()) {
      if (pkg.name.toLowerCase().includes(s.toLowerCase())) {
        results.push(...pkg.stencils);
      } else {
        for (const stencil of pkg.stencils) {
          if (stencil.name?.toLowerCase().includes(s.toLowerCase())) {
            results.push(stencil);
          }
        }
      }
    }
    return results;
  }
}

export interface StencilLoaderOpts extends DiagramCraft.StencilLoaderOptsExtensions {}

export type StencilLoader<T extends keyof StencilLoaderOpts> = (
  nodeDefinition: NodeDefinitionRegistry,
  opts: StencilLoaderOpts[T]
) => Promise<void>;

export const stencilLoaderRegistry: Partial<{
  [K in keyof StencilLoaderOpts]: () => Promise<StencilLoader<K>>;
}> = {};

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

  list() {
    return this.nodes.keys();
  }

  async load(s: string): Promise<boolean> {
    if (this.hasRegistration(s)) return true;

    const idx = this.preRegistrations.findIndex(a => a.shapes.test(s));
    if (idx === -1) return false;

    const entry = this.preRegistrations[idx]!;
    //this.preRegistrations.splice(idx, 1);

    const loader = stencilLoaderRegistry[entry.type];
    assert.present(loader, `Stencil loader ${entry.type} not found`);

    const l = await loader();
    // biome-ignore lint/suspicious/noExplicitAny: false positive
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

    assert.present(r, `Not found: ${type}`);
    return r;
  }

  hasRegistration(type: string) {
    return this.nodes.has(type);
  }
}

export class EdgeDefinitionRegistry {
  private edges = new Map<string, EdgeDefinition>();

  #defaultValue: EdgeDefinition | undefined = undefined;

  set defaultValue(value: EdgeDefinition | undefined) {
    this.#defaultValue = value;
  }

  list() {
    return this.edges.keys();
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

export type Definitions = {
  nodeDefinitions: NodeDefinitionRegistry;
  edgeDefinitions: EdgeDefinitionRegistry;
};

const isNodeDefinition = (type: string | NodeDefinition): type is NodeDefinition =>
  typeof type !== 'string';

export type MakeStencilNodeOpts = {
  id?: string;
  name?: string;
  aspectRatio?: number;
  size?: { w: number; h: number };
  props?: MakeStencilNodeOptsProps;
  metadata?: ElementMetadata;
  texts?: NodeTexts;
};

export type MakeStencilNodeOptsProps = (t: 'picker' | 'canvas') => Partial<NodeProps>;

export const makeStencilNode =
  (type: string | NodeDefinition, t: 'picker' | 'canvas', opts?: MakeStencilNodeOpts) =>
  ($d: Diagram) => {
    return UnitOfWork.execute($d, uow => {
      const typeId = isNodeDefinition(type) ? type.type : type;

      const layer = $d.activeLayer;
      assertRegularLayer(layer);

      const n = ElementFactory.node(
        newid(),
        typeId,
        Box.applyAspectRatio(
          { x: 0, y: 0, w: $d.bounds.w, h: $d.bounds.h, r: 0 },
          opts?.aspectRatio ?? 1
        ),
        layer,
        opts?.props?.(t) ?? {},
        opts?.metadata ?? {},
        opts?.texts
      );

      const size = { w: 100, h: 100 };

      n.setBounds(
        Box.applyAspectRatio(
          { x: 0, y: 0, w: opts?.size?.w ?? size.w, h: opts?.size?.h ?? size.h, r: 0 },
          opts?.aspectRatio ?? 1
        ),
        uow
      );

      return n;
    });
  };

export const registerStencil = (
  reg: NodeDefinitionRegistry,
  pkg: StencilPackage,
  def: NodeDefinition,
  opts?: MakeStencilNodeOpts
) => {
  reg.register(def);
  pkg.stencils.push({
    id: opts?.id ?? def.type,
    name: opts?.name ?? def.name,
    node: makeStencilNode(def, 'picker', opts),
    canvasNode: makeStencilNode(def, 'canvas', opts),
    type: pkg.type
  });
};
