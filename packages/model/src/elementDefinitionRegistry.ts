import { DiagramNode, NodeTexts } from './diagramNode';
import { assert } from '@diagram-craft/utils/assert';
import { DiagramElement } from './diagramElement';
import { Transform } from '@diagram-craft/geometry/transform';
import { _p, Point } from '@diagram-craft/geometry/point';
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
import type { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { FreeEndpoint } from '@diagram-craft/model/endpoint';

/**
 * Node capability flags that control various node behaviors and features.
 *
 * These capabilities are used throughout the canvas system to conditionally enable/disable
 * features, render UI panels, and control node behavior. Check capabilities using
 * `node.getDefinition().supports('capability-name')`.
 *
 * @see {@link NodeDefinition.supports}
 */
export type NodeCapability =
  /**
   * Whether a node can contain child elements.
   *
   * When enabled, the node appears as expandable in the layer panel and supports nesting.
   * Default: false
   *
   * @example
   * Group, Table, TableRow, layout containers
   */
  | 'children.allowed'

  /**
   * Whether a node can have fill properties (colors, gradients, patterns).
   *
   * When disabled, fill is set to 'none' in rendering, sketch fill effects are skipped,
   * and the fill panel is hidden in the UI.
   * Default: true
   *
   * @example
   * Disabled by: CurlyBracket, Table, TableRow
   */
  | 'style.fill'

  /**
   * Whether corner rounding effects can be applied to the node's path.
   *
   * When disabled, the rounding effects panel is hidden.
   * Default: true
   */
  | 'style.rounding'

  /**
   * Whether edges can connect to any point on the node's boundary (not just predefined anchors).
   *
   * When disabled, only edge anchors are used for connections. The implementation uses
   * a 5px preference threshold for anchor points.
   * Default: true
   *
   * @example
   * Disabled by: UmlLifeline
   * @see packages/model/src/anchor.ts:241-258
   */
  | 'connect-to-boundary'

  /**
   * Whether the anchor strategy can be changed.
   *
   * Allows configuration of anchor strategies: shape-defaults, per-edge, per-path,
   * north-south, east-west, directions, custom, none.
   * When disabled, the anchors configuration panel is hidden.
   * Default: true
   *
   * @example
   * Disabled by: CurlyBracket, UmlLifeline, UmlDestroy
   */
  | 'anchors-configurable'

  /**
   * Whether a node can serve as a container in layout operations.
   *
   * Used to filter available shapes when changing selection to container types.
   * Different from 'children' - affects layout system eligibility rather than parent-child relationships.
   * Default: true
   *
   * @example
   * Disabled by: Table, TableRow, FlexShapeNodeDefinition (when not a group)
   */
  | 'can-be-container'

  /**
   * Whether a node supports the auto-layout system.
   *
   * Enables group layout, container padding, and layout tree traversal for nested containers.
   * When enabled, the layout controls panel becomes available.
   * Default: false
   *
   * @example
   * Enabled by: LayoutCapableShapeNodeDefinition subclasses (except BPMNChoreographyActivity)
   */
  | 'can-have-layout'

  /**
   * Whether a node can be toggled between expanded and collapsed states.
   *
   * When enabled, a collapse/expand toggle button is rendered and children can be hidden.
   * Default: false
   *
   * @example
   * Enabled by: LayoutCapableShapeNodeDefinition subclasses
   * @see packages/canvas/src/shape/collapsible.ts:27, 130
   */
  | 'collapsible'

  /**
   * Whether clicking a child selects the parent instead (group selection behavior).
   *
   * When enabled:
   * - First click on child selects parent
   * - Second click "drills down" to select child
   *
   * Default: false
   *
   * @example
   * Enabled by: Group, BPMNChoreographyActivity
   * @see packages/canvas/src/tools/moveTool.ts:103-116
   */
  | 'children.select-parent'

  /**
   * Whether the parent exclusively manages child lifecycle (prevents independent deletion).
   *
   * When enabled, children cannot be deleted independently.
   * Default: false
   *
   * @example
   * Enabled by: TableRow (table cells managed by table structure)
   * @see packages/canvas-app/src/actions/selectionDeleteAction.ts:45
   */
  | 'children.managed-by-parent';

// biome-ignore lint/suspicious/noExplicitAny: convenient
export interface CustomPropertyType<T = any> {
  id: string;
  type: string;
  label: string;

  isSet: boolean;
  get: () => T;
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
        get: () => acc.get(el.renderProps as P, property) as number,
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
        get: () => acc.get(el.renderProps as P, property) as boolean,
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
        get: () => acc.get(el.renderProps as P, property) as string,
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

  /**
   * This indicates schemas that cannot be removed from the nodes
   * and that will be displayed in a more prominent way.
   */
  dataSchemas: DataSchema[] = [];

  constructor(
    fn?: (
      p: (typeof CustomProperty)['node']
    ) => Array<CustomPropertyDefinitionEntry | CustomPropertyDefinition>
  ) {
    this.arr =
      fn?.(CustomProperty.node).flatMap(e =>
        e instanceof CustomPropertyDefinition ? e.entries : e
      ) ?? [];
  }

  get entries() {
    return this.arr;
  }
}

export const asProperty = (
  customProp: CustomPropertyType,
  change: (cb: (uow: UnitOfWork) => void) => void
): Property<unknown> => {
  if (!('get' in customProp) || !('set' in customProp)) throw new Error();
  return {
    val: customProp.get(),
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

  onAdd(node: DiagramNode, diagram: Diagram, uow: UnitOfWork): void;

  requestFocus(node: DiagramNode, selectAll?: boolean): void;
}

const missing = new Set();
if (typeof window !== 'undefined') {
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  (window as any).dump_missing = () => {
    console.log([...missing].join('\n'));
  };
}

declare global {
  namespace DiagramCraft {
    interface StencilLoaderOptsExtensions {}
  }
}

export type StencilElements = { bounds: Box; elements: DiagramElement[] };

export type Stencil = {
  id: string;
  name?: string;
  elementsForPicker: (diagram: Diagram) => StencilElements;
  elementsForCanvas: (diagram: Diagram) => StencilElements;
  type: 'default' | string;
};

export type StencilPackage = {
  id: string;
  name: string;
  group?: string;
  stencils: Array<Stencil>;
  type: 'default' | string;

  subPackages?: Array<{
    id: string;
    name: string;
    stencils: Array<Stencil>;
  }>;
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
    if (id.includes(DELIMITER)) {
      const [pkgId] = safeSplit(id, DELIMITER, 2);
      return this.get(pkgId).stencils.find(s => s.id === id);
    } else {
      return this.stencils
        .values()
        .flatMap(pkg => [...pkg.stencils, ...(pkg.subPackages?.flatMap(p => p.stencils) ?? [])])
        .find(s => s.id === id);
    }
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
  registry: Registry,
  opts: StencilLoaderOpts[T]
) => Promise<void>;

export const stencilLoaderRegistry: Partial<{
  [K in keyof StencilLoaderOpts]: () => Promise<StencilLoader<K>>;
}> = {};

export type NodeDefinitionLoader = (nodes: NodeDefinitionRegistry) => Promise<void>;
export type EdgeDefinitionLoader = (edges: EdgeDefinitionRegistry) => Promise<void>;

export type LazyElementLoaderEntry = {
  shapes: RegExp;
  nodeDefinitionLoader?: () => Promise<NodeDefinitionLoader>;
  edgeDefinitionLoader?: () => Promise<EdgeDefinitionLoader>;
};

declare global {
  namespace DiagramCraft {
    interface StencilLoaderOptsExtensions {
      basic: {
        loader: () => Promise<(registry: Registry) => Promise<void>>;
      };
    }
  }
}

export const stencilLoaderBasic: StencilLoader<'basic'> = async (registry, opts) => {
  await (
    await opts.loader()
  )(registry);
};

export class NodeDefinitionRegistry {
  private nodes = new Map<string, NodeDefinition>();

  constructor(private readonly lazyNodeLoaders: Array<LazyElementLoaderEntry> = []) {}

  list() {
    return this.nodes.keys();
  }

  async load(s: string): Promise<boolean> {
    if (this.hasRegistration(s)) return true;

    const idx = this.lazyNodeLoaders.findIndex(a => a.shapes.test(s));
    if (idx === -1) return false;

    const entry = this.lazyNodeLoaders[idx]!;
    assert.present(entry.nodeDefinitionLoader, `No node definition loader for ${s}`);

    const loader = await entry.nodeDefinitionLoader();
    await loader(this);

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
      console.warn(`Cannot find shape '${type}'`, new Error().stack);
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

  constructor(
    private readonly defaultValue: EdgeDefinition,
    private readonly lazyNodeLoaders: Array<LazyElementLoaderEntry> = []
  ) {}

  list() {
    return this.edges.keys();
  }

  async load(s: string): Promise<boolean> {
    if (this.hasRegistration(s)) return true;

    const idx = this.lazyNodeLoaders.findIndex(a => a.shapes.test(s));
    if (idx === -1) return false;

    const entry = this.lazyNodeLoaders[idx]!;
    assert.present(entry.edgeDefinitionLoader, `No edge definition loader for ${s}`);

    const loader = await entry.edgeDefinitionLoader();
    await loader(this);

    return true;
  }

  register(edge: EdgeDefinition) {
    this.edges.set(edge.type, edge);
  }

  get(type: string): EdgeDefinition {
    const r = this.edges.get(type) ?? this.defaultValue;
    assert.present(r);
    return r;
  }

  hasRegistration(type: string) {
    return this.edges.has(type);
  }
}

export type Registry = {
  nodes: NodeDefinitionRegistry;
  edges: EdgeDefinitionRegistry;
  stencils: StencilRegistry;
};

export type MakeStencilNodeOpts = {
  id?: string;
  name?: string;
  aspectRatio?: number;
  size?: { w: number; h: number };
  props?: MakeStencilNodeOptsProps;
  metadata?: ElementMetadata;
  texts?: NodeTexts;
  subPackage?: string;
};

export type MakeStencilNodeOptsProps = (t: 'picker' | 'canvas') => Partial<NodeProps | EdgeProps>;

export const makeStencilNode =
  (typeId: string, t: 'picker' | 'canvas', opts?: MakeStencilNodeOpts) => ($d: Diagram) =>
    UnitOfWork.execute($d, uow => {
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
        (opts?.props?.(t) ?? {}) as NodeProps,
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

      return { bounds: n.bounds, elements: [n] };
    });

export const makeStencilEdge =
  (typeId: string, t: 'picker' | 'canvas', opts?: MakeStencilNodeOpts) => ($d: Diagram) =>
    UnitOfWork.execute($d, _uow => {
      const layer = $d.activeLayer;
      assertRegularLayer(layer);

      const e = ElementFactory.edge(
        newid(),
        new FreeEndpoint(_p(0, 50)),
        new FreeEndpoint(_p(100, 50)),
        { ...(opts?.props?.(t) ?? {}), shape: typeId } as EdgeProps,
        opts?.metadata ?? {},
        [],
        layer
      );

      return { bounds: Box.from({ w: 100, h: 100 }), elements: [e] };
    });

export const addStencil = (
  pkg: StencilPackage,
  def: NodeDefinition | EdgeDefinition,
  opts?: MakeStencilNodeOpts
) => {
  if ((pkg.subPackages ?? []).length > 0) {
    assert.true(!!opts?.subPackage);
  }

  const isNodeDef = 'getBoundingPath' in def;
  const stencil = {
    id: opts?.id ?? def.type,
    name: opts?.name ?? def.name,
    elementsForPicker: isNodeDef
      ? makeStencilNode(def.type, 'picker', opts)
      : makeStencilEdge(def.type, 'picker', opts),
    elementsForCanvas: isNodeDef
      ? makeStencilNode(def.type, 'canvas', opts)
      : makeStencilEdge(def.type, 'canvas', opts),
    type: pkg.type
  };

  if (opts?.subPackage) {
    pkg.subPackages!.find(p => p.id === opts.subPackage)!.stencils.push(stencil);
  } else {
    pkg.stencils.push(stencil);
  }
};
