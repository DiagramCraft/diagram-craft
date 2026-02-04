import { BaseNodeComponent, BaseShapeBuildShapeProps } from '../components/BaseNodeComponent';
import { ShapeBuilder } from '../shape/ShapeBuilder';
import { PathBuilderHelper, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { DiagramNode, type NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Point } from '@diagram-craft/geometry/point';
import { LayoutCapableShapeNodeDefinition } from '../shape/layoutCapableShapeNodeDefinition';
import * as svg from '../component/vdom-svg';
import {
  CustomPropertyDefinition,
  NodeFlags
} from '@diagram-craft/model/elementDefinitionRegistry';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { renderChildren } from '../components/renderElement';
import type { NodeProps } from '@diagram-craft/model/diagramProps';
import { CollapsibleOverlayComponent } from '../shape/collapsible';
import { Box } from '@diagram-craft/geometry/box';
import { invalidateDescendantEdges } from '@diagram-craft/model/collapsible';
import { NodeShapeConstructor } from '@diagram-craft/canvas/shape/shapeNodeDefinition';

type Orientation = 'vertical' | 'horizontal';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      swimlane?: {
        orientation?: Orientation;
        outerBorder?: boolean;
        title?: boolean;
        titleBorder?: boolean;
        titleSize?: number;
        filled?: boolean;
      };
    }
  }
}

registerCustomNodeDefaults('swimlane', {
  orientation: 'vertical',
  outerBorder: true,
  title: false,
  titleBorder: true,
  titleSize: 30,
  filled: false
});

export class SwimlaneNodeDefinition extends LayoutCapableShapeNodeDefinition {
  overlayComponent = CollapsibleOverlayComponent;

  constructor();
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  constructor(type: string, component: NodeShapeConstructor<any>);
  // biome-ignore lint/suspicious/noExplicitAny: false positive
  constructor(type: string, name: string, component: NodeShapeConstructor<any>);
  constructor(
    // biome-ignore lint/suspicious/noExplicitAny: false positive
    ...arr: [] | [string, NodeShapeConstructor<any>] | [string, string, NodeShapeConstructor<any>]
  ) {
    if (arr.length === 0) super('swimlane', 'Swimlane', SwimlaneComponent);
    else if (arr.length === 2) super(arr[0], arr[1]);
    else super(arr[0], arr[1], arr[2]);

    this.setFlags({
      [NodeFlags.StyleFill]: true,
      [NodeFlags.StyleRounding]: false,
      [NodeFlags.ChildrenCollapsible]: true,
      [NodeFlags.ChildrenTransformScaleX]: false,
      [NodeFlags.ChildrenTransformScaleY]: false
    });
  }

  private getCollapsedBounds(
    currentBounds: Box,
    orientation: Orientation,
    titleSize: number,
    storedBounds?: string
  ): Box {
    const defaultCollapsedDimensions = {
      w: orientation === 'vertical' ? titleSize : currentBounds.w,
      h: orientation === 'horizontal' ? titleSize : currentBounds.h
    };

    if (storedBounds && storedBounds !== '') {
      // Use the stored collapsed bounds (user may have resized while collapsed)
      const stored = Box.fromString(storedBounds);
      return { ...currentBounds, w: stored.w, h: stored.h };
    }

    // First time collapsing - use default collapsed size
    return { ...currentBounds, ...defaultCollapsedDimensions };
  }

