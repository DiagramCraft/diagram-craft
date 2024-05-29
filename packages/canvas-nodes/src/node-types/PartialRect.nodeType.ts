import { PathBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';

// NodeProps extension for custom props *****************************************

type ExtraProps = {
  north?: boolean;
  south?: boolean;
  east?: boolean;
  west?: boolean;
};

declare global {
  interface NodeProps {
    shapePartialRect?: ExtraProps;
  }
}

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
        ...(props.nodeProps.stroke ?? {}),
        enabled: false,
        color: 'transparent'
      }
    } as NodeProps);

    if (props.node.props.shapePartialRect?.north) {
      const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));
      pathBuilder.moveTo(Point.of(-1, 1));
      pathBuilder.lineTo(Point.of(1, 1));
      shapeBuilder.path(pathBuilder.getPaths().all(), def.props);
    }

    if (props.node.props.shapePartialRect?.south) {
      const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));
      pathBuilder.moveTo(Point.of(-1, -1));
      pathBuilder.lineTo(Point.of(1, -1));
      shapeBuilder.path(pathBuilder.getPaths().all(), def.props);
    }

    if (props.node.props.shapePartialRect?.east) {
      const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));
      pathBuilder.moveTo(Point.of(1, 1));
      pathBuilder.lineTo(Point.of(1, -1));
      shapeBuilder.path(pathBuilder.getPaths().all(), def.props);
    }

    if (props.node.props.shapePartialRect?.west) {
      const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));
      pathBuilder.moveTo(Point.of(-1, 1));
      pathBuilder.lineTo(Point.of(-1, -1));
      shapeBuilder.path(pathBuilder.getPaths().all(), def.props);
    }

    shapeBuilder.text(this);
  }
}
