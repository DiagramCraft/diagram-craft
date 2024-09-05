import { BaseNodeComponent, BaseShapeBuildShapeProps } from '../components/BaseNodeComponent';
import { ShapeBuilder } from '../shape/ShapeBuilder';
import { PathBuilder, PathBuilderHelper } from '@diagram-craft/geometry/pathBuilder';
import { isNode } from '@diagram-craft/model/diagramElement';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Point } from '@diagram-craft/geometry/point';
import { assert } from '@diagram-craft/utils/assert';
import { Rotation, Transform, Translation } from '@diagram-craft/geometry/transform';
import { Box } from '@diagram-craft/geometry/box';
import { ShapeNodeDefinition } from '../shape/shapeNodeDefinition';
import * as svg from '../component/vdom-svg';
import { Transforms } from '../component/vdom-svg';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { hasHighlight, Highlights } from '../highlight';

declare global {
  interface CustomNodeProps {
    swimlane?: {
      horizontalBorder?: boolean;
      outerBorder?: boolean;
      title?: boolean;
      titleBorder?: boolean;
      titleSize?: number;
      fill?: boolean;
    };
  }
}

registerCustomNodeDefaults('swimlane', {
  horizontalBorder: true,
  outerBorder: true,
  title: false,
  titleBorder: true,
  titleSize: 30,
  fill: false
});

type RowsInOrder = Array<{
  row: DiagramNode;
  newLocalBounds?: Box;
  idx?: number;
}>;

const getRowsInOrder = (rows: DiagramNode[]): RowsInOrder => {
  const dest: RowsInOrder = [];

  for (const r of rows) {
    dest.push({ row: r, idx: 0 });
  }

  dest.sort((a, b) => a.row.bounds.y - b.row.bounds.y);

  return dest;
};

export class SwimlaneNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('swimlane', 'Swimlane', SwimlaneComponent);

    this.capabilities.fill = true;
    this.capabilities.children = true;
    this.capabilities.rounding = false;
  }

  layoutChildren(node: DiagramNode, uow: UnitOfWork) {
    // First layout all children
    super.layoutChildren(node, uow);

    const nodeProps = node.renderProps;

    const transformBack = [
      // Rotation around center
      new Translation({
        x: -node.bounds.x - node.bounds.w / 2,
        y: -node.bounds.y - node.bounds.h / 2
      }),
      new Rotation(-node.bounds.r),
      // Move back to 0,0
      new Translation({
        x: node.bounds.w / 2,
        y: node.bounds.h / 2
      })
    ];
    const transformForward = transformBack.map(t => t.invert()).reverse();

    const children = node.children;
    const rows = getRowsInOrder(children.filter(isNode));

    // Assert all children are rows
    //    for (const row of rows) assert.true(row.nodeType === 'tableRow');

    const boundsBefore = node.bounds;

    const localBounds = Transform.box(node.bounds, ...transformBack);
    assert.true(Math.abs(localBounds.r) < 0.0001);

    let maxX = 0;
    let y = nodeProps.custom.swimlane.title ? nodeProps.custom.swimlane.titleSize : 0;
    for (const row of rows) {
      let targetHeight = row.row.bounds.h;

      // TODO: Why is this needed
      if (isNaN(targetHeight) || !isFinite(targetHeight)) targetHeight = 100;

      row.newLocalBounds = {
        x: 0,
        w: row.row.bounds.w,
        y,
        h: targetHeight,
        r: 0
      };

      maxX = Math.max(row.row.bounds.w, maxX);
      y += targetHeight;
    }

    const newLocalBounds = {
      ...localBounds,
      h: y,
      w: maxX
    };

    // Transform back
    node.setBounds(Transform.box(newLocalBounds, ...transformForward), uow);
    for (const r of rows) {
      r.row.setBounds(Transform.box(r.newLocalBounds!, ...transformForward), uow);
    }

    // Only trigger parent.onChildChanged in case this node has indeed changed
    if (node.parent && !Box.isEqual(node.bounds, boundsBefore)) {
      uow.registerOnCommitCallback('onChildChanged', node.parent, () => {
        const parentDef = node.parent!.getDefinition();
        parentDef.onChildChanged(node.parent!, uow);
      });
    }
  }

  getCustomPropertyDefinitions(node: DiagramNode): Array<CustomPropertyDefinition> {
    return [
      {
        id: 'title',
        type: 'boolean',
        label: 'Title',
        value: node.renderProps.custom.swimlane.title,
        isSet: node.editProps.custom?.swimlane?.title !== undefined,
        onChange: (value: boolean | undefined, uow: UnitOfWork) => {
          node.updateCustomProps('swimlane', props => (props.title = value), uow);
        }
      },
      {
        id: 'titleSize',
        type: 'number',
        label: 'Title Size',
        unit: 'px',
        value: node.renderProps.custom.swimlane.titleSize,
        isSet: node.editProps.custom?.swimlane?.titleSize !== undefined,
        onChange: (value: number | undefined, uow: UnitOfWork) => {
          node.updateCustomProps('swimlane', props => (props.titleSize = value), uow);
        }
      },
      {
        id: 'outerBorder',
        type: 'boolean',
        label: 'Outer Border',
        value: node.renderProps.custom.swimlane.outerBorder,
        isSet: node.editProps.custom?.swimlane?.outerBorder !== undefined,
        onChange: (value: boolean | undefined, uow: UnitOfWork) => {
          node.updateCustomProps('swimlane', props => (props.outerBorder = value), uow);
        }
      },
      {
        id: 'horizontalBorder',
        type: 'boolean',
        label: 'Horizontal Border',
        value: node.renderProps.custom.swimlane.horizontalBorder,
        isSet: node.editProps.custom?.swimlane?.horizontalBorder !== undefined,
        onChange: (value: boolean | undefined, uow: UnitOfWork) => {
          node.updateCustomProps('swimlane', props => (props.horizontalBorder = value), uow);
        }
      },
      {
        id: 'titleBorder',
        type: 'boolean',
        label: 'Title Border',
        value: node.renderProps.custom.swimlane.titleBorder,
        isSet: node.editProps.custom?.swimlane?.titleBorder !== undefined,
        onChange: (value: boolean | undefined, uow: UnitOfWork) => {
          node.updateCustomProps('swimlane', props => (props.titleBorder = value), uow);
        }
      },
      {
        id: 'fill',
        type: 'boolean',
        label: 'Fill',
        value: node.renderProps.custom.swimlane.fill,
        isSet: node.editProps.custom?.swimlane?.fill !== undefined,
        onChange: (value: boolean | undefined, uow: UnitOfWork) => {
          node.updateCustomProps('swimlane', props => (props.fill = value), uow);
        }
      }
    ];
  }
}

