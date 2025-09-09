import { DeepPartial, DeepRequired, makeWriteable } from '@diagram-craft/utils/types';
import { deepMerge, isObj, unfoldObject } from '@diagram-craft/utils/object';
import type { NodePropsForRendering } from './diagramNode';
import type { EdgePropsForRendering } from './diagramEdge';
import type { ElementPropsForRendering } from './diagramElement';
import { DynamicAccessor, PropPath, PropPathValue } from '@diagram-craft/utils/propertyPath';
import { assert } from '@diagram-craft/utils/assert';

export const DiagramDefaultsPrivate = {
  isSameAsDefaults(props: Record<string, unknown>, defaults: Record<string, unknown>): boolean {
    if (props !== undefined && defaults === undefined) return false;
    for (const key of Object.keys(props)) {
      if (isObj(props[key])) {
        // In case we add props that are not part of the defaults object, this
        // is still considered same as defaults
        if (defaults[key] === undefined) continue;
        if (
          !DiagramDefaultsPrivate.isSameAsDefaults(
            props[key],
            defaults[key] as Record<string, unknown>
          )
        ) {
          return false;
        }
      } else if (props[key] !== defaults[key]) {
        return false;
      }
    }
    return true;
  },

  /**
   * Extracts and returns a suffix from a given key based on a provided prefix length.
   *
   * This takes property like a.b.c.d.e, with a pattern such as a.b.* and extracts d.e
   * key='a.b.c.d.e', p='a.b]
   *
   * @param key - The full string key from which the suffix is derived.
   * @param pattern - The prefix string used to determine the starting point for suffix extraction.
   * @return The extracted suffix obtained by removing the prefix and processing the remaining string.
   */
  getSuffix(key: string, pattern: string) {
    return key
      .slice(pattern.length + 1)
      .split('.')
      .slice(1)
      .join('.');
  }
};

export class Defaults<T> {
  private readonly defaults: Record<string, unknown>;
  private readonly patterns: Record<string, Record<string, unknown>> = {};

  private cachedDefaultsObject: T | undefined;
  private cachedPatternDefaultsObjects: Record<string, unknown> | undefined;

  constructor(defaults?: DeepPartial<T>) {
    this.defaults = unfoldObject({}, defaults ?? {});
  }

  get<K extends PropPath<T>>(key: K): PropPathValue<T, K> | undefined {
    return this.getRaw(key) as PropPathValue<T, K> | undefined;
  }

  getRaw(key: string, failOnMissing = true): unknown | undefined {
    const v = this.defaults[key];
    if (v !== undefined) return v;

    // Attempt to use patterns
    for (const p of Object.keys(this.patterns)) {
      if (key === p) return {};
      else if (key.startsWith(p)) {
        const k = DiagramDefaultsPrivate.getSuffix(key, p);

        if (k === '') return this.patterns[p];

        const v = this.patterns[p][k];
        if (v !== undefined) return v;
      }
    }

    if (failOnMissing) {
      throw new Error(`Property ${key} is not defined in defaults`);
    }

    return undefined;
  }

  add<K extends PropPath<T>>(key: K, value: PropPathValue<T, K>): void {
    this.cachedDefaultsObject = undefined;

    unfoldObject(this.defaults, value, key.split('.'));
  }

  addPattern<K extends PropPath<T>>(key: `${K}.*`, value: unknown): void {
    this.cachedDefaultsObject = undefined;
    this.cachedPatternDefaultsObjects = undefined;

    const offset = '.*'.length;
    this.patterns[key.slice(0, -offset)] ??= {};
    unfoldObject(this.patterns[key.slice(0, -offset)], value);
  }

