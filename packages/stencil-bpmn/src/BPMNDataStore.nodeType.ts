import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Anchor } from '@diagram-craft/model/anchor';
import { LocalCoordinateSystem } from '@diagram-craft/geometry/lcs';
import { RECTANGULAR_SHAPE_ANCHORS } from '@diagram-craft/stencil-bpmn/utils';

const SIZE = 15;

export class BPMNDataStoreNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('bpmnDataStore', 'BPMN Data Store', BPMNDataStoreNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<BPMNDataStoreNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
      shapeBuilder.boundaryPath(boundary.all());

      const interior = this.def.getInteriorPathBuilder(props.node);
      shapeBuilder.buildInterior().addShape(interior).stroke();

      shapeBuilder.text(this, '1', props.node.getText(), props.nodeProps.text, {
        ...props.node.bounds,
        y: props.node.bounds.y + SIZE,
        h: props.node.bounds.h - SIZE
      });
    }
  };

  getShapeAnchors(_def: DiagramNode): Anchor[] {
    return RECTANGULAR_SHAPE_ANCHORS;
  }

  getInteriorPathBuilder(def: DiagramNode) {
    const size = SIZE / def.bounds.h;
    const lcs = new LocalCoordinateSystem(def.bounds, [0, 1], [0, 1], false);
    return new PathListBuilder()
      .withTransform(lcs.toGlobalTransforms)

      .moveTo(_p(0, size / 2))
      .arcTo(_p(0.5, size), 0.5, size / 2, 0, 0, 0)
      .arcTo(_p(1, size / 2), 0.5, size / 2, 0, 0, 0)

      .moveTo(_p(0, size / 2 + 0.05))
      .arcTo(_p(0.5, size + 0.05), 0.5, size / 2, 0, 0, 0)
      .arcTo(_p(1, size / 2 + 0.05), 0.5, size / 2, 0, 0, 0)

      .moveTo(_p(0, size / 2 + 0.1))
      .arcTo(_p(0.5, size + 0.1), 0.5, size / 2, 0, 0, 0)
      .arcTo(_p(1, size / 2 + 0.1), 0.5, size / 2, 0, 0, 0);
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const size = SIZE / def.bounds.h;

    const lcs = new LocalCoordinateSystem(def.bounds, [0, 1], [0, 1], false);
    return new PathListBuilder()
      .withTransform(lcs.toGlobalTransforms)
      .moveTo(_p(0, size / 2))
      .arcTo(_p(0.5, 0), 0.5, size / 2, 0, 0, 1)
      .arcTo(_p(1, size / 2), 0.5, size / 2, 0, 0, 1)
      .lineTo(_p(1, 1 - size / 2))
      .arcTo(_p(0.5, 1), 0.5, size / 2, 0, 0, 1)
      .arcTo(_p(0, 1 - size / 2), 0.5, size / 2, 0, 0, 1)
      .lineTo(_p(0, size / 2));
  }
}
