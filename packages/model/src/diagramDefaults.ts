import { DeepPartial, DeepReadonly, DeepRequired } from '@diagram-craft/utils/types';
import { deepMerge } from '@diagram-craft/utils/object';
import { NodePropsForRendering } from './diagramNode';
import { EdgePropsForRendering } from './diagramEdge';
import { ElementPropsForRendering } from './diagramElement';

const createDefaultsProxy = <T extends object>(target: DeepPartial<T>, path?: string): T =>
  new Proxy<T>(target as T, {
    get(_target, property) {
      const item = target[property as keyof T];
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
  'debug' | 'geometry' | 'fill' | 'shadow' | 'stroke'
> = {
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
    boundingPath: false
  }
};

const _nodeDefaults: Omit<NodePropsForRendering, 'labelForEdgeId' | 'name' | 'custom'> = {
  ..._elementDefaults,

  effects: {
    blur: 0,
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
    moveable: true,
    rotatable: true
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
    bottom: 6
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

export function registerCustomNodeDefaults<K extends keyof CustomNodeProps>(
  k: K,
  v: DeepRequired<CustomNodeProps[K]>
) {
  // @ts-expect-error
  _nodeDefaults.custom ??= {};
  // @ts-expect-error
  _nodeDefaults['custom'][k] = v;

  // TODO: Maybe we can use a Proxy here to make it immutable and more performant

  // @ts-ignore
  return (d: CustomNodeProps[K]) => deepMerge({}, v, d);
}

export function registerCustomEdgeDefaults<K extends keyof CustomEdgeProps>(
  k: K,
  v: DeepRequired<CustomEdgeProps[K]>
) {
  // @ts-expect-error
  _edgeDefaults.custom ??= {};
  // @ts-expect-error
  _edgeDefaults['custom'][k] = v;

  // TODO: Maybe we can use a Proxy here to make it immutable and more performant

  // @ts-ignore
  return (d: CustomEdgeProps[K]) => deepMerge({}, v, d);
}

export const elementDefaults: DeepReadonly<ElementProps> =
  createDefaultsProxy<ElementPropsForRendering>(_elementDefaults);

export const nodeDefaults: NodePropsForRendering =
  createDefaultsProxy<NodePropsForRendering>(_nodeDefaults);

export const edgeDefaults: EdgePropsForRendering = createDefaultsProxy<EdgePropsForRendering>(
  // @ts-ignore
  deepMerge<EdgePropsForRendering>({}, nodeDefaults, _edgeDefaults)
);
