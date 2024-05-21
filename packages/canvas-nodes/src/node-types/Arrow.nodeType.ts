import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DeepReadonly } from '@diagram-craft/utils/types';
import { round } from '@diagram-craft/utils/math';
import { Box } from '@diagram-craft/geometry/box';
import { Angle } from '@diagram-craft/geometry/angle';
import { pointInBounds } from '@diagram-craft/canvas/pointInBounds';

// NodeProps extension for custom props *****************************************

type ExtraProps = {
  notch?: number;
  x?: number;
  y?: number;
};

declare global {
  interface NodeProps {
    shapeArrow?: ExtraProps;
  }
}

// Custom properties ************************************************************

const Notch = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'notch',
    label: 'Notch',
    type: 'number',
    value: Notch.get(node.props.shapeArrow),
    maxValue: 50,
    unit: 'px',
    onChange: (value: number, uow: UnitOfWork) => Notch.set(value, node, uow)
  }),

  get: (props: DeepReadonly<ExtraProps> | undefined) => props?.notch ?? 0,

  set: (value: number, node: DiagramNode, uow: UnitOfWork) => {
    if (value >= node.bounds.w - ArrowControlX.get(node.propsForEditing.shapeArrow) || value <= 0)
      return;
    node.updateProps(
      props => (props.shapeArrow = { ...props.shapeArrow, notch: round(value) }),
      uow
    );
  }
};

const ArrowControlX = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'x',
    label: 'Pointiness',
    type: 'number',
    value: ArrowControlX.get(node.props.shapeArrow),
    maxValue: 50,
    unit: 'px',
    onChange: (value: number, uow: UnitOfWork) => ArrowControlX.set(value, node, uow)
  }),

  get: (props: DeepReadonly<ExtraProps> | undefined) => props?.x ?? 40,

  set: (value: number, node: DiagramNode, uow: UnitOfWork) => {
    if (value >= Math.min(node.bounds.w, node.bounds.h) || value <= 0) return;
    node.updateProps(props => (props.shapeArrow = { ...props.shapeArrow, x: round(value) }), uow);
  }
};

const ArrowControlY = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'y',
    label: 'Thickness',
    type: 'number',
    value: ArrowControlY.get(node.props.shapeArrow),
    maxValue: 50,
    unit: '%',
    onChange: (value: number, uow: UnitOfWork) => ArrowControlY.set(value, node, uow)
  }),

  get: (props: DeepReadonly<ExtraProps> | undefined) => props?.y ?? 30,

  set: (value: number, node: DiagramNode, uow: UnitOfWork) => {
    if (value <= 0 || value >= 50) return;
    node.updateProps(props => (props.shapeArrow = { ...props.shapeArrow, y: round(value) }), uow);
  }
};

// NodeDefinition and Shape *****************************************************

export class ArrowNodeDefinition extends ShapeNodeDefinition {
  constructor(
    id: string,
    description: string,
    public readonly rotation: number
  ) {
    super(id, description, ArrowNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<ArrowNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      super.buildShape(props, shapeBuilder);

      const bounds = props.node.bounds;

      const w = this.def.isHorizontal() ? bounds.w : bounds.h;
      const h = this.def.isHorizontal() ? bounds.h : bounds.w;

      // Notch

      const notch = Notch.get(props.nodeProps.shapeArrow);
      const notchPct = 1 - (w - notch) / w;

      const notchPoint = pointInBounds(
        Point.rotate(Point.of(-1 + notchPct * 2, 0), this.def.rotation),
        bounds
      );

      shapeBuilder.controlPoint(notchPoint, (pos, uow) => {
        const p = Point.rotateAround(pos, this.def.rotation, Box.center(bounds));

        const distance = Math.max(0, p.x - bounds.x);
        Notch.set(distance, props.node, uow);
        return `Notch: ${Notch.get(props.node.props.shapeArrow)}px`;
      });

      // Arrow control points

      const x = ArrowControlX.get(props.nodeProps.shapeArrow);
      const y = ArrowControlY.get(props.nodeProps.shapeArrow);

      const xPct = (w - x) / w;

      const controlPoint = pointInBounds(
        Point.rotate(Point.of(-1 + 2 * xPct, 1 - 2 * (y / 100)), this.def.rotation),
        bounds
      );

      shapeBuilder.controlPoint(controlPoint, (pos, uow) => {
        const p = Point.rotateAround(pos, this.def.rotation, Box.center(bounds));

        const newX = Math.max(0, bounds.x + w - p.x);
        ArrowControlX.set(newX, props.node, uow);

        const newY = (100 * (p.y - bounds.y)) / h;
        ArrowControlY.set(newY, props.node, uow);

        return `${ArrowControlX.get(props.node.props.shapeArrow)}px, ${ArrowControlY.get(props.node.props.shapeArrow)}%`;
      });
    }
  };

  isHorizontal() {
    return Angle.isHorizontal(this.rotation);
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const x = ArrowControlX.get(def.props.shapeArrow);
    const y = ArrowControlY.get(def.props.shapeArrow);
    const notch = Notch.get(def.props.shapeArrow);

    const w = this.isHorizontal() ? def.bounds.w : def.bounds.h;

    /*
        notchOffset                arrayOffset
        |--|                       |---|

                                   |\        --
                                   | \       |  thicknessOffset
        |--------------------------|  \      --
          \                            \
          /                            /
        |--------------------------|  /
                                   | /
                                   |/

     */

    const arrowOffset = 2 * (1 - (w - x) / w);
    const notchOffset = 2 * (1 - (w - notch) / w);
    const thicknessOffset = 2 - (2 * y) / 100;

    const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));
    const points = [
      Point.of(1, 0),
      Point.of(1 - arrowOffset, 1),
      Point.of(1 - arrowOffset, thicknessOffset - 1),
      Point.of(-1, thicknessOffset - 1),
      Point.of(-1 + notchOffset, 0),
      Point.of(-1, 1 - thicknessOffset),
      Point.of(1 - arrowOffset, 1 - thicknessOffset),
      Point.of(1 - arrowOffset, -1)
    ];

    points.forEach((point, index) => {
      const rotatedPoint = Point.rotate(point, this.rotation);
      if (index === 0) {
        pathBuilder.moveTo(rotatedPoint);
      } else {
        pathBuilder.lineTo(rotatedPoint);
      }
    });
    pathBuilder.close();

    return pathBuilder;
  }

  getCustomProperties(node: DiagramNode): Array<CustomPropertyDefinition> {
    return [Notch.definition(node), ArrowControlX.definition(node), ArrowControlY.definition(node)];
  }
}
