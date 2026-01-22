import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { fromUnitLCS, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p, Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import {
  CustomProperty,
  CustomPropertyDefinition
} from '@diagram-craft/model/elementDefinitionRegistry';
import { round } from '@diagram-craft/utils/math';
import { Box } from '@diagram-craft/geometry/box';
import { Angle } from '@diagram-craft/geometry/angle';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Anchor, BoundaryDirection } from '@diagram-craft/model/anchor';

// NodeProps extension for custom props *****************************************

type ExtraProps = {
  notch?: number;
  x?: number;
  y?: number;
};

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      arrow?: ExtraProps;
    }
  }
}

const $defaults = registerCustomNodeDefaults('arrow', { notch: 0, x: 40, y: 30 });

// Custom properties ************************************************************

const propNotch = (node: DiagramNode) =>
  CustomProperty.node.number(node, 'Notch', 'custom.arrow.notch', {
    unit: 'px',
    maxValue: 50,
    value: $defaults(node.renderProps.custom.arrow).notch,
    format: round,
    validate: v => v >= 0 && v <= node.bounds.w - $defaults(node.editProps.custom?.arrow).x
  });

const propArrowControlX = (node: DiagramNode) =>
  CustomProperty.node.number(node, 'Pointiness', 'custom.arrow.x', {
    unit: 'px',
    maxValue: 50,
    value: $defaults(node.renderProps.custom.arrow).x,
    format: round,
    validate: v => v >= 0 && v <= Math.min(node.bounds.w, node.bounds.h)
  });

const propArrowControlY = (node: DiagramNode) =>
  CustomProperty.node.number(node, 'Thickness', 'custom.arrow.y', {
    unit: '%',
    maxValue: 50,
    value: $defaults(node.renderProps.custom.arrow).y,
    format: round,
    validate: v => v >= 0 && v <= 100
  });

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
      const notch = $defaults(props.nodeProps.custom.arrow).notch;
      const notchCP = Box.fromOffset(bounds, this.def.rotate(_p(notch / w, 0.5)));

      shapeBuilder.controlPoint(notchCP, (pos, uow) => {
        const p = Point.rotateAround(pos, -this.def.rotation, Box.center(bounds));

        const distance = Math.max(0, p.x - bounds.x);
        propNotch(props.node).set(distance, uow);
        return `Notch: ${props.node.renderProps.custom.arrow.notch}px`;
      });

      // Arrow control points
      const { x, y } = props.nodeProps.custom.arrow;
      const xyCP = Box.fromOffset(bounds, this.def.rotate(_p(1 - x / w, y / 100)));

      shapeBuilder.controlPoint(xyCP, (pos, uow) => {
        const p = Point.rotateAround(pos, -this.def.rotation, Box.center(bounds));

        const newX = Math.max(0, bounds.x + w - p.x);
        propArrowControlX(props.node).set(newX, uow);

        const newY = (100 * (p.y - bounds.y)) / h;
        propArrowControlY(props.node).set(newY, uow);

        return `${props.node.renderProps.custom.arrow.x}px, ${props.node.renderProps.custom.arrow.y}%`;
      });
    }
  };

  protected boundaryDirection(): BoundaryDirection {
    return 'clockwise';
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const x = def.renderProps.custom.arrow.x;
    const y = def.renderProps.custom.arrow.y;
    const notch = def.renderProps.custom.arrow.notch;

    const w = this.isHorizontal() ? def.bounds.w : def.bounds.h;

    /*
        notchOffset                arrayOffset
        |--|                       |---|

                                   7
                                   |\        --
                                   | \       |  thicknessOffset
        5--------------------------6  \      --
          \                            \
           4                            0
          /                            /
        3--------------------------2  /
                                   | /
                                   |/
                                   1
     */

    const arrowOffset = x / w;
    const notchOffset = notch / w;
    const thicknessOffset = y / 100;

    const points = [
      _p(1, 0.5),
      _p(1 - arrowOffset, 1),
      _p(1 - arrowOffset, 1 - thicknessOffset),
      _p(0, 1 - thicknessOffset),
      _p(notchOffset, 0.5),
      _p(0, thicknessOffset),
      _p(1 - arrowOffset, thicknessOffset),
      _p(1 - arrowOffset, 0)
    ];

    const pathBuilder = new PathListBuilder().withTransform(fromUnitLCS(def.bounds));
    points.forEach((point, index) => {
      const rotatedPoint = this.rotate(point);
      if (index === 0) {
        pathBuilder.moveTo(rotatedPoint);
      } else {
        pathBuilder.lineTo(rotatedPoint);
      }
    });
    pathBuilder.close();

    return pathBuilder;
  }

  protected getShapeAnchors(node: DiagramNode): Anchor[] {
    const notch = node.renderProps.custom.arrow.notch;
    const w = this.isHorizontal() ? node.bounds.w : node.bounds.h;
    const notchOffset = notch / w;

    return [
      { id: 'c', type: 'center', start: _p(0.5, 0.5), clip: true },
      {
        id: 'b',
        type: 'point',
        start: this.rotate(_p(notchOffset, 0.5)),
        normal: this.rotation + Math.PI,
        isPrimary: true
      },
      {
        id: 'f',
        type: 'point',
        start: this.rotate(_p(1, 0.5)),
        normal: this.rotation,
        isPrimary: true
      }
    ];
  }

  getCustomPropertyDefinitions(node: DiagramNode) {
    return new CustomPropertyDefinition(() => [
      propNotch(node),
      propArrowControlX(node),
      propArrowControlY(node)
    ]);
  }

  private rotate(point: Point) {
    return Point.rotateAround(point, this.rotation, _p(0.5, 0.5));
  }

  private isHorizontal() {
    return Angle.isHorizontal(this.rotation);
  }
}
