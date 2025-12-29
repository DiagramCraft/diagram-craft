import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import type { VNode } from '../component/vdom';
import { Component } from '../component/component';
import * as svg from '../component/vdom-svg';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '../actions/abstractSelectionAction';
import { $tStr } from '@diagram-craft/utils/localize';
import { ActionCriteria } from '../action';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import type { Context } from '../context';
import { mustExist } from '@diagram-craft/utils/assert';
import type { LayoutCapableShapeNodeDefinition } from './layoutCapableShapeNodeDefinition';

/**
 * Generic overlay component for collapsible nodes
 * Renders a +/- toggle button when the node is collapsible
 */
export class CollapsibleOverlayComponent extends Component<{ node: DiagramNode }> {
  render(props: { node: DiagramNode }): VNode {
    const def = props.node.getDefinition() as LayoutCapableShapeNodeDefinition;

    // Only render if node supports collapsible capability
    if (!def.supports('collapsible')) return svg.g({});

    const collapsibleProps = def.getCollapsibleProps(props.node);
    if (!collapsibleProps.collapsible) return svg.g({});

    const iconSize = 8;
    const iconPadding = 4;
    const iconX = props.node.bounds.x + iconPadding;
    const iconY = props.node.bounds.y + iconPadding;

    const minusIcon = svg.g(
      {
        class: 'svg-collapsible__toggle svg-hover-overlay',
        on: {
          pointerdown: () => {
            const uow = new UnitOfWork(props.node.diagram, true);
            def.toggle(props.node, uow);
            commitWithUndo(uow, 'Toggle collapse/expand');
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
        'class': 'svg-collapsible__toggle svg-hover-overlay',
        'data-hover': 'true',
        'on': {
          pointerdown: () => {
            const uow = new UnitOfWork(props.node.diagram, true);
            def.toggle(props.node, uow);
            commitWithUndo(uow, 'Toggle collapse/expand');
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

    if (collapsibleProps.mode === 'expanded') {
      return minusIcon;
    } else {
      return plusIcon;
    }
  }
}

/**
 * Generic action for toggling collapsible nodes
 * Works with any node that supports the 'collapsible' capability
 */
export class CollapsibleToggleAction extends AbstractSelectionAction<Context> {
  name = $tStr('action.SHAPE_TOGGLE_COLLAPSIBLE.name', 'Collapse/Expand');

  constructor(context: Context) {
    super(context, MultipleType.SingleOnly, ElementType.Node);
  }

  getCriteria(context: Context): Array<ActionCriteria> {
    const cb = () => {
      const $s = context.model.activeDiagram.selection;
      if ($s.nodes.length !== 1) return false;

      const node = $s.nodes[0];
      if (!node) return false;

      return node.getDefinition().supports('collapsible');
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
    const nodeDefinition = node.getDefinition() as LayoutCapableShapeNodeDefinition;
    nodeDefinition.toggle(node, uow);

    commitWithUndo(uow, 'Expand/Collapse');
  }
}

// Action factory for registration
declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof collapsibleNodeActions> {}
  }
}

export const collapsibleNodeActions = (context: Context) => ({
  SHAPE_TOGGLE_COLLAPSIBLE: new CollapsibleToggleAction(context)
});
