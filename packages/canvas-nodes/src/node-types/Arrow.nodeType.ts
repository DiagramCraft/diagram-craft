import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder, fromUnitLCS } from '@diagram-craft/geometry/pathListBuilder';
import { _p, Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
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
    interface CustomNodeProps {
      arrow?: ExtraProps;
    }
  }
}

const $defaults = registerCustomNodeDefaults('arrow', { notch: 0, x: 40, y: 30 });

// Custom properties ************************************************************

const Notch = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'notch',
    label: 'Notch',
    type: 'number',
    value: $defaults(node.renderProps.custom.arrow).notch,
    maxValue: 50,
    unit: 'px',
    isSet: node.storedProps.custom?.arrow?.notch !== undefined,
    onChange: (value: number | undefined, uow: UnitOfWork) => Notch.set(value, node, uow)
  }),

  set: (value: number | undefined, node: DiagramNode, uow: UnitOfWork) => {
    if (value === undefined) {
      node.updateCustomProps('arrow', props => (props.notch = undefined), uow);
    } else {
      if (value >= node.bounds.w - $defaults(node.editProps.custom?.arrow).x || value <= 0) return;
      node.updateCustomProps('arrow', props => (props.notch = round(value)), uow);
    }
  }
};

const ArrowControlX = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'x',
    label: 'Pointiness',
    type: 'number',
    value: $defaults(node.renderProps.custom.arrow).x,
    isSet: node.storedProps.custom?.arrow?.x !== undefined,
    maxValue: 50,
    unit: 'px',
    onChange: (value: number | undefined, uow: UnitOfWork) => ArrowControlX.set(value, node, uow)
  }),

  set: (value: number | undefined, node: DiagramNode, uow: UnitOfWork) => {
    if (value === undefined) {
      node.updateCustomProps('arrow', props => (props.x = undefined), uow);
    } else {
      if (value >= Math.min(node.bounds.w, node.bounds.h) || value <= 0) return;
      node.updateCustomProps('arrow', props => (props.x = round(value)), uow);
    }
  }
};

const ArrowControlY = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'y',
    label: 'Thickness',
    type: 'number',
    value: $defaults(node.renderProps.custom.arrow).y,
    isSet: node.storedProps.custom?.arrow?.y !== undefined,
    maxValue: 50,
    unit: '%',
    onChange: (value: number | undefined, uow: UnitOfWork) => ArrowControlY.set(value, node, uow)
  }),

  set: (value: number | undefined, node: DiagramNode, uow: UnitOfWork) => {
    if (value === undefined) {
      node.updateCustomProps('arrow', props => (props.y = undefined), uow);
    } else {
      if (value <= 0 || value >= 50) return;
      node.updateCustomProps('arrow', props => (props.y = round(value)), uow);
    }
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
      const notch = $defaults(props.nodeProps.custom.arrow).notch;
      const notchCP = Box.fromOffset(bounds, this.def.rotate(_p(notch / w, 0.5)));

      shapeBuilder.controlPoint(notchCP, (pos, uow) => {
        const p = Point.rotateAround(pos, -this.def.rotation, Box.center(bounds));

        const distance = Math.max(0, p.x - bounds.x);
        Notch.set(distance, props.node, uow);
        return `Notch: ${props.node.renderProps.custom.arrow.notch}px`;
      });

      // Arrow control points
      const { x, y } = props.nodeProps.custom.arrow;
      const xyCP = Box.fromOffset(bounds, this.def.rotate(_p(1 - x / w, y / 100)));

      shapeBuilder.controlPoint(xyCP, (pos, uow) => {
        const p = Point.rotateAround(pos, -this.def.rotation, Box.center(bounds));

        const newX = Math.max(0, bounds.x + w - p.x);
        ArrowControlX.set(newX, props.node, uow);

        const newY = (100 * (p.y - bounds.y)) / h;
        ArrowControlY.set(newY, props.node, uow);

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

  getCustomPropertyDefinitions(node: DiagramNode): Array<CustomPropertyDefinition> {
    return [Notch.definition(node), ArrowControlX.definition(node), ArrowControlY.definition(node)];
  }

  private rotate(point: Point) {
    return Point.rotateAround(point, this.rotation, _p(0.5, 0.5));
  }

  private isHorizontal() {
    return Angle.isHorizontal(this.rotation);
  }
}
