import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { PathBuilder, PathBuilderHelper } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { BaseShape, BaseShapeBuildProps } from '@diagram-craft/canvas/shape/BaseShape';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { Box } from '@diagram-craft/geometry/box';
import { Extent } from '@diagram-craft/geometry/extent';
import { deepClone } from '@diagram-craft/utils/object';
import { DeepWriteable } from '@diagram-craft/utils/types';
import { Anchor } from '@diagram-craft/model/types';
import {
  assertHAlign,
  assertLineCap,
  assertLineJoin,
  assertVAlign
} from '@diagram-craft/model/diagramProps';
import { xNum } from './utils';

declare global {
  interface NodeProps {
    drawio?: {
      shape?: string;
    };
  }
}

const makeShapeTransform =
  (source: Extent, target: Box) => (p: Point, _type?: 'point' | 'distance') => {
    if (_type === 'distance') {
      return {
        x: (p.x / source.w) * target.w,
        y: (p.y / source.h) * target.h
      };
    }
    return {
      x: target.x + (p.x / source.w) * target.w,
      y: target.y + (p.y / source.h) * target.h
    };
  };

const isShapeElement = ($el: Element) =>
  $el.nodeName === 'rect' ||
  $el.nodeName === 'ellipse' ||
  $el.nodeName === 'path' ||
  $el.nodeName === 'roundrect';

const parse = (def: DiagramNode): Element => {
  if (def.cache.has('element')) return def.cache.get('element') as Element;

  const parser = new DOMParser();
  const $shape = parser.parseFromString(
    atob(def.propsForRendering.drawio.shape),
    'application/xml'
  );
  def.cache.set('element', $shape.documentElement);
  return def.cache.get('element') as Element;
};

const parseShapeElement = ($el: Element, pathBuilder: PathBuilder) => {
  if ($el.nodeName === 'rect') {
    PathBuilderHelper.rect(pathBuilder, {
      x: xNum($el, 'x'),
      y: xNum($el, 'y'),
      w: xNum($el, 'w'),
      h: xNum($el, 'h'),
      r: 0
    });
  } else if ($el.nodeName === 'roundrect') {
    const [x, y, w, h, arcsize] = ['x', 'y', 'w', 'h', 'arcsize'].map(attr => xNum($el, attr));

    const rx = (arcsize / 100) * w;
    const ry = (arcsize / 100) * h;

    const r = Math.min(rx, ry);

    const dw = w - 2 * r;
    const dh = h - 2 * r;

    pathBuilder.moveTo(Point.of(x + r, y));
    pathBuilder.lineTo(Point.of(x + r + dw, y));
    pathBuilder.arcTo(Point.of(x + w, y + r), r, r, 0, 0, 1);
    pathBuilder.lineTo(Point.of(x + w, y + r + dh));
    pathBuilder.arcTo(Point.of(x + r + dw, y + h), r, r, 0, 0, 1);
    pathBuilder.lineTo(Point.of(x + r, y + h));
    pathBuilder.arcTo(Point.of(x, y + r + dh), r, r, 0, 0, 1);
    pathBuilder.lineTo(Point.of(x, y + r));
    pathBuilder.arcTo(Point.of(x + r, y), r, r, 0, 0, 1);

    return pathBuilder;
  } else if ($el.nodeName === 'ellipse') {
    const cx = xNum($el, 'x');
    const cy = xNum($el, 'y');
    const cw = xNum($el, 'w');
    const ch = xNum($el, 'h');

    pathBuilder.moveTo(Point.of(cx + cw / 2, cy));
    pathBuilder.arcTo(Point.of(cx + cw, cy + ch / 2), cw / 2, ch / 2, 0, 0, 1);
    pathBuilder.arcTo(Point.of(cx + cw / 2, cy + ch), cw / 2, ch / 2, 0, 0, 1);
    pathBuilder.arcTo(Point.of(cx, cy + ch / 2), cw / 2, ch / 2, 0, 0, 1);
    pathBuilder.arcTo(Point.of(cx + cw / 2, cy), cw / 2, ch / 2, 0, 0, 1);
  } else if ($el.nodeName === 'path') {
    for (const $pc of $el.childNodes) {
      if ($pc.nodeType !== Node.ELEMENT_NODE) continue;

      const $pce = $pc as Element;
      if ($pc.nodeName === 'move') {
        pathBuilder.moveTo(Point.of(xNum($pce, 'x'), xNum($pce, 'y')));
      } else if ($pc.nodeName === 'line') {
        pathBuilder.lineTo(Point.of(xNum($pce, 'x'), xNum($pce, 'y')));
      } else if ($pc.nodeName === 'close') {
        pathBuilder.close();
      } else if ($pc.nodeName === 'curve') {
        pathBuilder.cubicTo(
          Point.of(xNum($pce, 'x3'), xNum($pce, 'y3')),
          Point.of(xNum($pce, 'x1'), xNum($pce, 'y1')),
          Point.of(xNum($pce, 'x2'), xNum($pce, 'y2'))
        );
      } else if ($pc.nodeName === 'quad') {
        pathBuilder.quadTo(
          Point.of(xNum($pce, 'x2'), xNum($pce, 'y2')),
          Point.of(xNum($pce, 'x1'), xNum($pce, 'y1'))
        );
      } else if ($pc.nodeName === 'arc') {
        pathBuilder.arcTo(
          Point.of(xNum($pce, 'x'), xNum($pce, 'y')),
          xNum($pce, 'rx'),
          xNum($pce, 'ry'),
          xNum($pce, 'x-axis-rotation'),
          xNum($pce, 'large-arc-flag') as 0 | 1,
          xNum($pce, 'sweep-flag') as 0 | 1
        );
      } else {
        console.log(`No support for path.` + $pc.nodeName);
      }
    }
  }
};

