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

type FillType = 'solid' | 'gradient';

export function assertFillType(s: string | undefined): asserts s is FillType | undefined {
  if (!(s === 'solid' || s === 'gradient' || s === undefined)) throw new Error();
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
  }

  interface NodeProps extends ElementProps {
    highlight?: string[];

    fill?: {
      enabled?: boolean;
      color?: string;
      type?: FillType;
      color2?: string;
    };
  }
}
