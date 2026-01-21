import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {}
  }
}

// NodeDefinition and Shape *****************************************************

export class BPMNChoreographyEnvelopeNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super(
      'bpmnChoreographyEnvelope',
      'BPMN Choreography Envelope',
      BPMNChoreographyEnvelopeNodeDefinition.Shape
    );
  }

  static Shape = class extends BaseNodeComponent<BPMNChoreographyEnvelopeNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      const bounds = props.node.bounds;

      // Draw the envelope rectangle
      shapeBuilder.boundaryPath(this.def.getBoundingPathBuilder(props.node).getPaths().all());

      // Draw the envelope flap (triangle at the top)
      const flapPath = new PathListBuilder()
        .moveTo(_p(bounds.x, bounds.y))
        .lineTo(_p(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2))
        .lineTo(_p(bounds.x + bounds.w, bounds.y));

      shapeBuilder.path(flapPath.getPaths().all(), undefined, {
        style: { fill: 'none' }
      });

      // Draw the diagonal lines from bottom corners to center
      const leftDiagonal = new PathListBuilder()
        .moveTo(_p(bounds.x, bounds.y + bounds.h))
        .lineTo(_p(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2));

      shapeBuilder.path(leftDiagonal.getPaths().all(), undefined, {
        style: { fill: 'none' }
      });

      const rightDiagonal = new PathListBuilder()
        .moveTo(_p(bounds.x + bounds.w, bounds.y + bounds.h))
        .lineTo(_p(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2));

      shapeBuilder.path(rightDiagonal.getPaths().all(), undefined, {
        style: { fill: 'none' }
      });
    }
  };

  getBoundingPathBuilder(def: DiagramNode) {
    const bounds = def.bounds;

    return new PathListBuilder()
      .moveTo(_p(bounds.x, bounds.y))
      .lineTo(_p(bounds.x + bounds.w, bounds.y))
      .lineTo(_p(bounds.x + bounds.w, bounds.y + bounds.h))
      .lineTo(_p(bounds.x, bounds.y + bounds.h))
      .close();
  }
}