// TODO: Support fill (should be only for title)
class SwimlaneComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
    const path = boundary.singularPath();
    const svgPath = path.asSvgPath();

    const nodeProps = props.nodeProps;
    const shapeProps = nodeProps.custom.swimlane;

    builder.noBoundaryNeeded();
    builder.add(
      svg.path({
        'd': svgPath,
        'x': props.node.bounds.x,
        'y': props.node.bounds.y,
        'width': props.node.bounds.w,
        'height': props.node.bounds.h,
        'stroke': hasHighlight(props.node, Highlights.NODE__DROP_TARGET) ? '#30A46C' : '#d5d5d4',
        'stroke-width': hasHighlight(props.node, Highlights.NODE__DROP_TARGET) ? 3 : 1,
        'fill': 'transparent',
        'on': {
          mousedown: props.onMouseDown,
          dblclick: builder.makeOnDblclickHandle('1')
        }
      })
    );

    if (shapeProps.fill && nodeProps.fill.enabled !== false) {
      builder.boundaryPath(boundary.all(), {
        fill: nodeProps.fill,
        stroke: { enabled: false }
      });
    }

    props.node.children.forEach(child => {
      builder.add(
        svg.g(
          { transform: Transforms.rotateBack(props.node.bounds) },
          this.makeElement(child, props)
        )
      );
    });

    const pathBuilder = new PathBuilder();

    const hasOuterBorder = shapeProps.outerBorder !== false;
    const hasTitleBorder = shapeProps.titleBorder !== false;

    if (hasOuterBorder) {
      if (hasTitleBorder) {
        PathBuilderHelper.rect(pathBuilder, {
          ...props.node.bounds,
          y: props.node.bounds.y,
          h: props.node.bounds.h
        });
      } else {
        PathBuilderHelper.rect(pathBuilder, {
          ...props.node.bounds,
          y: props.node.bounds.y + (shapeProps.title ? shapeProps.titleSize : 0),
          h: props.node.bounds.h - (shapeProps.title ? shapeProps.titleSize : 0)
        });
      }
    }

    const bounds = props.node.bounds;

    let startY = bounds.y;
    if (shapeProps.title) {
      const titleSize = shapeProps.titleSize;
      startY += titleSize;

      if (hasTitleBorder) {
        const titlePathBuilder = new PathBuilder();
        titlePathBuilder.moveTo(Point.of(bounds.x, startY));
        titlePathBuilder.lineTo(Point.of(bounds.x, bounds.y));
        titlePathBuilder.lineTo(Point.of(bounds.x + bounds.w, bounds.y));
        titlePathBuilder.lineTo(Point.of(bounds.x + bounds.w, startY));
        titlePathBuilder.close();

        builder.path(titlePathBuilder.getPaths().all(), {
          ...nodeProps,
          stroke:
            !nodeProps.stroke.enabled || hasOuterBorder
              ? { enabled: false, color: 'transparent' }
              : nodeProps.stroke,
          fill: nodeProps.fill.enabled !== false ? nodeProps.fill : {}
        });

        // In case we have an outer border, the above code draws a transparent outline,
        // so we are now missing the bottom border
        if (hasOuterBorder) {
          const titlePathBuilder = new PathBuilder();
          titlePathBuilder.moveTo(Point.of(bounds.x, startY));
          titlePathBuilder.lineTo(Point.of(bounds.x + bounds.w, startY));

          builder.path(titlePathBuilder.getPaths().all(), {
            ...nodeProps,
            stroke: !nodeProps.stroke.enabled
              ? { enabled: false, color: 'transparent' }
              : nodeProps.stroke,
            fill: nodeProps.fill.enabled !== false ? nodeProps.fill : {}
          });
        }
      }

      builder.text(this, '1', props.node.getText(), nodeProps.text, {
        ...bounds,
        h: titleSize
      });
    }

    if (shapeProps.horizontalBorder !== false) {
      let y = startY;
      const sortedChildren = props.node.children.toSorted((a, b) => a.bounds.y - b.bounds.y);
      for (let i = 0; i < sortedChildren.length - 1; i++) {
        const child = sortedChildren[i];
        if (isNode(child)) {
          y += child.bounds.h;
          pathBuilder.moveTo(Point.of(bounds.x, y));
          pathBuilder.lineTo(Point.of(bounds.x + bounds.w, y));
        }
      }
    }

    builder.path(pathBuilder.getPaths().all(), {
      ...nodeProps,
      stroke: !nodeProps.stroke.enabled
        ? { enabled: false, color: 'transparent' }
        : nodeProps.stroke,
      fill: {
        enabled: false,
        color: 'transparent'
      }
    });
  }
}
