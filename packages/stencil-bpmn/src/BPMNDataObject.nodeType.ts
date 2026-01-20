import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Box } from '@diagram-craft/geometry/box';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { mustExist } from '@diagram-craft/utils/assert';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { _p } from '@diagram-craft/geometry/point';

const templatePaths = PathListBuilder.fromString(
  `
      M 0 0
      L 7 0
      L 10 2.5
      L 10 10
      L 0 10
      Z
    `
).getPaths();

const innerPaths = PathListBuilder.fromString(
  `
      M 7 0
      L 7 2.5
      L 10 2.5
    `
).getPaths();

const bounds = templatePaths.bounds();
const path = mustExist(templatePaths.all()[0]);

// NodeDefinition and Shape *****************************************************

export class BPMNDataObjectNodeType extends ShapeNodeDefinition {
  constructor() {
    super('bpmnDataObject', 'BPMN Data Object', BPMNDataObjectNodeType.Shape);
  }

  static Shape = class extends BaseNodeComponent<BPMNDataObjectNodeType> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      shapeBuilder.boundaryPath(
        new BPMNDataObjectNodeType().getBoundingPathBuilder(props.node).getPaths().all()
      );

      shapeBuilder.path(
        PathListBuilder.fromPath(mustExist(innerPaths.all()[0]))
          .getPaths(TransformFactory.fromTo(bounds, Box.withoutRotation(props.node.bounds)))
          .all(),
        undefined,
        {
          style: { fill: 'none' }
        }
      );

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
    const t = TransformFactory.fromTo(bounds, Box.withoutRotation(def.bounds));
    return PathListBuilder.fromPath(path).withTransform(t);
  }
}
