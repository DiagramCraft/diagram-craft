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

type HAlign = 'left' | 'center' | 'right';

export function assertHAlign(s: string | undefined): asserts s is HAlign | undefined {
  if (!(s === 'left' || s === 'center' || s === 'right' || s === undefined)) throw new Error();
}

type Valign = 'top' | 'middle' | 'bottom';

export function assertVAlign(s: string | undefined): asserts s is Valign | undefined {
  if (!(s === 'top' || s === 'middle' || s === 'bottom' || s === undefined)) throw new Error();
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

  interface ElementProps {
    style?: string;
    stroke?: {
      enabled?: boolean;
      color?: string;
      width?: number;
      pattern?: string;
      patternSpacing?: number;
      patternSize?: number;
    };
    text?: {
      text?: string;
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
    };
    shadow?: {
      enabled?: boolean;
      color?: string;
      opacity?: number;
      x?: number;
      y?: number;
      blur?: number;
    };
    data?: {
      type?: 'schema' | 'derived-from';
      schema?: string;
      data?: Record<string, string>;
      customData?: Record<string, string>;
    };
  }

  interface EdgeProps extends ElementProps {
    highlight?: string[];

    type?: EdgeType;
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
    fill?: {
      color?: string;
    };
    routing?: {
      rounding?: number;
    };
    lineHops?: {
      type?: 'none' | 'below-line' | 'above-arc' | 'below-arc' | 'below-hide';
      size?: number;
    };
  }

  interface NodeProps extends ElementProps {
    labelForEdgeId?: string;
    highlight?: string[];

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
      reflection?: boolean;
      blur?: number;
      opacity?: number;
    };
  }
}