  toggle(node: DiagramNode, uow: UnitOfWork): void {
    const edgeSnapshot = this.snapshotEdges(node);

    const customProps = this.getCollapsibleProps(node);
    const mode = customProps.mode ?? 'expanded';
    const swimlaneProps = node.renderProps.custom.swimlane;
    const orientation = swimlaneProps?.orientation ?? 'vertical';
    const titleSize = swimlaneProps?.titleSize ?? 30;

    const currentBounds = node.bounds;
    const currentBoundsStr = Box.toString(currentBounds);

    if (mode === 'expanded') {
      // Collapsing: swap dimensions to create perpendicular appearance
      // Vertical swimlane: keep height, set width to 2x titleSize
      // Horizontal swimlane: keep width, set height to 2x titleSize
      const collapsedBounds = this.getCollapsedBounds(
        currentBounds,
        orientation,
        titleSize,
        customProps.bounds
      );

      node.setBounds(collapsedBounds, uow);
      node.updateCustomProps(
        '_collapsible',
        props => {
          props.mode = 'collapsed';
          // Store current expanded bounds so we can restore them
          props.bounds = currentBoundsStr;
        },
        uow
      );
    } else {
      // Expanding: restore expanded bounds
      const expandedBounds = customProps.bounds
        ? Box.fromString(customProps.bounds)
        : { ...currentBounds, w: 100, h: 100 };

      node.setBounds(
        { ...expandedBounds, x: currentBounds.x, y: currentBounds.y, r: currentBounds.r },
        uow
      );
      node.updateCustomProps(
        '_collapsible',
        props => {
          props.mode = 'expanded';
          // Store the current collapsed size so we can return to it next time
          props.bounds = currentBoundsStr;
        },
        uow
      );
    }

    // Invalidate all edges connected to descendants so they recalculate positions
    invalidateDescendantEdges(node, uow);

    this.adjustEdges(edgeSnapshot, uow);
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

  getCustomPropertyDefinitions(node: DiagramNode) {
    return new CustomPropertyDefinition(p => [
      this.getCollapsiblePropertyDefinitions(node),
      p.select(node, 'Orientation', 'custom.swimlane.orientation', [
        { value: 'vertical', label: 'Vertical' },
        { value: 'horizontal', label: 'Horizontal' }
      ]),
      p.boolean(node, 'Title', 'custom.swimlane.title'),
      p.number(node, 'Title Size', 'custom.swimlane.titleSize', {
        unit: 'px'
      }),
      p.boolean(node, 'Outer Border', 'custom.swimlane.outerBorder'),
      p.boolean(node, 'Title Border', 'custom.swimlane.titleBorder'),

      p.boolean(node, 'Fill', 'custom.swimlane.filled')
    ]);
  }
}

// TODO: Support fill (should be only for title)
export class SwimlaneComponent extends BaseNodeComponent<SwimlaneNodeDefinition> {
  private renderTitleBorder(
    builder: ShapeBuilder,
    bounds: { x: number; y: number; w: number; h: number },
    isHorizontal: boolean,
    titleSize: number,
    nodeProps: NodePropsForRendering,
    hasOuterBorder: boolean,
    getStroke: (suppress?: boolean) => { enabled: boolean; color: string },
    getFill: () => NodeProps['fill']
  ) {
    const titlePathBuilder = new PathListBuilder();

    if (isHorizontal) {
      // Draw title area on the left
      const startX = bounds.x + titleSize;
      titlePathBuilder.moveTo(Point.of(startX, bounds.y));
      titlePathBuilder.lineTo(Point.of(bounds.x, bounds.y));
      titlePathBuilder.lineTo(Point.of(bounds.x, bounds.y + bounds.h));
      titlePathBuilder.lineTo(Point.of(startX, bounds.y + bounds.h));
      titlePathBuilder.close();

      builder.path(titlePathBuilder.getPaths().all(), {
        ...nodeProps,
        stroke: getStroke(hasOuterBorder),
        fill: getFill()
      });

      // Add the missing right border of title area when outer border exists
      if (hasOuterBorder) {
        const borderBuilder = new PathListBuilder();
        borderBuilder.moveTo(Point.of(startX, bounds.y));
        borderBuilder.lineTo(Point.of(startX, bounds.y + bounds.h));
        builder.path(borderBuilder.getPaths().all(), {
          ...nodeProps,
          stroke: getStroke(),
          fill: getFill()
        });
      }
    } else {
      // Draw title area on the top
      const startY = bounds.y + titleSize;
      titlePathBuilder.moveTo(Point.of(bounds.x, startY));
      titlePathBuilder.lineTo(Point.of(bounds.x, bounds.y));
      titlePathBuilder.lineTo(Point.of(bounds.x + bounds.w, bounds.y));
      titlePathBuilder.lineTo(Point.of(bounds.x + bounds.w, startY));
      titlePathBuilder.close();

      builder.path(titlePathBuilder.getPaths().all(), {
        ...nodeProps,
        stroke: getStroke(hasOuterBorder),
        fill: getFill()
      });

      // Add the missing bottom border of title area when outer border exists
      if (hasOuterBorder) {
        const borderBuilder = new PathListBuilder();
        borderBuilder.moveTo(Point.of(bounds.x, startY));
        borderBuilder.lineTo(Point.of(bounds.x + bounds.w, startY));
        builder.path(borderBuilder.getPaths().all(), {
          ...nodeProps,
          stroke: getStroke(),
          fill: getFill()
        });
      }
    }
  }

  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
    const path = boundary.singular();
    const svgPath = path.asSvgPath();

