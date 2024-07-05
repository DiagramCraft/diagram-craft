import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathBuilder } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { round } from '@diagram-craft/utils/math';
import { LocalCoordinateSystem } from '@diagram-craft/geometry/lcs';
import { Box } from '@diagram-craft/geometry/box';
import { registerNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Anchor } from '@diagram-craft/model/anchor';

// NodeProps extension for custom props *****************************************

type ExtraProps = {
  size?: number;
  direction?: 'north' | 'south' | 'east' | 'west';
};

declare global {
  interface NodeProps {
    shapeCylinder?: ExtraProps;
  }
}

registerNodeDefaults('shapeCylinder', { size: 30, direction: 'north' });

// Custom properties ************************************************************

const Size = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'size',
    label: 'Size',
    type: 'number',
    value: node.renderProps.shapeCylinder.size,
    maxValue: Number.MAX_VALUE,
    unit: 'px',
    onChange: (value: number, uow: UnitOfWork) => Size.set(value, node, uow)
  }),

  set: (value: number, node: DiagramNode, uow: UnitOfWork) => {
    if (value >= node.bounds.h || value <= 0) return;
    node.updateProps(
      props => (props.shapeCylinder = { ...props.shapeCylinder, size: round(value) }),
      uow
    );
  }
};

const Direction = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'direction',
    label: 'Direction',
    type: 'select',
    options: [
      { value: 'north', label: 'North' },
      { value: 'south', label: 'South' },
      { value: 'east', label: 'East' },
      { value: 'west', label: 'West' }
    ],
    value: node.renderProps.shapeCylinder.direction,
    onChange: (value: string, uow: UnitOfWork) => Direction.set(value, node, uow)
  }),

  set: (value: string, node: DiagramNode, uow: UnitOfWork) => {
    node.updateProps(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      props => (props.shapeCylinder = { ...props.shapeCylinder, direction: value as any }),
      uow
    );
  }
};

// NodeDefinition and Shape *****************************************************

export class CylinderNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('cylinder', 'Cylinder', CylinderNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<CylinderNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
      shapeBuilder.boundaryPath(boundary.all());

      const bounds = props.node.bounds;
      const size = props.nodeProps.shapeCylinder.size;

      let textBounds = { ...bounds, y: bounds.y + size, h: bounds.h - size };

      if (props.nodeProps.shapeCylinder.direction === 'east') {
        textBounds = { ...bounds, w: bounds.w - size };
      } else if (props.nodeProps.shapeCylinder.direction === 'west') {
        textBounds = { ...bounds, x: bounds.x + size, w: bounds.w - size };
      } else if (props.nodeProps.shapeCylinder.direction === 'south') {
        textBounds = { ...bounds, h: bounds.h - size };
      }

      shapeBuilder.text(this, '1', props.nodeProps.text, textBounds);

      if (props.nodeProps.shapeCylinder.direction === 'north') {
        shapeBuilder.controlPoint(Point.of(bounds.x, bounds.y + size / 2), ({ y }, uow) => {
          const distance = Math.max(0, y - bounds.y);
          Size.set(distance * 2, props.node, uow);
          return `Size: ${props.node.renderProps.shapeCylinder.size}px`;
        });
      }
    }
  };

  getAnchors(_def: DiagramNode): Anchor[] {
    return [
      { id: '1', start: Point.of(0.5, 0), type: 'point' },
      { id: '2', start: Point.of(1, 0.5), type: 'point' },
      { id: '3', start: Point.of(0.5, 1), type: 'point' },
      { id: '4', start: Point.of(0, 0.5), type: 'point' },
      { id: 'c', start: Point.of(0.5, 0.5), clip: true, type: 'center' }
    ];
  }

  getBoundingPathBuilder(def: DiagramNode) {
    let size = def.renderProps.shapeCylinder.size / def.bounds.h;
    let bounds: Box = Box.withoutRotation(def.bounds);
    if (def.renderProps.shapeCylinder.direction === 'south') {
      bounds = { ...bounds, r: Math.PI, x: bounds.x + bounds.w, y: bounds.y + bounds.h };
    } else if (def.renderProps.shapeCylinder.direction === 'east') {
      bounds = { ...bounds, r: Math.PI / 2, w: bounds.h, h: bounds.w, x: bounds.x + bounds.w };
      size = def.renderProps.shapeCylinder.size / def.bounds.w;
    } else if (def.renderProps.shapeCylinder.direction === 'west') {
      bounds = {
        ...bounds,
        r: (3 * Math.PI) / 2,
        w: bounds.h,
        h: bounds.w,
        y: bounds.y + bounds.h
      };
      size = def.renderProps.shapeCylinder.size / def.bounds.w;
    }

    const lcs = new LocalCoordinateSystem(bounds, [-1, 1], [-1, 1], true);

    const pathBuilder = new PathBuilder(p => lcs.toGlobal(p));

    pathBuilder.moveTo(Point.of(-1, 1 - size));
    pathBuilder.lineTo(Point.of(-1, -1 + size));
    pathBuilder.arcTo(Point.of(0, -1), 1, size, 0);
    pathBuilder.arcTo(Point.of(1, -1 + size), 1, size, 0);
    pathBuilder.lineTo(Point.of(1, 1 - size));
    pathBuilder.arcTo(Point.of(0, 1), 1, size, 0);
    pathBuilder.arcTo(Point.of(-1, 1 - size), 1, size, 0);
    pathBuilder.arcTo(Point.of(0, 1 - 2 * size), 1, size, 0);
    pathBuilder.arcTo(Point.of(1, 1 - size), 1, size, 0);

    return pathBuilder;
  }

  getCustomProperties(node: DiagramNode): Array<CustomPropertyDefinition> {
    return [Size.definition(node), Direction.definition(node)];
  }
}
