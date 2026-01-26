import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';

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

      // Draw the V-shape from the top
      const vShapePath = new PathListBuilder()
        .moveTo(_p(bounds.x, bounds.y))
        .lineTo(_p(bounds.x + bounds.w / 2, bounds.y + bounds.h / 2))
        .lineTo(_p(bounds.x + bounds.w, bounds.y));

      shapeBuilder.path(vShapePath.getPaths().all(), undefined, {
        style: { fill: 'none' }
      });
    }
  };
}
