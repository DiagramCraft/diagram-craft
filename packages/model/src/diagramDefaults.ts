import { DeepPartial, DeepReadonly, DeepRequired, makeWriteable } from '@diagram-craft/utils/types';
import { deepMerge, isObj } from '@diagram-craft/utils/object';
import { NodePropsForRendering } from './diagramNode';
import { EdgePropsForRendering } from './diagramEdge';
import { ElementPropsForRendering } from './diagramElement';
import { DynamicAccessor, PropPath, PropPathValue } from '@diagram-craft/utils/propertyPath';

export class Defaults<T> {
  private readonly defaults: Record<string, any> = {};
  private readonly patterns: Record<string, Record<string, any>> = {};

  private defaultsObjects: T | undefined;
  private patternDefaultsObjects: Record<string, any> | undefined;

  constructor(defaults?: DeepPartial<T>) {
    this.unfoldAndAdd(defaults ?? {}, this.defaults);
  }

  get<K extends PropPath<T>>(key: K): PropPathValue<T, K> | undefined {
    return this.getRaw(key);
  }

  getRaw(key: string): any | undefined {
    const v = this.defaults[key];
    if (v !== undefined) return v;

    // Attempt to use patterns
    for (const p of Object.keys(this.patterns)) {
      if (key.startsWith(p)) {
        // This takes property like a.b.c.d.e, with a pattern such as a.b.*,
        // and extracts d.e
        const k = key
          .slice(p.length + 1)
          .split('.')
          .slice(1)
          .join('.');

        const v = this.patterns[p][k];
        if (v !== undefined) return v;
      }
    }

    throw new Error(`Property ${key} is not defined in defaults`);
  }

  add<K extends PropPath<T>>(key: K, value: PropPathValue<T, K>): void {
    this.defaultsObjects = undefined;

    this.unfoldAndAdd(value, this.defaults, key.split('.'));
  }

  addPattern<K extends PropPath<T>>(key: `${K}.*`, value: any): void {
    this.defaultsObjects = undefined;
    this.patternDefaultsObjects = undefined;

    this.patterns[key.slice(0, -2)] ??= {};
    this.unfoldAndAdd(value, this.patterns[key.slice(0, -2)]);
  }

  merge(props: DeepPartial<T>): T {
    if (this.defaultsObjects === undefined) {
      this.defaultsObjects = this.createDefaultsObject();
    }

    if (this.patternDefaultsObjects === undefined) {
      this.patternDefaultsObjects = this.createPatternDefaultsObject();
    }

    // Handle patterns
    const patternDefaults = {};
    const accessor = new DynamicAccessor<DeepPartial<T>>();
    for (const [key, value] of Object.entries(this.patternDefaultsObjects!)) {
      const patternRoot = accessor.get(props, key as PropPath<DeepPartial<T>>);
      if (patternRoot) {
        for (const k of Object.keys(patternRoot)) {
          accessor.set(patternDefaults, (key + '.' + k) as PropPath<DeepPartial<T>>, value);
        }
      }
    }

    return deepMerge(patternDefaults, this.defaultsObjects!, props) as T;
  }

  dump() {
    console.log('----------------------------------------------------------');
    console.log('defaults', this.defaults);
    console.log('patterns', this.patterns);
    console.log('defaultsObjects', this.createDefaultsObject());
    console.log('patternDefaultsObjects', this.createPatternDefaultsObject());
  }

  private createDefaultsObject(): T {
    const obj = {};
    const accessor = new DynamicAccessor();

    for (const [key, value] of Object.entries(this.defaults)) {
      // @ts-ignore
      accessor.set(obj, key, value);
    }

    return obj as T;
  }

  private createPatternDefaultsObject(): Record<string, any> {
    const dest: Record<string, any> = {};
    const accessor = new DynamicAccessor();

    for (const [pattern, patternSpec] of Object.entries(this.patterns)) {
      const obj = {};
      for (const [key, value] of Object.entries(patternSpec)) {
        // @ts-ignore
        accessor.set(obj, key, value);
      }
      dest[pattern] = obj;
    }

    return dest;
  }

  private unfoldAndAdd(value: any, obj: Record<string, any>, path: string[] = []): void {
    if (isObj(value) && value !== null && value !== undefined) {
      for (const key of Object.keys(value)) {
        this.unfoldAndAdd(value[key], obj, [...path, key]);
      }
    } else {
      obj[path.join('.')] = value;
    }
  }
}

