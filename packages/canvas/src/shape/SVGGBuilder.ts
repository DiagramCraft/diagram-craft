import { text, toInlineCSS, VNode } from '../component/vdom';
import * as svg from '../component/vdom-svg';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { makeLinearGradient, makeRadialGradient } from './shapeFill';
import { newid } from '@diagram-craft/utils/id';
import { DASH_PATTERNS } from '../dashPatterns';
import { PathBuilder } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { Path } from '@diagram-craft/geometry/path';
import { RenderedStyledPath, StyledPath } from './PathRenderer';

type Renderer = (p: StyledPath) => RenderedStyledPath[];

const NOOP_RENDERER: Renderer = (p: StyledPath) => {
  return [
    {
      path: p.path.asSvgPath(),
      style: p.style
    }
  ];
};

export class SVGGBuilder {
  readonly #x: number;
  readonly #y: number;
  readonly #w: number;
  readonly #h: number;

  readonly #initialStroke: NodeProps['stroke'];
  readonly #initialFill: NodeProps['fill'];

  #fill: NodeProps['fill'] = { color: 'red' };
  #fillGradientId: string | undefined;
  #stroke: NodeProps['stroke'] = { color: 'black' };
  #font: NodeProps['text'] = {};

  #strokeStack: NodeProps['stroke'][] = [];
  #fillStack: NodeProps['fill'][] = [];

  #shapes: (Path | PathBuilder)[] = [];

  constructor(
    private readonly g: VNode & { type: 's' },
    w: number,
    h: number,
    el: DiagramElement,
    private readonly renderer: Renderer = NOOP_RENDERER
  ) {
    this.#x = el.bounds.x;
    this.#y = el.bounds.y;
    this.#w = w;
    this.#h = h;

    this.setStroke(el.renderProps.stroke);
    this.setFill(el.renderProps.fill);

    if ('text' in el.renderProps) {
      this.setFont(el.renderProps.text);
    }

    this.#initialFill = el.renderProps.fill;
    this.#initialStroke = el.renderProps.stroke;
  }

