import { BaseNodeComponent, BaseShapeBuildShapeProps } from '../components/BaseNodeComponent';
import { ShapeBuilder } from '../shape/ShapeBuilder';
import { PathBuilderHelper, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { DiagramNode, type NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Point } from '@diagram-craft/geometry/point';
import { LayoutCapableShapeNodeDefinition } from '../shape/shapeNodeDefinition';
import * as svg from '../component/vdom-svg';
import { Transforms } from '../component/vdom-svg';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { hasHighlight, Highlights } from '../highlight';
import { renderElement } from '../components/renderElement';
import type { NodeProps } from '@diagram-craft/model/diagramProps';
import { Box } from '@diagram-craft/geometry/box';
import type { VNode } from '../component/vdom';
import { Component } from '../component/component';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '../actions/abstractSelectionAction';
import { $tStr } from '@diagram-craft/utils/localize';
import { ActionCriteria, type ActionMap } from '../action';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import type { Context } from '../context';
import { mustExist } from '@diagram-craft/utils/assert';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      swimlane?: {
        orientation?: 'vertical' | 'horizontal';
        outerBorder?: boolean;
        title?: boolean;
        titleBorder?: boolean;
        titleSize?: number;
        fill?: boolean;
        collapsible?: boolean;
        bounds?: string;
        mode?: 'collapsed' | 'expanded';
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
  fill: false,
  collapsible: false,
  bounds: '',
  mode: 'expanded'
});

export class SwimlaneNodeDefinition extends LayoutCapableShapeNodeDefinition {
  overlayComponent = SwimlaneComponentOverlay;
  constructor() {
    super('swimlane', 'Swimlane', SwimlaneComponent);

    this.capabilities.fill = true;
    this.capabilities.rounding = false;
  }

  toggle(node: DiagramNode, uow: UnitOfWork) {
    const mode = node.renderProps.custom.swimlane.mode;

    const currentBounds = Box.toString(node.bounds);
    const previousBounds =
      node.renderProps.custom.swimlane.bounds === ''
        ? Box.fromCorners(
            Point.of(node.bounds.x, node.bounds.y),
            Point.of(node.bounds.x + 100, node.bounds.y + 50)
          )
        : Box.fromString(node.renderProps.custom.swimlane.bounds);

    node.setBounds(
      { ...previousBounds, x: node.bounds.x, y: node.bounds.y, r: node.bounds.r },
      uow
    );

    if (mode === 'expanded') {
      node.updateCustomProps(
        'swimlane',
        props => {
          props.mode = 'collapsed';
          props.bounds = currentBounds;
        },
        uow
      );
    } else {
      node.updateCustomProps(
        'swimlane',
        props => {
          props.mode = 'expanded';
          props.bounds = currentBounds;
        },
        uow
      );
    }
  }

  getShapeActions(_node: DiagramNode): ReadonlyArray<keyof ActionMap> {
    return [...super.getShapeActions(_node), 'SHAPE_SWIMLANE_TOGGLE'];
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
        id: 'collapsible',
        type: 'boolean',
        label: 'Collapsible',
        value: node.renderProps.custom.swimlane.collapsible,
        isSet: node.storedProps.custom?.swimlane?.collapsible !== undefined,
        onChange: (value: boolean | undefined, uow: UnitOfWork) => {
          node.updateCustomProps('swimlane', props => (props.collapsible = value), uow);
        }
      },
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
    const orientation = shapeProps.orientation ?? 'vertical';
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