  applyDefaults(props: DeepPartial<T>): T {
    this.cachedDefaultsObject ??= this.createDefaultsObject();
    assert.present(this.cachedDefaultsObject);

    this.cachedPatternDefaultsObjects ??= this.createPatternDefaultsObject();

    // Handle patterns
    const patternDefaults = {};
    const accessor = new DynamicAccessor<DeepPartial<T>>();
    for (const [key, value] of Object.entries(this.cachedPatternDefaultsObjects!)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      accessor.set(patternDefaults, key as PropPath<DeepPartial<T>>, {} as any);

      const patternRoot = accessor.get(props, key as PropPath<DeepPartial<T>>);
      if (!patternRoot) continue;

      for (const k of Object.keys(patternRoot)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        accessor.set(patternDefaults, (key + '.' + k) as PropPath<DeepPartial<T>>, value as any);
      }
    }

    return deepMerge({}, patternDefaults, this.cachedDefaultsObject, props) as T;
  }

  isSameAsDefaults<K extends PropPath<T>>(props: DeepPartial<T>, path?: K): boolean {
    this.cachedDefaultsObject ??= this.createDefaultsObject();
    assert.present(this.cachedDefaultsObject);

    let defaultsToVerify: Record<string, unknown>;
    let propsToVerify: Record<string, unknown>;

    if (path) {
      const accessor = new DynamicAccessor<Record<string, unknown>>();
      propsToVerify = accessor.get(props, path) as Record<string, unknown>;
      defaultsToVerify = accessor.get(this.cachedDefaultsObject, path) as Record<string, unknown>;
    } else {
      propsToVerify = props ?? {};
      defaultsToVerify = this.cachedDefaultsObject;
    }

    return DiagramDefaultsPrivate.isSameAsDefaults(propsToVerify, defaultsToVerify);
  }

  private createDefaultsObject() {
    const obj = {};
    const accessor = new DynamicAccessor<Record<string, unknown>>();

    for (const [key, value] of Object.entries(this.defaults)) {
      accessor.set(obj, key, value);
    }

    return obj as T;
  }

  private createPatternDefaultsObject() {
    const dest: Record<string, unknown> = {};
    const accessor = new DynamicAccessor<Record<string, unknown>>();

    for (const [pattern, patternSpec] of Object.entries(this.patterns)) {
      const obj = {};
      for (const [key, value] of Object.entries(patternSpec)) {
        accessor.set(obj, key, value);
      }
      dest[pattern] = obj;
    }

    return dest;
  }
}

/**
 * The ParentDefaults class extends the Defaults class to manage a collection of child Defaults instances.
 * It provides functionality to apply default values and patterns to both the parent instance
 * and the associated child instances.
 */
export class ParentDefaults<T> extends Defaults<T> {
  constructor(
    private readonly children: Defaults<T>[],
    defaults?: DeepPartial<T>
  ) {
    super(defaults);
  }

  add<K extends PropPath<T>>(key: K, value: PropPathValue<T, K>): void {
    super.add(key, value);
    for (const child of this.children) {
      child.add(key, value);
    }
  }

  addPattern<K extends PropPath<T>>(key: `${K}.*`, value: unknown): void {
    super.addPattern(key, value);
    for (const child of this.children) {
      child.addPattern(key, value);
    }
  }
}

export const DefaultStyles = {
  node: {
    default: 'default',
    text: 'default-text'
  },
  edge: {
    default: 'default-edge'
  },
  text: {
    default: 'default-text-default'
  }
};

const _elementDefaults: Pick<
  ElementPropsForRendering,
  'debug' | 'geometry' | 'fill' | 'shadow' | 'stroke' | 'inheritStyle' | 'hidden'
> = {
  hidden: false,
  geometry: {
    flipV: false,
    flipH: false
  },
  shadow: {
    enabled: false,
    color: 'var(--canvas-fg)',
    blur: 5,
    opacity: 0.5,
    x: 5,
    y: 5
  },
  fill: {
    color: 'var(--canvas-bg2)',
    color2: 'blue',
    type: 'solid',
    enabled: true,
    image: {
      id: '',
      fit: 'fill',
      url: '',
      w: 0,
      h: 0,
      scale: 1,
      tint: '',
      tintStrength: 1,
      brightness: 1,
      contrast: 1,
      saturation: 1
    },
    pattern: '',
    gradient: {
      direction: 0,
      type: 'linear'
    }
  },
  stroke: {
    color: 'var(--canvas-fg)',
    width: 1,
    pattern: 'SOLID',
    patternSize: 100,
    patternSpacing: 100,
    enabled: true,
    lineCap: 'round',
    lineJoin: 'round',
    miterLimit: 4
  },
  debug: {
    boundingPath: false,
    anchors: false
  },
  inheritStyle: true
};

