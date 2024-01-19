import { deepMerge } from '../utils/deepmerge.ts';
import { DeepPartial, DeepRequired } from '../utils/types.ts';

export const createDefaultsProxy = <T extends object>(target: DeepPartial<T>, path?: string): T =>
  new Proxy<T>(target as T, {
    get(target, property) {
      const item = target[property as keyof T];
      if (item === null || item === undefined) {
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

export const nodeDefaults: DeepRequired<NodeProps> = createDefaultsProxy<DeepRequired<NodeProps>>({
  fill: {
    color: 'var(--canvas-bg)',
    color2: 'blue',
    type: 'solid',
    enabled: true,
    image: {
      fit: 'fill',
      url: '',
      w: 0,
      h: 0,
      scale: 1
    }
  },
  stroke: {
    color: 'var(--canvas-fg)',
    width: 1,
    pattern: 'SOLID',
    patternSize: 100,
    patternSpacing: 100,
    enabled: true
  },
  text: {
    color: 'var(--canvas-fg)',
    fontSize: 10,
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
  shadow: {
    enabled: false,
    color: 'var(--canvas-fg)',
    blur: 5,
    opacity: 0.5,
    x: 5,
    y: 5
  },
  effects: {
    blur: 0,
    opacity: 1,
    reflection: false
  },
  highlight: []
});

export const edgeDefaults: DeepRequired<EdgeProps> = createDefaultsProxy<DeepRequired<EdgeProps>>(
  deepMerge<DeepRequired<EdgeProps>>({}, nodeDefaults, {
    fill: {
      color: 'var(--canvas-fg)'
    },
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
    }
  })
);
