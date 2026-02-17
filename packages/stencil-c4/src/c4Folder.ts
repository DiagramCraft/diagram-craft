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

const TAB_LEFT_RATIO = 13 / 180;
const TAB_RADIUS = 8;
const BODY_RADIUS = 5;

type FolderGeometry = {
  tabLeft: number;
  tabRight: number;
  tabRadius: number;
  bodyTop: number;
  bodyHeight: number;
  bodyRadius: number;
};

const calcGeometry = (w: number, h: number): FolderGeometry => {
  const tabWidth = Math.min(w / 2, 120);
  const tabHeight = Math.min(h / 3, 40);
  const tabLeft = Math.min(w * TAB_LEFT_RATIO, 20);
  const tabRight = tabLeft + tabWidth;
  const tabRadius = Math.min(TAB_RADIUS, tabWidth / 4, tabHeight / 4);
  const bodyTop = tabHeight / 2;
  const bodyHeight = h - bodyTop;
  const bodyRadius = Math.min(BODY_RADIUS, w / 4, bodyHeight / 4);

  return { tabLeft, tabRight, tabRadius, bodyTop, bodyHeight, bodyRadius };
};

export class C4FolderNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('c4Folder', 'C4 Folder', C4FolderComponent);
  }

  getShapeAnchors(node: DiagramNode): Anchor[] {
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
    const { tabLeft, tabRight, tabRadius, bodyTop, bodyHeight, bodyRadius } = calcGeometry(
      bounds.w,
      bounds.h
    );

    const b = new PathListBuilder().withTransform([new Translation(bounds)]);

    // Start at top-left of body (after corner radius)
    b.moveTo(Point.of(bodyRadius, bodyTop));

    // Go up to tab bottom-left
    b.lineTo(Point.of(tabLeft + tabRadius, bodyTop));
    b.lineTo(Point.of(tabLeft + tabRadius, tabRadius));
    b.arcTo(Point.of(tabLeft + tabRadius * 2, 0), tabRadius, tabRadius, 0, 0, 1);

    // Along tab top
    b.lineTo(Point.of(tabRight - tabRadius, 0));
    b.arcTo(Point.of(tabRight, tabRadius), tabRadius, tabRadius, 0, 0, 1);

    // Down tab right side to body top
    b.lineTo(Point.of(tabRight, bodyTop));

    // Continue along body top to right corner
    b.lineTo(Point.of(bounds.w - bodyRadius, bodyTop));
    b.arcTo(Point.of(bounds.w, bodyTop + bodyRadius), bodyRadius, bodyRadius, 0, 0, 1);

    // Down right side
    b.lineTo(Point.of(bounds.w, bodyTop + bodyHeight - bodyRadius));
    b.arcTo(Point.of(bounds.w - bodyRadius, bounds.h), bodyRadius, bodyRadius, 0, 0, 1);

    // Along bottom
    b.lineTo(Point.of(bodyRadius, bounds.h));
    b.arcTo(Point.of(0, bodyTop + bodyHeight - bodyRadius), bodyRadius, bodyRadius, 0, 0, 1);

    // Up left side
    b.lineTo(Point.of(0, bodyTop + bodyRadius));
    b.arcTo(Point.of(bodyRadius, bodyTop), bodyRadius, bodyRadius, 0, 0, 1);

    b.close();

    return b;
  }
}

export class C4FolderComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const bounds = props.node.bounds;
    const { tabLeft, tabRight, tabRadius, bodyTop, bodyHeight } = calcGeometry(bounds.w, bounds.h);

    shapeBuilder.boundaryPath(
      new C4FolderNodeDefinition().getBoundingPathBuilder(props.node).getPaths().all()
    );

    // Draw the interior line (bottom of tab inside body)
    const interiorPath = new PathListBuilder().withTransform([new Translation(bounds)]);
    interiorPath.moveTo(Point.of(tabLeft + tabRadius, bodyTop));
    interiorPath.lineTo(Point.of(tabRight, bodyTop));

    shapeBuilder.buildInterior().addShape(interiorPath).stroke();

    // Position text within the body area
    const textBounds = {
      x: bounds.x,
      y: bounds.y + bodyTop,
      w: bounds.w,
      h: bodyHeight,
      r: bounds.r
    };
    shapeBuilder.text(this, '1', undefined, undefined, textBounds);
  }
}
