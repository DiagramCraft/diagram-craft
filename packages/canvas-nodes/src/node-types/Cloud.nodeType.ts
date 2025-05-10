import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import { BaseNodeComponent } from '@diagram-craft/canvas/components/BaseNodeComponent';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Box } from '@diagram-craft/geometry/box';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { makeMemo } from '@diagram-craft/utils/memoize';

const boundsCache = makeMemo<Box>();

// NodeDefinition and Shape *****************************************************

export class CloudNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('cloud', 'Cloud', CloudNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<CloudNodeDefinition> {};

  getBoundingPathBuilder(def: DiagramNode) {
    const pathBuilder = PathListBuilder.fromString(
      `
      M -77.23 12.88,
      C -124.99 -22.27 -76.76 -63.98 -53.35 -57.41,
      C -41.41 -110.13 -0.22 -107.85 30.23 -74.98,
      C 66.05 -110.13 100.44 -83.09 88.30 -24.37,
      C 106.15 0.79 101.87151 48.02 66.05 48.02,
      C 42.17 100.74 15.96 120.55901 -41.41 65.59,
      C -73.99 93.66 -101.11 65.59266 -77.23 12.88
    `
    );

    const t = TransformFactory.fromTo(
      boundsCache(() => pathBuilder.getPaths().bounds()),
      Box.withoutRotation(def.bounds)
    );
    pathBuilder.withTransform(t);

    return pathBuilder;
  }
}
