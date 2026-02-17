import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Anchor } from '@diagram-craft/model/anchor';
import { _p, Point } from '@diagram-craft/geometry/point';
import { Translation } from '@diagram-craft/geometry/transform';

const HEAD_RATIO = 80 / 180;
const HEAD_Y_RATIO = 40 / 180;
const BODY_TOP_RATIO = 71 / 180;
const BODY_RADIUS = 42;

type PersonGeometry = {
  headRadius: number;
  headCenterY: number;
  bodyTop: number;
  bodyHeight: number;
  bodyRadius: number;
  leftIntersectX: number;
  rightIntersectX: number;
};

const calcGeometry = (w: number, h: number): PersonGeometry => {
  // Use smaller dimension as reference to maintain proportions
  const refSize = Math.min(w, h);
  const headRadius = (refSize * HEAD_RATIO) / 2;
  const headCenterY = refSize * HEAD_Y_RATIO;
  const bodyTop = refSize * BODY_TOP_RATIO;
  const bodyHeight = h - bodyTop;
  const bodyRadius = Math.min(BODY_RADIUS, w / 4, bodyHeight / 4);

  // Calculate where circle intersects the top of the rect
  const dy = bodyTop - headCenterY;
  const dx = Math.sqrt(headRadius * headRadius - dy * dy);
  const leftIntersectX = w / 2 - dx;
  const rightIntersectX = w / 2 + dx;

  return {
    headRadius,
    headCenterY,
    bodyTop,
    bodyHeight,
    bodyRadius,
    leftIntersectX,
    rightIntersectX
  };
};

export class C4PersonNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('c4Person', 'C4 Person', C4PersonComponent);
  }

  getShapeAnchors(node: DiagramNode): Anchor[] {
    // Center the east/west anchors on the body
    const { bodyTop, bodyHeight } = calcGeometry(node.bounds.w, node.bounds.h);
    const bodyCenterY = (bodyTop + bodyHeight / 2) / node.bounds.h;
    return [
      { id: '1', start: _p(0.5, 1), type: 'point', isPrimary: true, normal: Math.PI / 2 },
      { id: '2', start: _p(0.5, 0), type: 'point', isPrimary: true, normal: -Math.PI / 2 },
      { id: '3', start: _p(1, bodyCenterY), type: 'point', isPrimary: true, normal: 0 },
      { id: '4', start: _p(0, bodyCenterY), type: 'point', isPrimary: true, normal: Math.PI },
      { id: 'c', start: _p(0.5, 0.5), clip: true, type: 'center' }
    ];
  }

  getBoundingPathBuilder(node: DiagramNode) {
    const bounds = node.bounds;
    const { headRadius, bodyTop, bodyHeight, bodyRadius, leftIntersectX, rightIntersectX } =
      calcGeometry(bounds.w, bounds.h);

    const b = new PathListBuilder().withTransform([new Translation(bounds)]);

    // Start at left intersection point
    b.moveTo(Point.of(leftIntersectX, bodyTop));

    // Arc up and around the top of the circle to right intersection (large arc, clockwise)
    b.arcTo(Point.of(rightIntersectX, bodyTop), headRadius, headRadius, 0, 1, 1);

    // Continue along rect top to right corner
    b.lineTo(Point.of(bounds.w - bodyRadius, bodyTop));
    b.arcTo(Point.of(bounds.w, bodyTop + bodyRadius), bodyRadius, bodyRadius, 0, 0, 1);

    // Down right side
    b.lineTo(Point.of(bounds.w, bodyTop + bodyHeight - bodyRadius));
    b.arcTo(Point.of(bounds.w - bodyRadius, bodyTop + bodyHeight), bodyRadius, bodyRadius, 0, 0, 1);

    // Along bottom
    b.lineTo(Point.of(bodyRadius, bodyTop + bodyHeight));
    b.arcTo(Point.of(0, bodyTop + bodyHeight - bodyRadius), bodyRadius, bodyRadius, 0, 0, 1);

    // Up left side
    b.lineTo(Point.of(0, bodyTop + bodyRadius));
    b.arcTo(Point.of(bodyRadius, bodyTop), bodyRadius, bodyRadius, 0, 0, 1);

    // Back along rect top to starting point
    b.lineTo(Point.of(leftIntersectX, bodyTop));

    b.close();

    return b;
  }
}

export class C4PersonComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const bounds = props.node.bounds;
    const { headRadius, bodyTop, bodyHeight, leftIntersectX, rightIntersectX } = calcGeometry(
      bounds.w,
      bounds.h
    );

    shapeBuilder.boundaryPath(
      new C4PersonNodeDefinition().getBoundingPathBuilder(props.node).getPaths().all()
    );

    // Draw the interior arc (lower part of circle inside the rect)
    const interiorPath = new PathListBuilder().withTransform([new Translation(bounds)]);
    interiorPath.moveTo(Point.of(leftIntersectX, bodyTop));
    // Arc down and around to right intersection (counter-clockwise)
    interiorPath.arcTo(Point.of(rightIntersectX, bodyTop), headRadius, headRadius, 0, 0, 0);

    shapeBuilder.buildInterior().addShape(interiorPath).stroke();

    // Draw two vertical lines inside the body (legs)
    const bodyBottom = bodyTop + bodyHeight;
    const lineHeight = bodyHeight * 0.5;
    const leftLineX = bounds.w * 0.2;
    const rightLineX = bounds.w * 0.8;

    const armsPath = new PathListBuilder().withTransform([new Translation(bounds)]);
    armsPath.moveTo(Point.of(leftLineX, bodyBottom));
    armsPath.lineTo(Point.of(leftLineX, bodyBottom - lineHeight));

    armsPath.moveTo(Point.of(rightLineX, bodyBottom));
    armsPath.lineTo(Point.of(rightLineX, bodyBottom - lineHeight));

    shapeBuilder.buildInterior().addShape(armsPath).stroke({
      width: 1,
      color: props.nodeProps.stroke.color
    });

    // Position text within the body area, between the two leg lines
    const textBounds = {
      x: bounds.x + bounds.w * 0.2,
      y: bounds.y + bodyTop,
      w: bounds.w * 0.6,
      h: bodyHeight,
      r: bounds.r
    };
    shapeBuilder.text(this, '1', undefined, undefined, textBounds);
  }
}