export class DrawioShapeNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('drawio', 'Drawio Shape', DrawioShapeComponent);
  }

  getDefaultConfig(node: DiagramNode): { size: Extent } {
    const shape = parse(node);

    return {
      size: {
        w: xNum(shape, 'w', 100),
        h: xNum(shape, 'h', 100)
      }
    };
  }

  getDefaultAspectRatio(def: DiagramNode) {
    const shape = parse(def);

    return xNum(shape, 'w', 100) / xNum(shape, 'h', 100);
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const shape = parse(def);

    const h = xNum(shape, 'h', 100);
    const w = xNum(shape, 'w', 100);

    const pathBuilder = new PathBuilder(makeShapeTransform({ w, h }, def.bounds));

    const background = shape.querySelector('background');
    this.parseElement(background, pathBuilder);

    if (pathBuilder.getPaths().all().length === 0) {
      const foreground = shape.querySelector('foreground');
      this.parseElement(foreground, pathBuilder);
    }

    return pathBuilder;
  }

  private parseElement(element: Element | null, pathBuilder: PathBuilder) {
    if (!element) return;

    const outlines = element!.childNodes;
    for (let i = 0; i < outlines.length; i++) {
      const node = outlines.item(i);
      if (node.nodeType !== Node.ELEMENT_NODE) continue;

      const $el = node as Element;
      if (isShapeElement($el)) {
        parseShapeElement($el, pathBuilder);
      } else {
        //console.log(`No support for ${$el.nodeName}`);
        //VERIFY_NOT_REACHED();
      }
    }
  }

  getAnchors(def: DiagramNode) {
    const shape = parse(def);

    const newAnchors: Array<Anchor> = [];
    newAnchors.push({ point: { x: 0.5, y: 0.5 }, clip: true });

    const $constraints = shape.getElementsByTagName('constraint');
    for (let i = 0; i < $constraints.length; i++) {
      const $constraint = $constraints.item(i)!;
      if ($constraint.nodeType !== Node.ELEMENT_NODE) continue;

      const x = xNum($constraint, 'x');
      const y = xNum($constraint, 'y');
      newAnchors.push({ point: Point.of(x, y), clip: false });
    }

    return newAnchors;
  }
}

