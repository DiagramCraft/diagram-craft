import { PathListBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
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
}

class PartialRectComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const node = props.node;

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
      shapeBuilder.path(
        new PathListBuilder(unitCoordinateSystem(node.bounds))
          .moveTo(_p(0, 0))
          .lineTo(_p(1, 0))
          .getPaths()
          .all(),
        node.renderProps
      );
    }

    if (props.node.renderProps.custom.partialRect.south) {
      shapeBuilder.path(
        new PathListBuilder(unitCoordinateSystem(node.bounds))
          .moveTo(_p(0, 1))
          .lineTo(_p(1, 1))
          .getPaths()
          .all(),
        node.renderProps
      );
    }

    if (props.node.renderProps.custom.partialRect.east) {
      shapeBuilder.path(
        new PathListBuilder(unitCoordinateSystem(node.bounds))
          .moveTo(_p(1, 0))
          .lineTo(_p(1, 1))
          .getPaths()
          .all(),
        node.renderProps
      );
    }

    if (props.node.renderProps.custom.partialRect.west) {
      shapeBuilder.path(
        new PathListBuilder(unitCoordinateSystem(node.bounds))
          .moveTo(_p(0, 0))
          .lineTo(_p(0, 1))
          .getPaths()
          .all(),
        node.renderProps
      );
    }

    shapeBuilder.text(this);
  }
}
