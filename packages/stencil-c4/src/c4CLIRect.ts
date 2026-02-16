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

const RADIUS = 10;

export class C4CLIRectNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('c4CLIRect', 'C4 CLI', C4CLIRectComponent);
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

    return new PathListBuilder()
      .withTransform(fromUnitLCS(node.bounds))
      .moveTo(_p(xr, 0))
      .lineTo(_p(1 - xr, 0))
      .arcTo(_p(1, yr), xr, yr, 0, 0, 1)
      .lineTo(_p(1, 1 - yr))
      .arcTo(_p(1 - xr, 1), xr, yr, 0, 0, 1)
      .lineTo(_p(xr, 1))
      .arcTo(_p(0, 1 - yr), xr, yr, 0, 0, 1)
      .lineTo(_p(0, yr))
      .arcTo(_p(xr, 0), xr, yr, 0, 0, 1);
  }
}

export class C4CLIRectComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    shapeBuilder.boundaryPath(
      new C4CLIRectNodeDefinition().getBoundingPathBuilder(props.node).getPaths().all()
    );

    shapeBuilder.text(
      this,
      '2',
      '&gt;_',
      {
        fontSize: 24,
        color: 'stroke',
        bold: true,
        left: 8,
        top: 2,
        align: 'left',
        valign: 'top'
      },
      props.node.bounds
    );

    shapeBuilder.text(this);
  }
}