    // Step 3: Render all child elements (e.g. swimlane rows)
    // Children are wrapped in a group with rotation transform to handle rotated swimlanes
    if (props.node.renderProps.custom.swimlane.mode === 'expanded') {
      props.node.children.forEach(child => {
      builder.add(
        svg.g(
          { transform: Transforms.rotateBack(props.node.bounds) },
          renderElement(this, child, props)
        )
      );
    });
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
    let startY = bounds.y;
    let startX = bounds.x;

    if (shapeProps.title) {
      const titleSize = shapeProps.titleSize;

      if (isHorizontal) {
        startX += titleSize;
      } else {
        startY += titleSize;
      }

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
          x: bounds.x,
          y: bounds.y,
          w: titleSize,
          h: bounds.h,
          r: -Math.PI / 2
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

export class SwimlaneComponentOverlay extends Component<{ node: DiagramNode }> {
  render(props: { node: DiagramNode }): VNode {
    const swimlaneProps = props.node.renderProps.custom.swimlane;

    if (!swimlaneProps.collapsible) return svg.g({});

    const iconSize = 8;
    const iconPadding = 4;
    const iconX = props.node.bounds.x + iconPadding;
    const iconY = props.node.bounds.y + iconPadding;

    const minusIcon = svg.g(
      {
        class: 'svg-swimlane__toggle svg-hover-overlay',
        on: {
          pointerdown: () => {
            const uow = new UnitOfWork(props.node.diagram, true);
            nodeDefinition.toggle(props.node, uow);
            commitWithUndo(uow, 'Toggle swimlane');
            this.redraw();
          }
        }
      },
      svg.rect({
        'x': iconX,
        'y': iconY,
        'width': iconSize,
        'height': iconSize,
        'stroke-width': 1,
        'rx': 1.5
      }),
      svg.line({
        'x1': iconX + iconSize * 0.15,
        'y1': iconY + iconSize * 0.5,
        'x2': iconX + iconSize * 0.85,
        'y2': iconY + iconSize * 0.5,
        'stroke-width': 1.5
      })
    );

    const plusIcon = svg.g(
      {
        'class': 'svg-swimlane__toggle svg-hover-overlay',
        'data-hover': 'true',
        'on': {
          pointerdown: () => {
            const uow = new UnitOfWork(props.node.diagram, true);
            nodeDefinition.toggle(props.node, uow);
            commitWithUndo(uow, 'Toggle swimlane');
            this.redraw();
          }
        }
      },
      svg.rect({
        'x': iconX,
        'y': iconY,
        'width': iconSize,
        'height': iconSize,
        'stroke-width': 1,
        'rx': 1.5
      }),
      svg.line({
        'x1': iconX + iconSize * 0.15,
        'y1': iconY + iconSize * 0.5,
        'x2': iconX + iconSize * 0.85,
        'y2': iconY + iconSize * 0.5,
        'stroke-width': 1.5
      }),
      svg.line({
        'x1': iconX + iconSize * 0.5,
        'y1': iconY + iconSize * 0.15,
        'x2': iconX + iconSize * 0.5,
        'y2': iconY + iconSize * 0.85,
        'stroke-width': 1.5
      })
    );

    const nodeDefinition = props.node.getDefinition() as SwimlaneNodeDefinition;

    if (swimlaneProps.mode === 'expanded') {
      return minusIcon;
    } else {
      return plusIcon;
    }
  }
}

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof swimlaneShapeActions> {}
  }
}

export const swimlaneShapeActions = (context: Context) => ({
  SHAPE_SWIMLANE_TOGGLE: new SwimlaneToggleAction(context)
});

class SwimlaneToggleAction extends AbstractSelectionAction<Context> {
  name = $tStr('action.SHAPE_SWIMLANE_TOGGLE.name', 'Collapse/Expand');

  constructor(context: Context) {
    super(context, MultipleType.SingleOnly, ElementType.Node);
  }

  getCriteria(context: Context): Array<ActionCriteria> {
    const cb = () => {
      const $s = context.model.activeDiagram.selection;
      if ($s.nodes.length !== 1) return false;

      const node = $s.nodes[0];
      if (!node) return false;

      return node.nodeType === 'swimlane';
    };

    return [
      ActionCriteria.EventTriggered(context.model.activeDiagram.selection, 'add', cb),
      ActionCriteria.EventTriggered(context.model.activeDiagram.selection, 'remove', cb)
    ];
  }

  execute(): void {
    const diagram = this.context.model.activeDiagram;
    assertRegularLayer(diagram.activeLayer);

    const uow = new UnitOfWork(diagram, true);

    const node = mustExist(diagram.selection.nodes[0]);
    const nodeDefinition = node.getDefinition() as SwimlaneNodeDefinition;
    nodeDefinition.toggle(node, uow);

    commitWithUndo(uow, 'Expand/Collapse swimlane');
  }
}
