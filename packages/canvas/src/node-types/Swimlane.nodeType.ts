import { BaseNodeComponent, BaseShapeBuildShapeProps } from '../components/BaseNodeComponent';
import { ShapeBuilder } from '../shape/ShapeBuilder';
import { PathBuilderHelper, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { isNode } from '@diagram-craft/model/diagramElement';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Point } from '@diagram-craft/geometry/point';
import { LayoutCapableShapeNodeDefinition } from '../shape/shapeNodeDefinition';
import * as svg from '../component/vdom-svg';
import { Transforms } from '../component/vdom-svg';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { hasHighlight, Highlights } from '../highlight';
import { renderElement } from '../components/renderElement';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
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
}

registerCustomNodeDefaults('swimlane', {
  horizontalBorder: true,
  outerBorder: true,
  title: false,
  titleBorder: true,
  titleSize: 30,
  fill: false
});

/*
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
};*/

export class SwimlaneNodeDefinition extends LayoutCapableShapeNodeDefinition {
  constructor() {
    super('swimlane', 'Swimlane', SwimlaneComponent);

    this.capabilities.fill = true;
    this.capabilities.rounding = false;
  }
  /*
  private doLayoutChildren(node: DiagramNode, uow: UnitOfWork) {
    if (node.children.length === 0) return;

    const nodeProps = node.renderProps;

    const transformBack = [
      // Rotation around center
      new Translation({
        x: -node.bounds.x - node.bounds.w / 2,
        y: -node.bounds.y - node.bounds.h / 2
      }),
      new Rotation(-node.bounds.r), // Move back to 0,0
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
      if (Number.isNaN(targetHeight) || !Number.isFinite(targetHeight)) targetHeight = 100;

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
      if (isNode(node.parent)) {
        uow.registerOnCommitCallback('onChildChanged', node.parent, () => {
          assert.node(node.parent!);
          const parentDef = node.parent.getDefinition();
          parentDef.onChildChanged(node.parent, uow);
        });
      }
    }
  }*/

  getContainerPadding(node: DiagramNode) {
    if (node.renderProps.custom.swimlane.title) {
      const titleSize = node.renderProps.custom.swimlane.titleSize;
      return { top: titleSize, bottom: 0, right: 0, left: 0 };
    } else {
      return super.getContainerPadding(node);
    }
  }

