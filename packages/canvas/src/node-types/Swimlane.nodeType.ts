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
        orientation?: 'vertical' | 'horizontal';
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
  orientation: 'vertical',
  horizontalBorder: true,
  outerBorder: true,
  title: false,
  titleBorder: true,
  titleSize: 30,
  fill: false
});

export class SwimlaneNodeDefinition extends LayoutCapableShapeNodeDefinition {
  constructor() {
    super('swimlane', 'Swimlane', SwimlaneComponent);

    this.capabilities.fill = true;
    this.capabilities.rounding = false;
  }

  getContainerPadding(node: DiagramNode) {
    if (node.renderProps.custom.swimlane.title) {
      const titleSize = node.renderProps.custom.swimlane.titleSize;
      const orientation = node.renderProps.custom.swimlane.orientation ?? 'vertical';

      if (orientation === 'horizontal') {
        return { top: 0, bottom: 0, right: 0, left: titleSize };
      } else {
        return { top: titleSize, bottom: 0, right: 0, left: 0 };
      }
    } else {
      return super.getContainerPadding(node);
    }
  }

  getCustomPropertyDefinitions(node: DiagramNode): Array<CustomPropertyDefinition> {
    return [
      {
        id: 'orientation',
        type: 'select',
        label: 'Orientation',
        value: node.renderProps.custom.swimlane.orientation,
        options: [
          { value: 'vertical', label: 'Vertical' },
          { value: 'horizontal', label: 'Horizontal' }
        ],
        isSet: node.storedProps.custom?.swimlane?.orientation !== undefined,
        onChange: (value: string | undefined, uow: UnitOfWork) => {
          node.updateCustomProps(
            'swimlane',
            props => (props.orientation = value as 'vertical' | 'horizontal'),
            uow
          );
        }
      },
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
    const orientation = shapeProps.orientation ?? 'vertical';
    const isHorizontal = orientation === 'horizontal';

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
        // If title border is disabled, outer border starts after the title
        if (isHorizontal) {
          PathBuilderHelper.rect(pathBuilder, {
            ...props.node.bounds,
            x: props.node.bounds.x + (shapeProps.title ? shapeProps.titleSize : 0),
            w: props.node.bounds.w - (shapeProps.title ? shapeProps.titleSize : 0)
          });
        } else {
          PathBuilderHelper.rect(pathBuilder, {
            ...props.node.bounds,
            y: props.node.bounds.y + (shapeProps.title ? shapeProps.titleSize : 0),
            h: props.node.bounds.h - (shapeProps.title ? shapeProps.titleSize : 0)
          });
        }
      }
    }

    const bounds = props.node.bounds;

    // Step 5: Handle the optional title area
    let startY = bounds.y;
    let startX = bounds.x;

    if (shapeProps.title) {
      const titleSize = shapeProps.titleSize;

      if (isHorizontal) {
        startX += titleSize;

        if (hasTitleBorder) {
          // Draw the title area as a filled rectangle on the left
          const titlePathBuilder = new PathListBuilder();
          titlePathBuilder.moveTo(Point.of(startX, bounds.y));
          titlePathBuilder.lineTo(Point.of(bounds.x, bounds.y));
          titlePathBuilder.lineTo(Point.of(bounds.x, bounds.y + bounds.h));
          titlePathBuilder.lineTo(Point.of(startX, bounds.y + bounds.h));
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
          // But this means we're missing the right border of the title area
          // So we add just that vertical line here
          if (hasOuterBorder) {
            const titleBorderBuilder = new PathListBuilder();
            titleBorderBuilder.moveTo(Point.of(startX, bounds.y));
            titleBorderBuilder.lineTo(Point.of(startX, bounds.y + bounds.h));

            builder.path(titleBorderBuilder.getPaths().all(), {
              ...nodeProps,
              stroke: !nodeProps.stroke.enabled
                ? { enabled: false, color: 'transparent' }
                : nodeProps.stroke,
              fill: nodeProps.fill.enabled !== false ? nodeProps.fill : {}
            });
          }
        }

        // Add the text content in the title area with 90 degree rotation (reading south to north)
        builder.text(this, '1', props.node.getText(), nodeProps.text, {
          x: bounds.x,
          y: bounds.y,
          w: titleSize,
          h: bounds.h,
          r: -Math.PI / 2
        });
      } else {
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
            const titleBorderBuilder = new PathListBuilder();
            titleBorderBuilder.moveTo(Point.of(bounds.x, startY));
            titleBorderBuilder.lineTo(Point.of(bounds.x + bounds.w, startY));

            builder.path(titleBorderBuilder.getPaths().all(), {
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
    }

    // Step 6: Add borders between child lanes
    if (shapeProps.horizontalBorder !== false) {
      if (isHorizontal) {
        // For horizontal orientation, draw vertical lines between lanes
        let x = startX;
        const sortedChildren = props.node.children.toSorted((a, b) => a.bounds.x - b.bounds.x);
        // Loop through children and add lines between them (not after the last one)
        for (let i = 0; i < sortedChildren.length - 1; i++) {
          const child = sortedChildren[i];
          if (isNode(child)) {
            x += child.bounds.w;
            pathBuilder.moveTo(Point.of(x, bounds.y));
            pathBuilder.lineTo(Point.of(x, bounds.y + bounds.h));
          }
        }
      } else {
        // For vertical orientation, draw horizontal lines between lanes
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
