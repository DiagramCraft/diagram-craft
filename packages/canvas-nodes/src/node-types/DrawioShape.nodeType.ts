import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { PathBuilder, PathBuilderHelper } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { BaseShape, BaseShapeBuildProps } from '@diagram-craft/canvas/shape/BaseShape';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { Box } from '@diagram-craft/geometry/box';
import { Extent } from '@diagram-craft/geometry/extent';
import { deepClone } from '@diagram-craft/utils/object';
import { DeepWriteable } from '@diagram-craft/utils/types';
import { Path } from '@diagram-craft/geometry/path';

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

const xNum = (el: Element, name: string) => {
  return Number(el.getAttribute(name));
};

// TODO: Parse constraints as well

export class DrawioShapeNodeDefinition extends ShapeNodeDefinition {
  constructor(
    id: string,
    name: string,
    public readonly shape: Element
  ) {
    super(id, name, DrawioShapeComponent);
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const h = xNum(this.shape, 'h');
    const w = xNum(this.shape, 'w');

    const pathBuilder = new PathBuilder(makeShapeTransform({ w, h }, def.bounds));

    const background = this.shape.querySelector('background');

    if (!background) {
      PathBuilderHelper.rect(pathBuilder, { x: 0, y: 0, w, h, r: 0 });
      return pathBuilder;
    }

    const outlines = background.childNodes;
    for (let i = 0; i < outlines.length; i++) {
      const node = outlines.item(i);
      if (node.nodeType !== Node.ELEMENT_NODE) continue;

      const el = node as Element;
      if (el.nodeName === 'rect') {
        PathBuilderHelper.rect(pathBuilder, {
          x: xNum(el, 'x'),
          y: xNum(el, 'y'),
          w: xNum(el, 'w'),
          h: xNum(el, 'h'),
          r: 0
        });
      } else {
        VERIFY_NOT_REACHED(el.nodeName);
      }
    }

    return pathBuilder;
  }
}

class DrawioShapeComponent extends BaseShape {
  buildShape(props: BaseShapeBuildProps, shapeBuilder: ShapeBuilder) {
    const shapeNodeDefinition = this.shapeNodeDefinition as DrawioShapeNodeDefinition;

    const boundary = shapeNodeDefinition.getBoundingPathBuilder(props.node).getPath();

    const $shape = shapeNodeDefinition.shape!;

    const w = xNum($shape, 'w');
    const h = xNum($shape, 'h');

    const style = deepClone(props.nodeProps as DeepWriteable<NodeProps>);

    let currentShape: (p: NodeProps) => void = p => {
      shapeBuilder.boundaryPath(boundary, p);
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

    const $foreground = $shape.querySelector('foreground')!;
    const $outlines = $foreground.childNodes;
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
      } else if ($el.nodeName === 'strokecolor') {
        style.stroke!.color = $el.getAttribute('color')!;
      } else if ($el.nodeName === 'fillcolor') {
        style.fill!.color = $el.getAttribute('color')!;
        style.fill!.type = 'solid';
      } else if ($el.nodeName === 'strokewidth') {
        style.stroke!.width = xNum($el, 'width');
      } else if ($el.nodeName === 'rect' || $el.nodeName === 'ellipse' || $el.nodeName === 'path') {
        if (!backgroundDrawn) drawBackground();

        let pathBuilder = new PathBuilder(makeShapeTransform({ w, h }, props.node.bounds));
        const paths: Path[] = [];

        if ($el.nodeName === 'rect') {
          PathBuilderHelper.rect(pathBuilder, {
            x: xNum($el, 'x'),
            y: xNum($el, 'y'),
            w: xNum($el, 'w'),
            h: xNum($el, 'h'),
            r: 0
          });

          paths.push(pathBuilder.getPath());
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

          paths.push(pathBuilder.getPath());
        } else if ($el.nodeName === 'path') {
          for (const $pc of $el.childNodes) {
            if ($pc.nodeType !== Node.ELEMENT_NODE) continue;

            const $pce = $pc as Element;
            if ($pc.nodeName === 'move') {
              if (!pathBuilder.isEmpty()) {
                paths.push(pathBuilder.getPath());
                pathBuilder = new PathBuilder(makeShapeTransform({ w, h }, props.node.bounds));
              }

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

          if (!pathBuilder.isEmpty()) {
            paths.push(pathBuilder.getPath());
          }
        }

        currentShape = (p: NodeProps) => {
          shapeBuilder.path(paths, p);
        };
      } else {
        console.log(`No support for ${$el.nodeName}`);
        //VERIFY_NOT_REACHED();
      }
    }
  }
}
