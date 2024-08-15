import { DeepWriteable } from '@diagram-craft/utils/types';
import { deepClone } from '@diagram-craft/utils/object';

type GridType = 'lines' | 'dots';

export function assertGridType(s: string | undefined): asserts s is GridType | undefined {
  if (!(s === 'lines' || s === 'dots' || s === '' || s === undefined))
    throw new Error(`invalid grid type: ${s}`);
}

type EdgeType = 'straight' | 'bezier' | 'curved' | 'orthogonal';

export function assertEdgeType(s: string | undefined): asserts s is EdgeType | undefined {
  if (
    !(s === 'straight' || s === 'bezier' || s === 'curved' || s === 'orthogonal' || s === undefined)
  )
    throw new Error();
}

type FillType = 'solid' | 'gradient' | 'image' | 'texture' | 'pattern';

export function assertFillType(s: string | undefined): asserts s is FillType | undefined {
  if (
    !(
      s === 'solid' ||
      s === 'gradient' ||
      s === 'image' ||
      s === 'texture' ||
      s === 'pattern' ||
      s === undefined
    )
  )
    throw new Error();
}

export type HAlign = 'left' | 'center' | 'right';

export function assertHAlign(s: string | undefined): asserts s is HAlign | undefined {
  if (!(s === 'left' || s === 'center' || s === 'right' || s === undefined)) throw new Error();
}

export type Valign = 'top' | 'middle' | 'bottom';

export function assertVAlign(s: string | undefined): asserts s is Valign | undefined {
  if (!(s === 'top' || s === 'middle' || s === 'bottom' || s === undefined)) throw new Error();
}

type LineCap = 'butt' | 'round' | 'square';

export function assertLineCap(s: string | undefined): asserts s is LineCap | undefined {
  if (!(s === 'butt' || s === 'round' || s === 'square' || s === undefined)) throw new Error();
}

type LineJoin = 'miter' | 'round' | 'bevel';

export function assertLineJoin(s: string | undefined): asserts s is LineJoin | undefined {
  if (!(s === 'miter' || s === 'round' || s === 'bevel' || s === undefined)) throw new Error();
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

  type Data = Record<string, string | number | boolean>;

  interface ElementMetadata {
    name?: string;
    style?: string;
    textStyle?: string;
    data?: {
      data?: Array<{
        schema: string;
        // TODO: Need to add some stuff to support derived-from
        type: 'schema' | 'derived-from';
        data: Record<string, string>;
        enabled?: boolean;
      }>;
      customData?: Data;
    };
  }

  interface CustomNodeProps {}
  interface CustomEdgeProps {}

  interface ElementProps {
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

    capabilities?: {
      resizable?: {
        vertical?: boolean;
        horizontal?: boolean;
      };
      moveable?: boolean;
      rotatable?: boolean;
      textGrow?: boolean;
    };

    effects?: {
      reflection?: boolean;
      reflectionStrength?: number;
      blur?: number;
      sketch?: boolean;
      sketchStrength?: number;
      sketchFillType?: 'fill' | 'hachure';

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
      valign?: Valign;
      top?: number;
      left?: number;
      right?: number;
      bottom?: number;
      wrap?: boolean;
      overflow?: 'hidden' | 'visible';
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
