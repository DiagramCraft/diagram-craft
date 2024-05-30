import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { BaseNodeComponent } from '@diagram-craft/canvas/components/BaseNodeComponent';
import { PathBuilder } from '@diagram-craft/geometry/pathBuilder';
import { DiagramNode } from '@diagram-craft/model/diagramNode';

// NodeDefinition and Shape *****************************************************

export class CloudNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('cloud', 'Cloud', CloudNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<CloudNodeDefinition> {};

  // TODO: Round these numbers
  getBoundingPathBuilder(def: DiagramNode) {
    const pathBuilder = PathBuilder.fromString(`
      M -77.232385 12.876487,
      C -124.99341999999999 -22.267629 -76.759479 -63.97993700000001 -53.35186499999999 -57.411744,
      C -41.41160499999999 -110.12791999999999 -0.21532742999998788 -107.85114 30.229955000000004 -74.983802,
      C 66.050734 -110.12791999999999 100.44281000000001 -83.094287 88.298834 -24.370202999999997,
      C 106.14571000000001 0.7959394900000021 101.87151 48.020602000000004 66.050734 48.020602000000004,
      C 42.170214 100.73678000000001 15.961382000000008 120.55901 -41.411604999999994 65.59266,
      C -73.999863 93.65879199999999 -101.1129 65.59266 -77.232385 12.876486999999997
    `);

    pathBuilder.scaleTo(def.bounds);

    return pathBuilder;
  }

  getDefaultConfig() {
    return {
      size: { w: 100, h: 70 }
    };
  }
}
