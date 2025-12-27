import {
  LayoutCapableShapeNodeDefinition,
  ShapeNodeDefinition
} from '../shape/shapeNodeDefinition';
import { BaseNodeComponent, BaseShapeBuildShapeProps } from '../components/BaseNodeComponent';
import * as svg from '../component/vdom-svg';
import { Transforms } from '../component/vdom-svg';
import { ShapeBuilder } from '../shape/ShapeBuilder';
import { Box } from '@diagram-craft/geometry/box';
import { Point } from '@diagram-craft/geometry/point';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { mustExist } from '@diagram-craft/utils/assert';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { hasHighlight, Highlights } from '../highlight';
import { renderElement } from '../components/renderElement';
import type { VNode } from '../component/vdom';
import { Component } from '../component/component';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { type PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import type { Anchor } from '@diagram-craft/model/anchor';
import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '../actions/abstractSelectionAction';
import { $tStr } from '@diagram-craft/utils/localize';
import { ActionCriteria, type ActionMap } from '../action';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import type { Context } from '../context';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      container?: {
        collapsible?: boolean;
        bounds?: string;
        mode?: 'collapsed' | 'expanded';
        shape?: string;
      };
    }
  }
}

registerCustomNodeDefaults('container', {
  collapsible: false,
  bounds: '',
  mode: 'expanded',
  shape: ''
});

const getShape = (node: DiagramNode): ShapeNodeDefinition | undefined => {
  const shape = node.renderProps.custom.container.shape;
  if (shape === '') return undefined;

  return node.diagram.document.nodeDefinitions.get(shape) as ShapeNodeDefinition | undefined;
};

export class ContainerNodeDefinition extends LayoutCapableShapeNodeDefinition {
  overlayComponent = ContainerComponentOverlay;

  constructor(id = 'container', name = 'Container', component = ContainerComponent) {
    super(id, name, component);

    this.capabilities.fill = true;
  }

  toggle(node: DiagramNode, uow: UnitOfWork) {
    const mode = node.renderProps.custom.container.mode;

    const currentBounds = Box.toString(node.bounds);
    const previousBounds =
      node.renderProps.custom.container.bounds === ''
        ? Box.fromCorners(
            Point.of(node.bounds.x, node.bounds.y),
            Point.of(node.bounds.x + 100, node.bounds.y + 50)
          )
        : Box.fromString(node.renderProps.custom.container.bounds);

    node.setBounds(
      { ...previousBounds, x: node.bounds.x, y: node.bounds.y, r: node.bounds.r },
      uow
    );

    if (mode === 'expanded') {
      node.updateCustomProps(
        'container',
        props => {
          props.mode = 'collapsed';
          props.bounds = currentBounds;
        },
        uow
      );
    } else {
      node.updateCustomProps(
        'container',
        props => {
          props.mode = 'expanded';
          props.bounds = currentBounds;
        },
        uow
      );
    }
  }

  getShapeActions(_node: DiagramNode): ReadonlyArray<keyof ActionMap> {
    return [...super.getShapeActions(_node), 'SHAPE_CONTAINER_TOGGLE'];
  }

  getCustomPropertyDefinitions(node: DiagramNode): Array<CustomPropertyDefinition> {
    const shape = getShape(node);
    return [
      {
        id: 'collapsible',
        type: 'boolean',
        label: 'Collapsible',
        value: node.renderProps.custom.container.collapsible,
        isSet: node.storedProps.custom?.container?.collapsible !== undefined,
        onChange: (value: boolean | undefined, uow: UnitOfWork) => {
          node.updateCustomProps('container', props => (props.collapsible = value), uow);
        }
      },
      ...(shape
        ? [
            {
              id: 'delimiter',
              type: 'delimiter',
              label: shape.name,
              isSet: false
            } as CustomPropertyDefinition,
            ...shape.getCustomPropertyDefinitions(node)
          ]
        : [])
    ];
  }

  getBoundingPathBuilder(node: DiagramNode): PathListBuilder {
    const shape = getShape(node);
    if (shape) {
      return shape.getBoundingPathBuilder(node);
    } else {
      return super.getBoundingPathBuilder(node);
    }
  }

  getAnchors(node: DiagramNode): Anchor[] {
    const shape = getShape(node);
    if (shape) {
      return shape.getAnchors(node);
    } else {
      return super.getAnchors(node);
    }
  }
}

export class ContainerComponent extends BaseNodeComponent {
  delegateComponent: BaseNodeComponent | undefined;

  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    const shape = getShape(props.node);
    if (shape) {
      if (!this.delegateComponent) {
        this.delegateComponent = new shape.component(shape);
      } else if (this.delegateComponent.constructor !== shape.component) {
        this.delegateComponent = new shape.component(shape);
      }
    }

    if (this.delegateComponent) {
      this.delegateComponent.buildShape(props, builder);
    } else {
      const paths = new ContainerNodeDefinition().getBoundingPathBuilder(props.node).getPaths();

      const path = paths.singular();
      const svgPath = path.asSvgPath();

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
            mousedown: props.onMouseDown
          }
        })
      );
    }

    if (props.node.renderProps.custom.container.mode === 'expanded') {
      props.node.children.forEach(child => {
        builder.add(
          svg.g(
            { transform: Transforms.rotateBack(props.node.bounds) },
            renderElement(this, child, props)
          )
        );
      });
    }
  }
}

export class ContainerComponentOverlay extends Component<{ node: DiagramNode }> {
  render(props: { node: DiagramNode }): VNode {
    const containerProps = props.node.renderProps.custom.container;

    if (!containerProps.collapsible) return svg.g({});

    const iconSize = 8;
    const iconPadding = 4;
    const iconX = props.node.bounds.x + iconPadding;
    const iconY = props.node.bounds.y + iconPadding;

    const minusIcon = svg.g(
      {
        class: 'svg-container__toggle svg-hover-overlay',
        on: {
          pointerdown: () => {
            const uow = new UnitOfWork(props.node.diagram, true);
            nodeDefinition.toggle(props.node, uow);
            commitWithUndo(uow, 'Toggle container');
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
        'class': 'svg-container__toggle svg-hover-overlay',
        'data-hover': 'true',
        'on': {
          pointerdown: () => {
            const uow = new UnitOfWork(props.node.diagram, true);
            nodeDefinition.toggle(props.node, uow);
            commitWithUndo(uow, 'Toggle container');
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

    const nodeDefinition = props.node.getDefinition() as ContainerNodeDefinition;

    if (containerProps.mode === 'expanded') {
      return minusIcon;
    } else {
      return plusIcon;
    }
  }
}

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof containerShapeActions> {}
  }
}

export const containerShapeActions = (context: Context) => ({
  SHAPE_CONTAINER_TOGGLE: new ContainerToggleAction(context)
});

class ContainerToggleAction extends AbstractSelectionAction<Context> {
  name = $tStr('action.SHAPE_CONTAINER_TOGGLE.name', 'Collapse/Expand');

  constructor(context: Context) {
    super(context, MultipleType.SingleOnly, ElementType.Node);
  }

  getCriteria(context: Context): Array<ActionCriteria> {
    const cb = () => {
      const $s = context.model.activeDiagram.selection;
      if ($s.nodes.length !== 1) return false;

      const node = $s.nodes[0];
      if (!node) return false;

      return node.nodeType === 'container';
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
    const nodeDefinition = node.getDefinition() as ContainerNodeDefinition;
    nodeDefinition.toggle(node, uow);

    commitWithUndo(uow, 'Expand/Collapse container');
  }
}
