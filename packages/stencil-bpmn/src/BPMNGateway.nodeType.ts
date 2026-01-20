import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder, fromUnitLCS } from '@diagram-craft/geometry/pathListBuilder';
import { Point, _p } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Anchor } from '@diagram-craft/model/anchor';
import { Box } from '@diagram-craft/geometry/box';

export class BPMNGatewayNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('bpmnGateway', 'BPMN Gateway', BPMNGatewayNodeDefinition.Shape);
  }

  getShapeAnchors(_def: DiagramNode): Anchor[] {
    return [
      { start: _p(0.5, 0), id: '1', type: 'point', isPrimary: true, normal: -Math.PI / 2 },
      { start: _p(1, 0.5), id: '2', type: 'point', isPrimary: true, normal: 0 },
      { start: _p(0.5, 1), id: '3', type: 'point', isPrimary: true, normal: Math.PI / 2 },
      { start: _p(0, 0.5), id: '4', type: 'point', isPrimary: true, normal: Math.PI },
      { start: _p(0.5, 0.5), clip: true, id: 'c', type: 'center' }
    ];
  }

  static Shape = class extends BaseNodeComponent<BPMNGatewayNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      const boundary = new BPMNGatewayNodeDefinition()
        .getBoundingPathBuilder(props.node)
        .getPaths();

      shapeBuilder.boundaryPath(boundary.all());

      shapeBuilder.text(
        this,
        '1',
        props.node.getText(),
        props.nodeProps.text,
        Box.fromCorners(
          _p(props.node.bounds.x - 50, props.node.bounds.y + props.node.bounds.h + 10),
          _p(
            props.node.bounds.x + props.node.bounds.w + 50,
            props.node.bounds.y + props.node.bounds.h + 20
          )
        )
      );
    }
  };

  getBoundingPathBuilder(def: DiagramNode) {
    const pathBuilder = new PathListBuilder().withTransform(fromUnitLCS(def.bounds));
    pathBuilder.moveTo(Point.of(0.5, 0));
    pathBuilder.lineTo(Point.of(1, 0.5));
    pathBuilder.lineTo(Point.of(0.5, 1));
    pathBuilder.lineTo(Point.of(0, 0.5));
    pathBuilder.lineTo(Point.of(0.5, 0));

    return pathBuilder;
  }
}
