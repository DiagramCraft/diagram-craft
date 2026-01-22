import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import {
  CustomPropertyDefinition,
  NumberCustomPropertyType,
  SelectCustomPropertyType
} from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { round } from '@diagram-craft/utils/math';
import { LocalCoordinateSystem } from '@diagram-craft/geometry/lcs';
import { Box } from '@diagram-craft/geometry/box';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Anchor } from '@diagram-craft/model/anchor';
import { assertFullDirectionOrUndefined, FullDirection } from '@diagram-craft/geometry/direction';

const NORTH = 'north';
const SOUTH = 'south';
const EAST = 'east';
const WEST = 'west';

// NodeProps extension for custom props *****************************************

type ExtraProps = {
  size?: number;
  direction?: FullDirection;
};

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      cylinder?: ExtraProps;
    }
  }
}

registerCustomNodeDefaults('cylinder', { size: 30, direction: NORTH });

// Custom properties ************************************************************

const Size = {
  definition: (node: DiagramNode): NumberCustomPropertyType => ({
    id: 'size',
    label: 'Size',
    type: 'number',
    value: node.renderProps.custom.cylinder.size,
    maxValue: Number.MAX_VALUE,
    unit: 'px',
    isSet: node.storedProps.custom?.cylinder?.size !== undefined,
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
  definition: (node: DiagramNode): SelectCustomPropertyType => ({
    id: 'direction',
    label: 'Direction',
    type: 'select',
    options: [
      { value: NORTH, label: 'North' },
      { value: SOUTH, label: 'South' },
      { value: EAST, label: 'East' },
      { value: WEST, label: 'West' }
    ],
    value: node.renderProps.custom.cylinder.direction,
    isSet: node.storedProps.custom?.cylinder?.direction !== undefined,
    onChange: (value: string | undefined, uow: UnitOfWork) => Direction.set(value, node, uow)
  }),

  set: (value: string | undefined, node: DiagramNode, uow: UnitOfWork) => {
    assertFullDirectionOrUndefined(value);
    node.updateCustomProps('cylinder', props => (props.direction = value), uow);
  }
};

// NodeDefinition and Shape *****************************************************

export const CylinderNodeTypePrivate = {
  getBounds(def: DiagramNode) {
    const bounds = Box.withoutRotation(def.bounds);

    const direction = def.renderProps.custom.cylinder.direction;
    if (direction === SOUTH) {
      return { ...bounds, r: Math.PI, x: bounds.x + bounds.w, y: bounds.y + bounds.h };
    } else if (direction === EAST) {
      return { ...bounds, r: Math.PI / 2, w: bounds.h, h: bounds.w, x: bounds.x + bounds.w };
    } else if (direction === WEST) {
      return { ...bounds, r: (3 * Math.PI) / 2, w: bounds.h, h: bounds.w, y: bounds.y + bounds.h };
    }

    return bounds;
  },

  getSize(def: DiagramNode) {
    const direction = def.renderProps.custom.cylinder.direction;

    if (direction === EAST || direction === WEST) {
      return def.renderProps.custom.cylinder.size / def.bounds.w;
    } else {
      return def.renderProps.custom.cylinder.size / def.bounds.h;
    }
  },

  getTextBounds(props: BaseShapeBuildShapeProps) {
    const bounds = props.node.bounds;
    const { size, direction } = props.nodeProps.custom.cylinder;

    if (direction === EAST) {
      return { ...bounds, w: bounds.w - size };
    } else if (direction === WEST) {
      return { ...bounds, x: bounds.x + size, w: bounds.w - size };
    } else if (direction === SOUTH) {
      return { ...bounds, h: bounds.h - size };
    } else {
      return { ...bounds, y: bounds.y + size, h: bounds.h - size };
    }
  },

  getLcs(def: DiagramNode) {
    return new LocalCoordinateSystem(CylinderNodeTypePrivate.getBounds(def), [0, 1], [0, 1], false);
  }
};

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
        CylinderNodeTypePrivate.getTextBounds(props)
      );

      const bounds = CylinderNodeTypePrivate.getBounds(props.node);

      const { size, direction } = props.nodeProps.custom.cylinder;

      if (direction === NORTH) {
        shapeBuilder.controlPoint(_p(bounds.x, bounds.y + size / 2), ({ y }, uow) => {
          const distance = Math.max(0, y - bounds.y);
          Size.set(distance * 2, props.node, uow);
          return `Size: ${props.node.renderProps.custom.cylinder.size}px`;
        });
      } else if (direction === SOUTH) {
        shapeBuilder.controlPoint(_p(bounds.x, bounds.y - size / 2), ({ y }, uow) => {
          const distance = Math.max(0, bounds.y - y);
          Size.set(distance * 2, props.node, uow);
          return `Size: ${props.node.renderProps.custom.cylinder.size}px`;
        });
      } else if (direction === EAST) {
        shapeBuilder.controlPoint(_p(bounds.x - size / 2, bounds.y), ({ x }, uow) => {
          const distance = Math.max(0, bounds.x - x);
          Size.set(distance * 2, props.node, uow);
          return `Size: ${props.node.renderProps.custom.cylinder.size}px`;
        });
      } else if (direction === WEST) {
        shapeBuilder.controlPoint(_p(bounds.x + size / 2, bounds.y), ({ x }, uow) => {
          const distance = Math.max(0, x - bounds.x);
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
    const size = CylinderNodeTypePrivate.getSize(def);
    const lcs = CylinderNodeTypePrivate.getLcs(def);

    return new PathListBuilder()
      .withTransform(lcs.toGlobalTransforms)
      .moveTo(_p(0, size / 2))
      .arcTo(_p(0.5, size), 0.5, size / 2, 0, 0, 0)
      .arcTo(_p(1, size / 2), 0.5, size / 2, 0, 0, 0);
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const size = CylinderNodeTypePrivate.getSize(def);
    const lcs = CylinderNodeTypePrivate.getLcs(def);

    return new PathListBuilder()
      .withTransform(lcs.toGlobalTransforms)
      .moveTo(_p(0, size / 2))
      .arcTo(_p(0.5, 0), 0.5, size / 2, 0, 0, 1)
      .arcTo(_p(1, size / 2), 0.5, size / 2, 0, 0, 1)
      .lineTo(_p(1, 1 - size / 2))
      .arcTo(_p(0.5, 1), 0.5, size / 2, 0, 0, 1)
      .arcTo(_p(0, 1 - size / 2), 0.5, size / 2, 0, 0, 1)
      .lineTo(_p(0, size / 2));
  }

  getCustomPropertyDefinitions(node: DiagramNode): CustomPropertyDefinition {
    return [Size.definition(node), Direction.definition(node)];
  }
}