const _nodeDefaults: Omit<NodePropsForRendering, 'name' | 'custom' | 'indicators'> = {
  ..._elementDefaults,

  action: {
    type: 'none',
    url: ''
  },

  effects: {
    blur: 0,
    glass: false,
    opacity: 1,
    reflection: false,
    reflectionStrength: 0.7,
    sketch: false,
    sketchFillType: 'fill',
    sketchStrength: 0.1,
    rounding: false,
    roundingAmount: 20,

    isometric: {
      enabled: false,
      shape: 'rect',
      size: 10,
      color: '#eeeeee'
    }
  },

  // TODO: Honor these properties even if part of group
  capabilities: {
    resizable: {
      vertical: true,
      horizontal: true
    },
    editable: true,
    deletable: true,
    movable: true,
    rotatable: true,
    textGrow: false
  },

  text: {
    color: 'var(--canvas-fg)',
    fontSize: 10,
    lineHeight: 1,
    font: 'sans-serif',
    italic: false,
    bold: false,
    textTransform: 'none',
    textDecoration: 'none',
    align: 'center',
    valign: 'middle',
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    wrap: true,
    overflow: 'visible',
    position: 'c'
  },

  anchors: {
    type: 'shape-defaults',
    perEdgeCount: 1,
    perPathCount: 5,
    directionsCount: 4
  },

  routing: {
    spacing: 0,
    constraint: 'none'
  }
};

const _edgeDefaults: Omit<EdgePropsForRendering, 'custom' | 'shape' | 'indicators'> = {
  ..._elementDefaults,
  type: 'straight',
  arrow: {
    start: {
      type: 'NONE',
      size: 100
    },
    end: {
      type: 'NONE',
      size: 100
    }
  },
  routing: {
    rounding: 0
  },
  lineHops: {
    type: 'none',
    size: 10
  },
  effects: {
    sketch: false,
    sketchStrength: 0.1,
    sketchFillType: 'fill',
    opacity: 1,
    rounding: false,
    roundingAmount: 20
  },
  spacing: {
    start: 0,
    end: 0
  }
};

const _mergedEdgeDefaults = makeWriteable(
  deepMerge<EdgePropsForRendering>({}, { ..._nodeDefaults, routing: undefined }, _edgeDefaults)
);

export const nodeDefaults = new Defaults<NodeProps>(_nodeDefaults);
export const edgeDefaults = new Defaults<EdgeProps>(_mergedEdgeDefaults);
export const elementDefaults = new ParentDefaults<ElementProps>(
  [
    nodeDefaults as unknown as Defaults<ElementProps>,
    edgeDefaults as unknown as Defaults<ElementProps>
  ],
  _elementDefaults
);

elementDefaults.addPattern('indicators.*', {
  enabled: false,
  color: 'red',
  direction: 'e',
  shape: 'disc',
  height: 10,
  width: 10,
  position: 'w',
  offset: 10
});

export function registerCustomNodeDefaults<K extends keyof CustomNodeProps>(
  k: K,
  v: DeepRequired<CustomNodeProps[K]>
) {
  nodeDefaults.add(`custom.${k}`, v as PropPathValue<NodeProps, `custom.${K}`>);

  return (d?: CustomNodeProps[K]) => deepMerge({}, v, d ?? undefined);
}

export function registerCustomEdgeDefaults<K extends keyof CustomEdgeProps>(
  k: K,
  v: DeepRequired<CustomEdgeProps[K]>
) {
  edgeDefaults.add(`custom.${k}`, v as PropPathValue<EdgeProps, `custom.${K}`>);

  return (d?: CustomEdgeProps[K]) => deepMerge({}, v, d ?? {});
}