// @ts-ignore
class ParentDefaults<T> extends Defaults<T> {
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

  addPattern<K extends PropPath<T>>(key: `${K}.*`, value: any): void {
    super.addPattern(key, value);
    for (const child of this.children) {
      child.addPattern(key, value);
    }
  }
}

const createDefaultsProxy = <T extends object>(target: DeepPartial<T>, path?: string): T =>
  new Proxy<T>(target as T, {
    get(_target, property) {
      let item = target[property as keyof T];

      // Note: special handling of the indicators object, as the keys are not
      // defined (except for _default)
      if (path === '.indicators') {
        item = (target as any)['_default'] as any;
      }

      if (item === null || item === undefined) {
        if (property === 'toJSON') return undefined;
        if (item === null) return null;
        console.log(item);
        throw new Error(`${path ?? ''}#${String(property)} is not defined in defaults`);
      }

      if (item && typeof item === 'object') {
        return createDefaultsProxy(
          item as unknown as object,
          (path ?? '') + '.' + String(property)
        );
      }
      return item;
    },
    set() {
      throw new Error('defaults are immutable');
    }
  });

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
  'debug' | 'geometry' | 'fill' | 'shadow' | 'stroke' | 'inheritStyle' | 'hidden' | 'indicators'
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
  inheritStyle: true,
  indicators: {
    _default: {
      enabled: false,
      color: 'red',
      direction: 'e',
      shape: 'disc',
      height: 10,
      width: 10,
      position: 'w',
      offset: 10
    }
  }
};

const _nodeDefaults: Omit<NodePropsForRendering, 'labelForEdgeId' | 'name' | 'custom'> = {
  ..._elementDefaults,

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
    roundingAmount: 20
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
    directionsCount: 4
  }
};

const _edgeDefaults: Omit<EdgePropsForRendering, 'custom' | 'shape'> = {
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
  }
};

export const elementDefaults: DeepReadonly<ElementProps> =
  createDefaultsProxy<ElementPropsForRendering>(_elementDefaults);

export const nodeDefaults: NodePropsForRendering =
  createDefaultsProxy<NodePropsForRendering>(_nodeDefaults);

const _mergedEdgeDefaults = makeWriteable(
  // @ts-ignore
  deepMerge<EdgePropsForRendering>({}, nodeDefaults, _edgeDefaults)
);

export const edgeDefaults: EdgePropsForRendering =
  createDefaultsProxy<EdgePropsForRendering>(_mergedEdgeDefaults);

export const nodeDefaults2 = new Defaults<NodeProps>(_nodeDefaults);
export const edgeDefaults2 = new Defaults<EdgeProps>(_mergedEdgeDefaults);
export const elementDefaults2 = new ParentDefaults<ElementProps>(
  [
    nodeDefaults2 as unknown as Defaults<ElementProps>,
    edgeDefaults2 as unknown as Defaults<ElementProps>
  ],
  _elementDefaults
);

export function registerCustomNodeDefaults<K extends keyof CustomNodeProps>(
  k: K,
  v: DeepRequired<CustomNodeProps[K]>
) {
  // @ts-expect-error
  _nodeDefaults.custom ??= {};
  // @ts-expect-error
  _nodeDefaults['custom'][k] = v;

  // @ts-ignore
  nodeDefaults2.add(`custom.${k}`, v);

  // @ts-ignore
  return (d?: CustomNodeProps[K]) => deepMerge({}, v, d ?? undefined);
}

export function registerCustomEdgeDefaults<K extends keyof CustomEdgeProps>(
  k: K,
  v: DeepRequired<CustomEdgeProps[K]>
) {
  // @ts-expect-error
  _edgeDefaults.custom ??= {};
  // @ts-expect-error
  _edgeDefaults['custom'][k] = v;

  // @ts-expect-error
  _mergedEdgeDefaults.custom ??= {};
  // @ts-expect-error
  _mergedEdgeDefaults['custom'][k] = v;

  // TODO: Maybe we can use a Proxy here to make it immutable and more performant

  // @ts-ignore
  edgeDefaults2.add(`custom.${k}`, v);

  // @ts-ignore
  return (d?: CustomEdgeProps[K]) => deepMerge({}, v, d ?? {});
}
