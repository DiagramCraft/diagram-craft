import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { fromUnitLCS, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Anchor } from '@diagram-craft/model/anchor';
import { Box } from '@diagram-craft/geometry/box';

const RADIUS = 6;

function buildRoundedRectPath(
  bounds: Box,
  x: number,
  y: number,
  w: number,
  h: number,
  xr: number,
  yr: number
) {
  return new PathListBuilder()
    .withTransform(fromUnitLCS(bounds))
    .moveTo(_p(x + xr, y))
    .lineTo(_p(x + w - xr, y))
    .arcTo(_p(x + w, y + yr), xr, yr, 0, 0, 1)
    .lineTo(_p(x + w, y + h - yr))
    .arcTo(_p(x + w - xr, y + h), xr, yr, 0, 0, 1)
    .lineTo(_p(x + xr, y + h))
    .arcTo(_p(x, y + h - yr), xr, yr, 0, 0, 1)
    .lineTo(_p(x, y + yr))
    .arcTo(_p(x + xr, y), xr, yr, 0, 0, 1);
}

export class C4BrowserRectNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('c4BrowserRect', 'C4 Browser', C4BrowserRectComponent);
  }

  getShapeAnchors(_def: DiagramNode): Anchor[] {
    return [
      { id: '1', start: _p(0.5, 1), type: 'point', isPrimary: true, normal: Math.PI / 2 },
      { id: '2', start: _p(0.5, 0), type: 'point', isPrimary: true, normal: -Math.PI / 2 },
      { id: '3', start: _p(1, 0.5), type: 'point', isPrimary: true, normal: 0 },
      { id: '4', start: _p(0, 0.5), type: 'point', isPrimary: true, normal: Math.PI },
      { id: 'c', start: _p(0.5, 0.5), clip: true, type: 'center' }
    ];
  }

  getBoundingPathBuilder(node: DiagramNode) {
    const radius = RADIUS;
    const xr = radius / node.bounds.w;
    const yr = radius / node.bounds.h;

    return buildRoundedRectPath(node.bounds, 0, 0, 1, 1, xr, yr);
  }
}

const buildCirclePath = (
  bounds: Box,
  x: number,
  y: number,
  xr: number,
  yr: number
): PathListBuilder => {
  return new PathListBuilder()
    .withTransform(fromUnitLCS(bounds))
    .moveTo(_p(x, y - yr))
    .arcTo(_p(x + xr, y), xr, yr, 0, 0, 1)
    .arcTo(_p(x, y + yr), xr, yr, 0, 0, 1)
    .arcTo(_p(x - xr, y), xr, yr, 0, 0, 1)
    .arcTo(_p(x, y - yr), xr, yr, 0, 0, 1);
};

export class C4BrowserRectComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    shapeBuilder.boundaryPath(
      new C4BrowserRectNodeDefinition().getBoundingPathBuilder(props.node).getPaths().all()
    );

    const radius = RADIUS;
    const xr = radius / props.node.bounds.w;
    const yr = radius / props.node.bounds.h;

    const innerRadius = 5;
    const xir = innerRadius / props.node.bounds.w;
    const yir = innerRadius / props.node.bounds.h;
    const h = 15 / props.node.bounds.h;
    const H = (15 + innerRadius) / props.node.bounds.h;

    const sx = (props.node.renderProps.stroke.width - 1) / (2 * props.node.bounds.w);
    const sy = (props.node.renderProps.stroke.width - 1) / (2 * props.node.bounds.h);

    shapeBuilder
      .buildInterior()
      .addShape(
        new PathListBuilder()
          .withTransform(fromUnitLCS(props.node.bounds))
          .moveTo(_p(xr + sx, sy))
          .lineTo(_p(1 - xr - sx, sy))
          .arcTo(_p(1 - sx, yr - sy), xr - sx, yr - sy, 0, 0, 1)
          .lineTo(_p(1 - sx, H - sy))
          .arcTo(_p(1 - xir - sx, h - sy), xir, yir, 0, 0, 0)
          .lineTo(_p(xir + sx, h - sy))
          .arcTo(_p(sx, H - sy), xir, yir, 0, 0, 0)
          .lineTo(_p(sx, yr - sy))
          .arcTo(_p(xr + sx, sy), xr - sx, yr - sy, 0, 0, 1)
      )
      .fill({
        color: props.nodeProps.stroke.color
      });

    /* Draw controls */

    const sxr = xr / 1.5;
    const syr = yr / 1.5;

    const strokeX = 3 / props.node.bounds.w;
    const strokeY = 3 / props.node.bounds.h;

    const left = strokeX - 1 / props.node.bounds.w;
    const top = strokeY - 1 / props.node.bounds.h;

    const space = 4 / props.node.bounds.w;

    shapeBuilder
      .buildInterior()
      .addShape(buildCirclePath(props.node.bounds, left + sxr, top + syr, sxr, syr))
      .fill({ color: props.nodeProps.fill.color });

    shapeBuilder
      .buildInterior()
      .addShape(
        buildCirclePath(props.node.bounds, left + 2 * sxr + space + sxr, top + syr, sxr, syr)
      )
      .fill({ color: props.nodeProps.fill.color });

    shapeBuilder
      .buildInterior()
      .addShape(
        buildCirclePath(
          props.node.bounds,
          left + 2 * sxr + space + 2 * sxr + space + sxr,
          top + syr,
          sxr,
          syr
        )
      )
      .fill({ color: props.nodeProps.fill.color });

    shapeBuilder
      .buildInterior()
      .addShape(
        buildRoundedRectPath(
          props.node.bounds,
          left + 3 * space + 6 * sxr,
          top,
          1 - (left + 3 * space + 6 * sxr) - 3 / props.node.bounds.w,
          2 * syr,
          sxr,
          syr
        )
      )
      .fill({ color: props.nodeProps.fill.color });

    shapeBuilder.text(this);
  }
}
