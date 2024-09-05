import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathBuilder } from '@diagram-craft/geometry/pathBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { round } from '@diagram-craft/utils/math';
import { LocalCoordinateSystem } from '@diagram-craft/geometry/lcs';
import { Box } from '@diagram-craft/geometry/box';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Anchor } from '@diagram-craft/model/anchor';
import { assertFullDirectionOrUndefined, FullDirection } from '@diagram-craft/geometry/direction';

// NodeProps extension for custom props *****************************************

type ExtraProps = {
  size?: number;
  direction?: FullDirection;
};

declare global {
  interface CustomNodeProps {
    cylinder?: ExtraProps;
  }
}

registerCustomNodeDefaults('cylinder', { size: 30, direction: 'north' });

// Custom properties ************************************************************

const Size = {
  definition: (node: DiagramNode): CustomPropertyDefinition => ({
    id: 'size',
    label: 'Size',
    type: 'number',
    value: node.renderProps.custom.cylinder.size,
    maxValue: Number.MAX_VALUE,
    unit: 'px',
    isSet: node.editProps.custom?.cylinder?.size !== undefined,
    onChange: (value: number | undefined, uow: UnitOfWork) => Size.set(value, node, uow)
  }),

  set: (value: number | undefined, node: DiagramNode, uow: UnitOfWork) => {
    if (value === undefined) {
      node.updateCustomProps('cylinder', props => (props.size = undefined), uow);
    } else {
      if (value >= node.bounds.h || value <= 0) return;
      node.updateCustomProps('cylinder', props => (props.size = round(value)), uow);
    }
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
    value: node.renderProps.custom.cylinder.direction,
    isSet: node.editProps.custom?.cylinder?.direction !== undefined,
    onChange: (value: string | undefined, uow: UnitOfWork) => Direction.set(value, node, uow)
  }),

  set: (value: string | undefined, node: DiagramNode, uow: UnitOfWork) => {
    assertFullDirectionOrUndefined(value);
    node.updateCustomProps('cylinder', props => (props.direction = value), uow);
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

      const interior = this.def.getInteriorPathBuilder(props.node);
      shapeBuilder.buildInterior().addShape(interior).stroke();

      shapeBuilder.text(
        this,
        '1',
        props.node.getText(),
        props.nodeProps.text,
        this.def.getTextBounds(props)
      );

      const direction = props.nodeProps.custom.cylinder.direction;
      if (direction === 'north') {
        const bounds = props.node.bounds;
        const cylinderSize = props.nodeProps.custom.cylinder.size;
        shapeBuilder.controlPoint(_p(bounds.x, bounds.y + cylinderSize / 2), ({ y }, uow) => {
          const distance = Math.max(0, y - bounds.y);
          Size.set(distance * 2, props.node, uow);
          return `Size: ${props.node.renderProps.custom.cylinder.size}px`;
        });
      }
    }
  };

  getShapeAnchors(_def: DiagramNode): Anchor[] {
    return [
      { id: '1', start: _p(0.5, 0), type: 'point', isPrimary: true, normal: -Math.PI / 2 },
      { id: '2', start: _p(1, 0.5), type: 'point', isPrimary: true, normal: 0 },
      { id: '3', start: _p(0.5, 1), type: 'point', isPrimary: true, normal: Math.PI / 2 },
      { id: '4', start: _p(0, 0.5), type: 'point', isPrimary: true, normal: Math.PI },
      { id: 'c', start: _p(0.5, 0.5), clip: true, type: 'center' }
    ];
  }

  getInteriorPathBuilder(def: DiagramNode) {
    const size = this.getSize(def);

    const lcs = new LocalCoordinateSystem(this.getBounds(def), [0, 1], [0, 1], false);
    return new PathBuilder(p => lcs.toGlobal(p))
      .moveTo(_p(0, size / 2))
      .arcTo(_p(0.5, size), 0.5, size / 2, 0, 0, 0)
      .arcTo(_p(1, size / 2), 0.5, size / 2, 0, 0, 0);
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const size = this.getSize(def);

    const lcs = new LocalCoordinateSystem(this.getBounds(def), [0, 1], [0, 1], false);
    return new PathBuilder(p => lcs.toGlobal(p))
      .moveTo(_p(0, size / 2))
      .arcTo(_p(0.5, 0), 0.5, size / 2, 0, 0, 1)
      .arcTo(_p(1, size / 2), 0.5, size / 2, 0, 0, 1)
      .lineTo(_p(1, 1 - size / 2))
      .arcTo(_p(0.5, 1), 0.5, size / 2, 0, 0, 1)
      .arcTo(_p(0, 1 - size / 2), 0.5, size / 2, 0, 0, 1)
      .lineTo(_p(0, size / 2));
  }

  getCustomPropertyDefinitions(node: DiagramNode): Array<CustomPropertyDefinition> {
    return [Size.definition(node), Direction.definition(node)];
  }

  private getSize(def: DiagramNode) {
    const size = def.renderProps.custom.cylinder.size / def.bounds.h;

    const direction = def.renderProps.custom.cylinder.direction;
    if (direction === 'east' || direction === 'west') {
      return def.renderProps.custom.cylinder.size / def.bounds.w;
    }
    return size;
  }

  private getBounds(def: DiagramNode) {
    const bounds = Box.withoutRotation(def.bounds);

    const direction = def.renderProps.custom.cylinder.direction;
    if (direction === 'south') {
      return { ...bounds, r: Math.PI, x: bounds.x + bounds.w, y: bounds.y + bounds.h };
    } else if (direction === 'east') {
      return { ...bounds, r: Math.PI / 2, w: bounds.h, h: bounds.w, x: bounds.x + bounds.w };
    } else if (direction === 'west') {
      return { ...bounds, r: (3 * Math.PI) / 2, w: bounds.h, h: bounds.w, y: bounds.y + bounds.h };
    }

    return bounds;
  }

  private getTextBounds(props: BaseShapeBuildShapeProps) {
    const bounds = props.node.bounds;
    const cylinderSize = props.nodeProps.custom.cylinder.size;
    const direction = props.nodeProps.custom.cylinder.direction;

    if (direction === 'east') {
      return { ...bounds, w: bounds.w - cylinderSize };
    } else if (direction === 'west') {
      return { ...bounds, x: bounds.x + cylinderSize, w: bounds.w - cylinderSize };
    } else if (direction === 'south') {
      return { ...bounds, h: bounds.h - cylinderSize };
    } else {
      return { ...bounds, y: bounds.y + cylinderSize, h: bounds.h - cylinderSize };
    }
  }
}
