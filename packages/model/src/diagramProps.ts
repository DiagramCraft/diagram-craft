import { DeepWriteable, FlatObject } from '@diagram-craft/utils/types';
import { deepClone } from '@diagram-craft/utils/object';
import { Direction } from '@diagram-craft/geometry/direction';

type GridType = 'lines' | 'dots';

export function assertGridType(s: string | undefined): asserts s is GridType | undefined {
  if (!(s === 'lines' || s === 'dots' || s === '' || s === undefined))
    throw new Error(`invalid grid type: ${s}`);
}

export type EdgeType = 'straight' | 'bezier' | 'curved' | 'orthogonal';

export type FillType = 'solid' | 'gradient' | 'image' | 'texture' | 'pattern';

export type HAlign = 'left' | 'center' | 'right';

export function assertHAlign(s: string | undefined): asserts s is HAlign | undefined {
  if (!(s === 'left' || s === 'center' || s === 'right' || s === undefined)) throw new Error();
}

export type VAlign = 'top' | 'middle' | 'bottom';

export function assertVAlign(s: string | undefined): asserts s is VAlign | undefined {
  if (!(s === 'top' || s === 'middle' || s === 'bottom' || s === undefined)) throw new Error();
}

export type LineCap = 'butt' | 'round' | 'square';

export function assertLineCap(s: string | undefined): asserts s is LineCap | undefined {
  if (!(s === 'butt' || s === 'round' || s === 'square' || s === undefined)) throw new Error();
}

export type LineJoin = 'miter' | 'round' | 'bevel';

export function assertLineJoin(s: string | undefined): asserts s is LineJoin | undefined {
  if (!(s === 'miter' || s === 'round' || s === 'bevel' || s === undefined)) throw new Error();
}

export interface Indicator {
  enabled: boolean;
  shape?: string;
  color?: string;
  height?: number;
  width?: number;
  direction?: Direction;
  position?: 'ne' | 'n' | 'nw' | 'w' | 'sw' | 's' | 'se' | 'e' | 'c';
  offset?: number;
}

declare global {
  interface DocumentProps {
    query?: {
      history?: [string, string][];
      saved?: [string, string][];
    };
  }

  interface DiagramProps {
    background?: {
      color?: string;
    };
    grid?: {
      enabled?: boolean;
      size?: number;
      majorCount?: number;
      color?: string;
      majorColor?: string;
      type?: GridType;
      majorType?: GridType;
    };
    ruler?: {
      enabled?: boolean;
    };
  }

  interface ElementDataEntry {
    schema: string;
    type: 'schema' | 'external';
    external?: {
      uid: string;
    };
    data: FlatObject;
    enabled?: boolean;
  }

  interface ElementMetadata {
    name?: string;
    style?: string;
    textStyle?: string;
    data?: {
      data?: Array<ElementDataEntry>;
      customData?: FlatObject;
    };
  }

  interface CustomNodeProps {}
  interface CustomEdgeProps {}

  interface ElementProps {
    hidden?: boolean;

    stroke?: {
      enabled?: boolean;
      color?: string;
      width?: number;
      pattern?: string | null;
      patternSpacing?: number;
      patternSize?: number;
      miterLimit?: number;
      lineCap?: LineCap;
      lineJoin?: LineJoin;
    };

    shadow?: {
      enabled?: boolean;
      color?: string;
      opacity?: number;
      x?: number;
      y?: number;
      blur?: number;
    };
    geometry?: {
      flipV?: boolean;
      flipH?: boolean;
    };

    // TODO: Why is all of fill part of edge?
    fill?: {
      enabled?: boolean;
      image?: {
        w?: number;
        h?: number;
        url?: string;
        id?: string;
        fit: 'fill' | 'contain' | 'cover' | 'keep' | 'tile';
        scale?: number;
        tint?: string;
        tintStrength?: number;
        brightness?: number;
        contrast?: number;
        saturation?: number;
      };
      pattern?: string;
      color?: string;
      type?: FillType;
      color2?: string;
      gradient?: {
        direction?: number;
        type?: 'linear' | 'radial';
      };
    };
    effects?: {
      sketch?: boolean;
      sketchStrength?: number;
      sketchFillType?: 'fill' | 'hachure';

      opacity?: number;

      rounding?: boolean;
      roundingAmount?: number;
    };

    debug?: {
      boundingPath?: boolean;
      anchors?: boolean;
    };

    inheritStyle?: boolean;

    indicators?: Record<string, Indicator>;
  }

  interface EdgeProps extends ElementProps {
    type?: EdgeType;
    shape?: string;

    arrow?: {
      start?: {
        type?: string;
        size?: number;
      };
      end?: {
        type?: string;
        size?: number;
      };
    };
    routing?: {
      rounding?: number;
    };
    lineHops?: {
      type?: 'none' | 'below-line' | 'above-arc' | 'below-arc' | 'below-hide';
      size?: number;
    };

    custom?: CustomEdgeProps;
  }

  interface NodeProps extends ElementProps {
    labelForEdgeId?: string;

    action?: {
      type: 'url' | 'diagram' | 'layer' | 'none';
      url?: string;
    };

    capabilities?: {
      resizable?: {
        vertical?: boolean;
        horizontal?: boolean;
      };
      movable?: boolean;
      rotatable?: boolean;
      textGrow?: boolean;
      editable?: boolean;
      deletable?: boolean;
    };

    effects?: {
      reflection?: boolean;
      reflectionStrength?: number;
      blur?: number;
      sketch?: boolean;
      sketchStrength?: number;
      sketchFillType?: 'fill' | 'hachure';

      glass?: boolean;

      opacity?: number;

      rounding?: boolean;
      roundingAmount?: number;
    };

    text?: {
      font?: string;
      fontSize?: number;
      lineHeight?: number;
      bold?: boolean;
      italic?: boolean;
      textDecoration?: 'none' | 'underline' | 'line-through' | 'overline';
      textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
      color?: string;
      align?: HAlign;
      valign?: VAlign;
      top?: number;
      left?: number;
      right?: number;
      bottom?: number;
      wrap?: boolean;
      overflow?: 'hidden' | 'visible';
      position?: 'c' | 'e' | 'w' | 'n' | 's' | 'ne' | 'nw' | 'se' | 'sw';
    };

    anchors?: {
      type: 'none' | 'shape-defaults' | 'north-south' | 'east-west' | 'directions' | 'per-edge';
      perEdgeCount?: number;
      directionsCount?: number;
    };

    custom?: CustomNodeProps;
  }
}

export function withAdjustedProperties<T>(t: T, cb: (p: DeepWriteable<T>) => void) {
  const p = deepClone(t) as DeepWriteable<T>;
  cb(p);
  return p;
}
