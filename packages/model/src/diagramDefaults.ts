import { DeepPartial, DeepReadonly } from '@diagram-craft/utils/types';
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

type FilterNotStartingWith<B, P extends string> = B extends `${P}${infer _X}` ? never : B;

const _elementDefaults: Pick<
  ElementPropsForRendering,
  'data' | 'highlight' | 'geometry' | 'fill' | 'shadow' | 'stroke' | 'text'
> = {
  data: {
    data: [],
    customData: {}
  },
  highlight: [],
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
    color: 'var(--canvas-bg)',
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
  text: {
    text: '',
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
  }
};

const _nodeDefaults: Omit<
  Pick<NodePropsForRendering, FilterNotStartingWith<keyof NodePropsForRendering, 'shape'>>,
  'labelForEdgeId'
> = {
  ..._elementDefaults,
  style: 'default',

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
  }
};

const _edgeDefaults: Pick<
  EdgePropsForRendering,
  FilterNotStartingWith<keyof EdgePropsForRendering, 'shape'>
> = {
  ..._elementDefaults,
  style: 'default-edge',
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

export function registerNodeDefaults<K extends keyof NodeProps>(k: K, v: NodePropsForRendering[K]) {
  // @ts-expect-error
  _nodeDefaults[k] = v;

  // TODO: Maybe we can use a Proxy here to make it immutable and more performant

  // @ts-ignore
  return (d: NodeProps[K]) => deepMerge({}, v, d);
}

export function registerEdgeDefaults<K extends keyof EdgeProps>(k: K, v: EdgePropsForRendering[K]) {
  // @ts-expect-error
  _edgeDefaults[k] = v;

  // TODO: Maybe we can use a Proxy here to make it immutable and more performant

  // @ts-ignore
  return (d: EdgeProps[K]) => deepMerge({}, v, d);
}

export const elementDefaults: DeepReadonly<ElementProps> =
  createDefaultsProxy<ElementPropsForRendering>(_elementDefaults);

export const nodeDefaults: NodePropsForRendering =
  createDefaultsProxy<NodePropsForRendering>(_nodeDefaults);

export const edgeDefaults: EdgePropsForRendering = createDefaultsProxy<EdgePropsForRendering>(
  deepMerge<EdgePropsForRendering>({}, nodeDefaults, _edgeDefaults)
);
