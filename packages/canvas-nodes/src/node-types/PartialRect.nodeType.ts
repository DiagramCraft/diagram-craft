import { PathBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';

// NodeProps extension for custom props *****************************************

type ExtraProps = {
  north?: boolean;
  south?: boolean;
  east?: boolean;
  west?: boolean;
};

declare global {
  interface CustomNodeProps {
    partialRect?: ExtraProps;
  }
}

registerCustomNodeDefaults('partialRect', {
  north: true,
  south: true,
  east: true,
  west: true
});

export class PartialRectNodeDefinition extends ShapeNodeDefinition {
  constructor(name = 'partial-rect', displayName = 'PartialRectangle') {
    super(name, displayName, PartialRectComponent);
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));
    pathBuilder.moveTo(Point.of(-1, 1));
    pathBuilder.lineTo(Point.of(1, 1));
    pathBuilder.lineTo(Point.of(1, -1));
    pathBuilder.lineTo(Point.of(-1, -1));
    pathBuilder.lineTo(Point.of(-1, 1));

    return pathBuilder;
  }
}

class PartialRectComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const def = props.node;

    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
    shapeBuilder.boundaryPath(boundary.all(), {
      ...props.nodeProps,
      stroke: {
        ...props.nodeProps.stroke,
        enabled: false,
        color: 'transparent'
      }
    } as NodeProps);

    if (props.node.renderProps.custom.partialRect.north) {
      const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));
      pathBuilder.moveTo(Point.of(-1, 1));
      pathBuilder.lineTo(Point.of(1, 1));
      shapeBuilder.path(pathBuilder.getPaths().all(), def.renderProps);
    }

    if (props.node.renderProps.custom.partialRect.south) {
      const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));
      pathBuilder.moveTo(Point.of(-1, -1));
      pathBuilder.lineTo(Point.of(1, -1));
      shapeBuilder.path(pathBuilder.getPaths().all(), def.renderProps);
    }

    if (props.node.renderProps.custom.partialRect.east) {
      const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));
      pathBuilder.moveTo(Point.of(1, 1));
      pathBuilder.lineTo(Point.of(1, -1));
      shapeBuilder.path(pathBuilder.getPaths().all(), def.renderProps);
    }

    if (props.node.renderProps.custom.partialRect.west) {
      const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));
      pathBuilder.moveTo(Point.of(-1, 1));
      pathBuilder.lineTo(Point.of(-1, -1));
      shapeBuilder.path(pathBuilder.getPaths().all(), def.renderProps);
    }

    shapeBuilder.text(this);
  }
}