  getCustomPropertyDefinitions(node: DiagramNode): Array<CustomPropertyDefinition> {
    return [
      {
        id: 'title',
        type: 'boolean',
        label: 'Title',
        value: node.renderProps.custom.swimlane.title,
        isSet: node.storedProps.custom?.swimlane?.title !== undefined,
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
        isSet: node.storedProps.custom?.swimlane?.titleSize !== undefined,
        onChange: (value: number | undefined, uow: UnitOfWork) => {
          node.updateCustomProps('swimlane', props => (props.titleSize = value), uow);
        }
      },
      {
        id: 'outerBorder',
        type: 'boolean',
        label: 'Outer Border',
        value: node.renderProps.custom.swimlane.outerBorder,
        isSet: node.storedProps.custom?.swimlane?.outerBorder !== undefined,
        onChange: (value: boolean | undefined, uow: UnitOfWork) => {
          node.updateCustomProps('swimlane', props => (props.outerBorder = value), uow);
        }
      },
      {
        id: 'horizontalBorder',
        type: 'boolean',
        label: 'Horizontal Border',
        value: node.renderProps.custom.swimlane.horizontalBorder,
        isSet: node.storedProps.custom?.swimlane?.horizontalBorder !== undefined,
        onChange: (value: boolean | undefined, uow: UnitOfWork) => {
          node.updateCustomProps('swimlane', props => (props.horizontalBorder = value), uow);
        }
      },
      {
        id: 'titleBorder',
        type: 'boolean',
        label: 'Title Border',
        value: node.renderProps.custom.swimlane.titleBorder,
        isSet: node.storedProps.custom?.swimlane?.titleBorder !== undefined,
        onChange: (value: boolean | undefined, uow: UnitOfWork) => {
          node.updateCustomProps('swimlane', props => (props.titleBorder = value), uow);
        }
      },
      {
        id: 'fill',
        type: 'boolean',
        label: 'Fill',
        value: node.renderProps.custom.swimlane.fill,
        isSet: node.storedProps.custom?.swimlane?.fill !== undefined,
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
    const path = boundary.singular();
    const svgPath = path.asSvgPath();

    const nodeProps = props.nodeProps;
    const shapeProps = nodeProps.custom.swimlane;

    // Step 1: Create a transparent base shape for mouse interactions
    // This serves as the clickable/hoverable area and shows a highlight when dragging
    builder.noBoundaryNeeded();
    builder.add(
      svg.path({
        'd': svgPath,
        'x': props.node.bounds.x,
        'y': props.node.bounds.y,
        'width': props.node.bounds.w,
        'height': props.node.bounds.h,
        'stroke': hasHighlight(props.node, Highlights.NODE__DROP_TARGET) ? '#30A46C' : 'none',
        'stroke-width': hasHighlight(props.node, Highlights.NODE__DROP_TARGET) ? 3 : 1,
        'fill': 'transparent',
        'on': {
          mousedown: props.onMouseDown,
          dblclick: builder.makeOnDblclickHandle('1')
        }
      })
    );

    // Step 2: Add optional background fill for entire swimlane
    if (shapeProps.fill && nodeProps.fill.enabled !== false) {
      builder.boundaryPath(boundary.all(), {
        fill: nodeProps.fill,
        stroke: { enabled: false }
      });
    }

    // Step 3: Render all child elements (swimlane rows)
    // Children are wrapped in a group with rotation transform to handle rotated swimlanes
    props.node.children.forEach(child => {
      builder.add(
        svg.g(
          { transform: Transforms.rotateBack(props.node.bounds) },
          renderElement(this, child, props)
        )
      );
    });

    // Step 4: Build the outer border (rectangle around the entire swimlane)
    const pathBuilder = new PathListBuilder();

    const hasOuterBorder = shapeProps.outerBorder !== false;
    const hasTitleBorder = shapeProps.titleBorder !== false;

    if (hasOuterBorder) {
      if (hasTitleBorder) {
        // If title border is enabled, outer border includes the title area
        PathBuilderHelper.rect(pathBuilder, {
          ...props.node.bounds,
          y: props.node.bounds.y,
          h: props.node.bounds.h
        });
      } else {
        // If title border is disabled, outer border starts below the title
        PathBuilderHelper.rect(pathBuilder, {
          ...props.node.bounds,
          y: props.node.bounds.y + (shapeProps.title ? shapeProps.titleSize : 0),
          h: props.node.bounds.h - (shapeProps.title ? shapeProps.titleSize : 0)
        });
      }
    }

    const bounds = props.node.bounds;

    // Step 5: Handle the optional title area at the top
    let startY = bounds.y;
    if (shapeProps.title) {
      const titleSize = shapeProps.titleSize;
      startY += titleSize;

      if (hasTitleBorder) {
        // Draw the title area as a filled rectangle at the top
        const titlePathBuilder = new PathListBuilder();
        titlePathBuilder.moveTo(Point.of(bounds.x, startY));
        titlePathBuilder.lineTo(Point.of(bounds.x, bounds.y));
        titlePathBuilder.lineTo(Point.of(bounds.x + bounds.w, bounds.y));
        titlePathBuilder.lineTo(Point.of(bounds.x + bounds.w, startY));
        titlePathBuilder.close();

        builder.path(titlePathBuilder.getPaths().all(), {
          ...nodeProps,
          // Disable stroke if outer border is present (to avoid double borders)
          stroke:
            !nodeProps.stroke.enabled || hasOuterBorder
              ? { enabled: false, color: 'transparent' }
              : nodeProps.stroke,
          fill: nodeProps.fill.enabled !== false ? nodeProps.fill : {}
        });

        // When outer border exists, we disabled the stroke above to avoid double borders
        // But this means we're missing the bottom border of the title area
        // So we add just that horizontal line here
        if (hasOuterBorder) {
          const titlePathBuilder = new PathListBuilder();
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

      // Add the text content in the title area
      builder.text(this, '1', props.node.getText(), nodeProps.text, {
        ...bounds,
        h: titleSize
      });
    }

    // Step 6: Add horizontal borders between child rows
    if (shapeProps.horizontalBorder !== false) {
      let y = startY;
      const sortedChildren = props.node.children.toSorted((a, b) => a.bounds.y - b.bounds.y);
      // Loop through children and add lines between them (not after the last one)
      for (let i = 0; i < sortedChildren.length - 1; i++) {
        const child = sortedChildren[i];
        if (isNode(child)) {
          y += child.bounds.h;
          pathBuilder.moveTo(Point.of(bounds.x, y));
          pathBuilder.lineTo(Point.of(bounds.x + bounds.w, y));
        }
      }
    }

    // Step 7: Render all the borders (outer border + horizontal dividers)
    // Use stroke from nodeProps but no fill
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