    const nodeProps = props.nodeProps;
    const shapeProps = nodeProps.custom.swimlane;
    const baseOrientation = shapeProps.orientation ?? 'vertical';

    // Check if node is in collapsed mode - if so, swap the orientation for rendering
    const collapsibleProps = this.def.getCollapsibleProps(props.node);
    const isCollapsed = collapsibleProps.mode === 'collapsed';

    // When collapsed, horizontal swimlanes render as vertical and vice versa
    const orientation: Orientation = isCollapsed
      ? baseOrientation === 'horizontal'
        ? 'vertical'
        : 'horizontal'
      : baseOrientation;
    const isHorizontal = orientation === 'horizontal';

    // Helper to get stroke props (disabled if stroke not enabled or if suppressed)
    const getStroke = (suppress: boolean = false) =>
      !nodeProps.stroke.enabled || suppress
        ? { enabled: false, color: 'transparent' }
        : nodeProps.stroke;

    // Helper to get fill props
    const getFill = () => (nodeProps.fill.enabled !== false ? nodeProps.fill : {});

    // Step 1: Create a transparent base shape for mouse interactions
    // This serves as the clickable/hoverable area and shows a highlight when dragging
    builder.noBoundaryNeeded();
    builder.add(
      svg.path({
        class: 'svg-node--container-outline',
        d: svgPath,
        x: props.node.bounds.x,
        y: props.node.bounds.y,
        width: props.node.bounds.w,
        height: props.node.bounds.h,
        fill: 'transparent',
        on: {
          mousedown: props.onMouseDown,
          dblclick: builder.makeOnDblclickHandle('1')
        }
      })
    );

    // Step 2: Add optional background fill for entire swimlane
    if (shapeProps.filled && nodeProps.fill.enabled !== false) {
      builder.boundaryPath(boundary.all(), {
        fill: nodeProps.fill,
        stroke: { enabled: false }
      });
    }

    // Step 3: Render all child elements (e.g. swimlane rows)
    // Children are wrapped in a group with rotation transform to handle rotated swimlanes
    if (this.def.shouldRenderChildren(props.node)) {
      builder.add(renderChildren(this, props.node, props));
    }

    // Step 4: Build the outer border (rectangle around the entire swimlane)
    const pathBuilder = new PathListBuilder();

    const hasOuterBorder = shapeProps.outerBorder !== false;
    const hasTitleBorder = shapeProps.titleBorder !== false;

    if (hasOuterBorder) {
      if (hasTitleBorder) {
        // If title border is enabled, outer border includes the title area
        PathBuilderHelper.rect(pathBuilder, props.node.bounds);
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
    if (shapeProps.title) {
      const titleSize = shapeProps.titleSize;

      if (hasTitleBorder) {
        this.renderTitleBorder(
          builder,
          bounds,
          isHorizontal,
          titleSize,
          nodeProps,
          hasOuterBorder,
          getStroke,
          getFill
        );
      }

      // Add the text content in the title area
      if (isHorizontal) {
        builder.text(this, '1', props.node.getText(), nodeProps.text, {
          ...bounds,
          h: titleSize,
          w: bounds.h,
          x: bounds.x - bounds.h / 2 + titleSize / 2,
          y: bounds.y + (bounds.h - titleSize) / 2,
          r: props.node.bounds.r - Math.PI / 2
        });
      } else {
        builder.text(this, '1', props.node.getText(), nodeProps.text, {
          ...bounds,
          h: titleSize
        });
      }
    }

    // Step 6: Render all the borders (outer border + lane dividers)
    builder.path(pathBuilder.getPaths().all(), {
      ...nodeProps,
      stroke: getStroke(),
      fill: { enabled: false, color: 'transparent' }
    });
  }
}
