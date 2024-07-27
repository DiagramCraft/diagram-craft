import { text, VNode } from '../component/vdom';
import * as svg from '../component/vdom-svg';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { makeLinearGradient, makeRadialGradient } from './shapeFill';
import { newid } from '@diagram-craft/utils/id';
import { DASH_PATTERNS } from '../dashPatterns';

// TODO: Change this to use PathBuilder under the hood
export class SVGGBuilder {
  #x: number;
  #y: number;
  #w: number;
  #h: number;

  #fill: NodeProps['fill'] = {
    color: 'red'
  };
  #fillGradientId: string | undefined;
  #stroke: NodeProps['stroke'] = {
    color: 'black'
  };
  #font: NodeProps['text'] = {};

  #initialStroke: NodeProps['stroke'];
  #initialFill: NodeProps['fill'];

  #strokeStack: NodeProps['stroke'][] = [];
  #fillStack: NodeProps['fill'][] = [];

  #shapes: VNode[] = [];

  constructor(
    private readonly g: VNode & { type: 's' },
    w: number,
    h: number,
    el: DiagramElement
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
    #path: string[] = [];

    constructor(
      private readonly parent: SVGGBuilder,
      private readonly path: VNode & { type: 's' },
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
      this.#path.push(
        `A ${rx * this.parent.#w} ${ry * this.parent.#h} ${rotation} ${largeArc} ${sweep} ${this.parent.#x + x * this.parent.#w} ${this.parent.#y + y * this.parent.#h}`
      );
      this.path.data.d = this.#path.join(' ');
      return this;
    }

    line(x: number, y: number) {
      this.#path.push(
        `L ${this.parent.#x + x * this.parent.#w} ${this.parent.#y + y * this.parent.#h}`
      );
      this.path.data.d = this.#path.join(' ');
      return this;
    }

    move(x: number, y: number) {
      this.#path.push(
        `M ${this.parent.#x + x * this.parent.#w} ${this.parent.#y + y * this.parent.#h}`
      );
      this.path.data.d = this.#path.join(' ');
      return this;
    }

    curve(x1: number, y1: number, x2: number, y2: number, x: number, y: number) {
      this.#path.push(
        `C ${this.parent.#x + x1 * this.parent.#w} ${this.parent.#y + y1 * this.parent.#h} ${this.parent.#x + x2 * this.parent.#w} ${this.parent.#y + y2 * this.parent.#h} ${this.parent.#x + x * this.parent.#w} ${this.parent.#y + y * this.parent.#h}`
      );
      this.path.data.d = this.#path.join(' ');
      return this;
    }

    quad(x1: number, y1: number, x: number, y: number) {
      this.#path.push(
        `Q ${this.parent.#x + x1 * this.parent.#w} ${this.parent.#y + y1 * this.parent.#h} ${this.parent.#x + x * this.parent.#w} ${this.parent.#y + y * this.parent.#h}`
      );
      this.path.data.d = this.#path.join(' ');
      return this;
    }

    close() {
      this.#path.push('Z');
      this.path.data.d = this.#path.join(' ');
      return this.end();
    }

    end() {
      this.path.data.d = this.#path.join(' ');
      return parent;
    }
  };

  path(x?: number, y?: number) {
    const path = svg.path({ d: '' });
    this.#shapes.push(path);
    return new SVGGBuilder.SVGPathBuilder(this, path, x, y);
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
    this.#shapes.forEach(s => (s.data = { ...s.data, ...this.fillProps(), 'stroke-width': 0 }));
    this.g.children.push(...this.#shapes);
    this.#shapes = [];

    return this;
  }

  fillAndStroke(stroke?: NodeProps['stroke'], fill?: NodeProps['fill'], backing = false) {
    if (stroke) this.setStroke(stroke);
    if (fill) this.setFill(fill);

    if (backing) this.applyBacking();

    this.#shapes.forEach(s => (s.data = { ...s.data, ...this.fillProps(), ...this.strokeProps() }));
    this.g.children.push(...this.#shapes);
    this.#shapes = [];

    return this;
  }

  stroke(stroke?: NodeProps['stroke'], backing = false) {
    if (stroke) this.setStroke(stroke);

    if (backing) this.applyBacking();

    this.#shapes.forEach(s => (s.data = { ...s.data, ...this.strokeProps(), fill: 'transparent' }));
    this.g.children.push(...this.#shapes);
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
      ...this.#shapes.map(s => ({
        ...s,
        data: {
          ...s.data,
          'class': 'svg-node__backing',
          'fill': 'transparent',
          'stroke': 'transparent',
          'stroke-width': 10
        }
      }))
    );
  }

  rect(x: number, y: number, w: number, h: number, rx = 0, ry = 0) {
    this.#shapes.push(
      svg.rect({
        x: this.#x + x * this.#w,
        y: this.#y + y * this.#h,
        width: w * this.#w,
        height: h * this.#h,
        rx,
        ry
      })
    );

    return this;
  }

  circle(cx: number, cy: number, r: number) {
    this.#shapes.push(
      svg.circle({
        cx: this.#x + cx * this.#w,
        cy: this.#y + cy * this.#h,
        r: r
      })
    );
    return this;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number) {
    this.#shapes.push(
      svg.ellipse({
        cx: this.#x + cx * this.#w,
        cy: this.#y + cy * this.#h,
        rx,
        ry
      })
    );
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = {
      'stroke': this.#stroke?.color,
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
