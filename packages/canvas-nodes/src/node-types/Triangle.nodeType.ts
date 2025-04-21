import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { FullDirection } from '@diagram-craft/geometry/direction';

// NodeProps extension for custom props *****************************************

type ExtraProps = {
  direction?: FullDirection;
};

declare global {
  interface CustomNodeProps {
    triangle?: ExtraProps;
  }
}

registerCustomNodeDefaults('triangle', { direction: 'east' });

// NodeDefinition and Shape *****************************************************

export class TriangleNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('triangle', 'Triangle', TriangleComponent);
  }

  getBoundingPathBuilder(node: DiagramNode) {
    const pathBuilder = new PathListBuilder(unitCoordinateSystem(node.bounds));

    switch (node.renderProps.custom.triangle.direction) {
      case 'east':
        return pathBuilder.moveTo(_p(1, 0.5)).lineTo(_p(0, 1)).lineTo(_p(0, 0)).close();

      case 'west':
        return pathBuilder.moveTo(_p(0, 0.5)).lineTo(_p(1, 1)).lineTo(_p(1, 0)).close();

      case 'north':
        return pathBuilder.moveTo(_p(0.5, 1)).lineTo(_p(0, 0)).lineTo(_p(1, 0)).close();

      case 'south':
        return pathBuilder.moveTo(_p(0.5, 0)).lineTo(_p(0, 1)).lineTo(_p(1, 1)).close();
    }
  }
}

class TriangleComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const boundary = new TriangleNodeDefinition().getBoundingPathBuilder(props.node).getPaths();

    shapeBuilder.boundaryPath(boundary.all());
    shapeBuilder.text(this);
  }
}