class DrawioShapeComponent extends BaseShape {
  buildShape(props: BaseShapeBuildProps, shapeBuilder: ShapeBuilder) {
    const shapeNodeDefinition = this.def as DrawioShapeNodeDefinition;

    const boundary = shapeNodeDefinition.getBoundingPathBuilder(props.node).getPaths();

    const $shape = parse(props.node);

    const w = xNum($shape, 'w', 100);
    const h = xNum($shape, 'h', 100);

    let style = deepClone(props.nodeProps as DeepWriteable<NodeProps>);
    let savedStyle = style;

    let currentShape: (p: NodeProps) => void = p => {
      return shapeBuilder.boundaryPath(boundary, p);
    };

    let backgroundDrawn = false;

    const drawBackground = () => {
      currentShape({
        fill: {
          color: 'transparent'
        },
        stroke: {
          color: 'transparent'
        }
      });
      backgroundDrawn = true;
    };

    // TODO: This is partially repeated below
    const $styles = $shape.querySelector('background')?.childNodes;
    if ($styles) {
      for (let i = 0; i < $styles.length; i++) {
        const $node = $styles.item(i);
        if ($node.nodeType !== Node.ELEMENT_NODE) continue;

        const $el = $node as Element;
        if ($el.nodeName === 'save') {
          savedStyle = deepClone(style);
        } else if ($el.nodeName === 'restore') {
          style = deepClone(savedStyle);
        } else if ($el.nodeName === 'fontcolor') {
          style.text!.color = $el.getAttribute('color')!;
        } else if ($el.nodeName === 'fontsize') {
          style.text!.fontSize = xNum($el, 'size')!;
        } else if ($el.nodeName === 'strokecolor') {
          style.stroke!.color = $el.getAttribute('color')!;
        } else if ($el.nodeName === 'fillcolor') {
          style.fill!.color = $el.getAttribute('color')!;
        } else if ($el.nodeName === 'fillalpha') {
          style.fill!.color = `color(from ${style.fill!.color} srgb r g b / ${$el.getAttribute('alpha')!})`;
        } else if ($el.nodeName === 'strokealpha') {
          style.stroke!.color = `color(from ${style.stroke!.color} srgb r g b / ${$el.getAttribute('alpha')!})`;
        } else if ($el.nodeName === 'alpha') {
          style.fill!.color = `color(from ${style.fill!.color} srgb r g b / ${$el.getAttribute('alpha')!})`;
          style.stroke!.color = `color(from ${style.stroke!.color} srgb r g b / ${$el.getAttribute('alpha')!})`;
        } else if ($el.nodeName === 'strokewidth') {
          style.stroke!.width = xNum($el, 'width');
        } else if ($el.nodeName === 'dashpattern') {
          style.stroke!.pattern = $el.getAttribute('pattern')!;
        } else if ($el.nodeName === 'dashed') {
          if ($el.getAttribute('dashed') === '0') {
            style.stroke!.pattern = undefined;
          }
        } else if ($el.nodeName === 'miterlimit') {
          style.stroke!.miterLimit = xNum($el, 'miterlimit')!;
        } else if ($el.nodeName === 'linecap') {
          const lineCap =
            $el.getAttribute('linecap') === 'flat' ? 'round' : $el.getAttribute('linecap');

          if (!lineCap) continue;
          assertLineCap(lineCap);

          style.stroke!.lineCap = lineCap;
        } else if ($el.nodeName === 'linejoin') {
          const lineJoin = $el.getAttribute('linejoin');

          if (!lineJoin) continue;
          assertLineJoin(lineJoin);

          style.stroke!.lineJoin = lineJoin;
        }
      }
    }

    let textId = 1;

    const $outlines = $shape.querySelector('foreground')!.childNodes;
    for (let i = 0; i < $outlines.length; i++) {
      const $node = $outlines.item(i);
      if ($node.nodeType !== Node.ELEMENT_NODE) continue;

      const $el = $node as Element;
      if ($el.nodeName === 'fillstroke') {
        currentShape(style);
        backgroundDrawn = true;
      } else if ($el.nodeName === 'fill') {
        const old = style.stroke!.color;
        style.stroke!.color = 'transparent';
        currentShape(style);
        style.stroke!.color = old;
        backgroundDrawn = true;
      } else if ($el.nodeName === 'stroke') {
        const old = style.fill!.color;
        style.fill!.color = 'transparent';
        currentShape(style);
        style.fill!.color = old;
        backgroundDrawn = true;
      } else if ($el.nodeName === 'text') {
        if (!backgroundDrawn) drawBackground();

        const align = $el.getAttribute('align') ?? 'center';
        assertHAlign(align);

        const valign = $el.getAttribute('valign') ?? 'middle';
        assertVAlign(valign);

        shapeBuilder.text(
          this,
          (++textId).toString(),
          {
            text: $el.getAttribute('str')!,
            align: align,
            valign: valign,
            color: style.text?.color ?? style.fill?.color,
            fontSize: (style.text?.fontSize ?? 12) * (props.node.bounds.h / xNum($shape, 'h'))
          },
          {
            x: props.node.bounds.x + (xNum($el, 'x') / w) * props.node.bounds.w - 30,
            y: props.node.bounds.y + (xNum($el, 'y') / h) * props.node.bounds.h - 20,
            w: 60,
            h: 40,
            r: 0
          }
        );
        backgroundDrawn = true;
      } else if ($el.nodeName === 'save') {
        savedStyle = deepClone(style);
      } else if ($el.nodeName === 'restore') {
        style = deepClone(savedStyle);
      } else if ($el.nodeName === 'strokecolor') {
        style.stroke!.color = $el.getAttribute('color')!;
      } else if ($el.nodeName === 'fontcolor') {
        style.text!.color = $el.getAttribute('color')!;
      } else if ($el.nodeName === 'fontsize') {
        style.text!.fontSize = xNum($el, 'size')!;
      } else if ($el.nodeName === 'fillcolor') {
        style.fill!.color = $el.getAttribute('color')!;
      } else if ($el.nodeName === 'fillalpha') {
        style.fill!.color = `color(from ${style.fill!.color} srgb r g b / ${$el.getAttribute('alpha')!})`;
      } else if ($el.nodeName === 'strokealpha') {
        style.stroke!.color = `color(from ${style.stroke!.color} srgb r g b / ${$el.getAttribute('alpha')!})`;
      } else if ($el.nodeName === 'alpha') {
        style.fill!.color = `color(from ${style.fill!.color} srgb r g b / ${$el.getAttribute('alpha')!})`;
        style.stroke!.color = `color(from ${style.stroke!.color} srgb r g b / ${$el.getAttribute('alpha')!})`;
      } else if ($el.nodeName === 'strokewidth') {
        style.stroke!.width = xNum($el, 'width');
      } else if ($el.nodeName === 'dashpattern') {
        style.stroke!.pattern = $el.getAttribute('pattern')!;
      } else if ($el.nodeName === 'dashed') {
        if ($el.getAttribute('dashed') === '0') {
          style.stroke!.pattern = undefined;
        }
      } else if ($el.nodeName === 'miterlimit') {
        style.stroke!.miterLimit = xNum($el, 'miterlimit')!;
      } else if ($el.nodeName === 'linecap') {
        const lineCap =
          $el.getAttribute('linecap') === 'flat' ? 'round' : $el.getAttribute('linecap');

        if (!lineCap) continue;
        assertLineCap(lineCap);

        style.stroke!.lineCap = lineCap;
      } else if ($el.nodeName === 'linejoin') {
        const lineJoin = $el.getAttribute('linejoin');

        if (!lineJoin) continue;
        assertLineJoin(lineJoin);

        style.stroke!.lineJoin = lineJoin;
      } else if (isShapeElement($el)) {
        if (!backgroundDrawn) drawBackground();

        const pathBuilder = new PathBuilder(makeShapeTransform({ w, h }, props.node.bounds));
        parseShapeElement($el, pathBuilder);

        if (pathBuilder.getPaths().all().length === 0) continue;

        currentShape = (p: NodeProps) => {
          shapeBuilder.path(pathBuilder.getPaths().all(), p);
        };
      } else {
        console.log(`No support for ${$el.nodeName}`);
        //VERIFY_NOT_REACHED();
      }
    }

    shapeBuilder.text(this);
  }
}