  static SVGPathBuilder = class {
    constructor(
      private readonly parent: SVGGBuilder,
      private readonly b: PathBuilder,
      x?: number,
      y?: number
    ) {
      if (x !== undefined && y !== undefined) {
        this.move(x, y);
      }
    }

    arc(
      rx: number,
      ry: number,
      rotation: number,
      largeArc: 0 | 1,
      sweep: 0 | 1,
      x: number,
      y: number
    ) {
      this.b.arcTo(
        { x: this.parent.#x + x * this.parent.#w, y: this.parent.#y + y * this.parent.#h },
        rx * this.parent.#w,
        ry * this.parent.#h,
        rotation,
        largeArc,
        sweep
      );
      return this;
    }

    line(x: number, y: number) {
      this.b.lineTo({
        x: this.parent.#x + x * this.parent.#w,
        y: this.parent.#y + y * this.parent.#h
      });
      return this;
    }

    move(x: number, y: number) {
      this.b.moveTo({
        x: this.parent.#x + x * this.parent.#w,
        y: this.parent.#y + y * this.parent.#h
      });
      return this;
    }

    curve(x1: number, y1: number, x2: number, y2: number, x: number, y: number) {
      this.b.cubicTo(
        { x: this.parent.#x + x * this.parent.#w, y: this.parent.#y + y * this.parent.#h },
        { x: this.parent.#x + x1 * this.parent.#w, y: this.parent.#y + y1 * this.parent.#h },
        { x: this.parent.#x + x2 * this.parent.#w, y: this.parent.#y + y2 * this.parent.#h }
      );
      return this;
    }

    quad(x1: number, y1: number, x: number, y: number) {
      this.b.quadTo(
        { x: this.parent.#x + x * this.parent.#w, y: this.parent.#y + y * this.parent.#h },
        { x: this.parent.#x + x1 * this.parent.#w, y: this.parent.#y + y1 * this.parent.#h }
      );

      return this;
    }

    close() {
      this.b.close();
      return this.end();
    }

    end() {
      return parent;
    }
  };

  path(x?: number, y?: number) {
    const pb = new PathBuilder();
    this.#shapes.push(pb);

    return new SVGGBuilder.SVGPathBuilder(this, pb, x, y);
  }

  addShape(shape: Path | PathBuilder) {
    this.#shapes.push(shape);
  }

  restore() {
    if (this.#strokeStack.length === 0) {
      this.setStroke(this.#initialStroke);
    } else {
      this.setStroke(this.#strokeStack.pop());
    }

    if (this.#fillStack.length === 0) {
      this.setFill(this.#initialFill);
    } else {
      this.setFill(this.#fillStack.pop());
    }

    return this;
  }

  linearGradient(c1: string, c2: string, direction = 0) {
    this.setFill({
      type: 'gradient',
      color: c1,
      color2: c2,
      gradient: {
        type: 'linear',
        direction
      }
    });
    return this;
  }

  setFill(fill: NodeProps['fill']) {
    this.#fillGradientId = undefined;

    this.#fill = fill;

    if (this.#fill!.type === 'gradient') {
      this.#fillGradientId = newid();
      if (this.#fill!.gradient?.type === 'linear') {
        // @ts-ignore
        this.g.children.push(makeLinearGradient(this.#fillGradientId, { fill: this.#fill }));
      } else {
        // @ts-ignore
        this.g.children.push(makeRadialGradient(this.#fillGradientId, { fill: this.#fill }));
      }
    }

    return this;
  }

  setStroke(stroke: NodeProps['stroke']) {
    this.#stroke = stroke;
    return this;
  }

  setFont(font: Omit<NodeProps['text'], 'text'>) {
    this.#font = font;
    return this;
  }

  fill(fill?: NodeProps['fill']) {
    if (fill) this.setFill(fill);

    this.renderWithStyle({ ...this.fillProps(), strokeWidth: '0' });

    this.#shapes = [];

    return this;
  }

  fillAndStroke(stroke?: NodeProps['stroke'], fill?: NodeProps['fill'], backing = false) {
    if (stroke) this.setStroke(stroke);
    if (fill) this.setFill(fill);

    if (backing) this.applyBacking();

    this.renderWithStyle({ ...this.fillProps(), ...this.strokeProps() });

    this.#shapes = [];

    return this;
  }

  stroke(stroke?: NodeProps['stroke'], backing = false) {
    if (stroke) this.setStroke(stroke);

    if (backing) this.applyBacking();

    this.renderWithStyle({ ...this.strokeProps(), fill: 'transparent' });

    this.#shapes = [];

    return this;
  }

  /**
   * Backing means that the shape will be drawn with a
   * backing shape that is transparent and has a stroke width of 10
   * so that mouse events works well on thin or dashes edges
   */
  private applyBacking() {
    this.g.children.push(
      ...this.#shapes.map(s => {
        const p = s instanceof PathBuilder ? s.getPaths().asSvgPath() : s.asSvgPath();
        return svg.path({
          'd': p,
          'class': 'svg-node__backing',
          'fill': 'transparent',
          'stroke': 'transparent',
          'stroke-width': 10
        });
      })
    );
  }

  private renderWithStyle(style: Partial<CSSStyleDeclaration>) {
    this.g.children.push(
      ...this.#shapes.flatMap(s => {
        const styledPaths: StyledPath[] = [];
        if (s instanceof PathBuilder) {
          const paths = s.getPaths().all();
          for (const p of paths) {
            styledPaths.push({ path: p, style });
          }
        } else {
          styledPaths.push({ path: s, style });
        }

        return styledPaths
          .flatMap(sp => this.renderer(sp))
          .map(rp =>
            svg.path({
              d: rp.path,
              style: toInlineCSS(rp.style)
            })
          );
      })
    );
  }

  rect(x: number, y: number, w: number, h: number, rx = 0, ry = 0) {
    const ex = this.#x + x * this.#w;
    const ey = this.#y + y * this.#h;
    const ew = w * this.#w;
    const eh = h * this.#h;

    const pathBuilder = new PathBuilder();

    pathBuilder.moveTo(Point.of(ex + rx, ey));
    pathBuilder.lineTo(Point.of(ex + ew - rx, ey));
    if (rx !== 0 || ry !== 0) pathBuilder.arcTo(Point.of(ex + ew, ey + ry), rx, ry, 0, 0, 1);
    pathBuilder.lineTo(Point.of(ex + ew, ey + eh - ry));
    if (rx !== 0 || ry !== 0) pathBuilder.arcTo(Point.of(ex + ew - rx, ey + eh), rx, ry, 0, 0, 1);
    pathBuilder.lineTo(Point.of(ex + rx, ey + eh));
    if (rx !== 0 || ry !== 0) pathBuilder.arcTo(Point.of(ex, ey + eh - ry), rx, ry, 0, 0, 1);
    pathBuilder.lineTo(Point.of(ex, ey + ry));
    if (rx !== 0 || ry !== 0) pathBuilder.arcTo(Point.of(ex + rx, ey), rx, ry, 0, 0, 1);

    this.#shapes.push(pathBuilder);

    return this;
  }

  circle(cx: number, cy: number, r: number) {
    return this.ellipse(cx, cy, r, r);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number) {
    const ex = this.#x + cx * this.#w;
    const ey = this.#y + cy * this.#h;

    const b = new PathBuilder();
    b.moveTo(Point.of(ex, ey - ry));
    b.arcTo(Point.of(ex + rx, ey), rx, ry, 0, 0, 1);
    b.arcTo(Point.of(ex, ey + ry), rx, ry, 0, 0, 1);
    b.arcTo(Point.of(ex - rx, ey), rx, ry, 0, 0, 1);
    b.arcTo(Point.of(ex, ey - ry), rx, ry, 0, 0, 1);

    this.#shapes.push(b);

    return this;
  }

  text(x: number, y: number, s: string, font?: Omit<NodeProps['text'], 'text'>) {
    if (font) this.setFont(font);
    this.g.children.push(
      svg.text(
        {
          'x': this.#x + x * this.#w,
          'y': this.#y + y * this.#h + (this.#font!.fontSize ?? 12) / 2,
          'fill': this.#font!.color,
          'font-size': this.#font!.fontSize,
          'font-family': this.#font?.font,
          'text-anchor': 'middle'
        },
        text(s)
      )
    );
    return this;
  }

  private fillProps() {
    const fill = this.#fillGradientId ? `url(#${this.#fillGradientId})` : this.#fill!.color;
    return {
      fill
    };
  }

  private strokeProps() {
    const d: Record<string, string | number | undefined> = {
      'stroke': this.#stroke?.color ?? 'var(--canvas-fg)',
      'stroke-width': this.#stroke?.width
    };
    if (this.#stroke?.pattern) {
      d['stroke-dasharray'] = DASH_PATTERNS[this.#stroke?.pattern ?? 'SOLID']!(
        (this.#stroke?.patternSpacing ?? 100) / 100,
        (this.#stroke?.patternSize ?? 100) / 100
      );
    }
    return d;
  }
}
