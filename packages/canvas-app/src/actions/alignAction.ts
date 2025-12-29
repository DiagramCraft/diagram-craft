import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas/actions/abstractSelectionAction';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import { assert } from '@diagram-craft/utils/assert';
import { ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';
import { $tStr, TranslatedString } from '@diagram-craft/utils/localize';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof alignActions> {}
  }
}

export const alignActions = (context: ActionContext) => ({
  ALIGN_TOP: new AlignAction('top', $tStr('action.ALIGN_TOP.name', 'Align Top Edges'), context),
  ALIGN_BOTTOM: new AlignAction(
    'bottom',
    $tStr('action.ALIGN_BOTTOM.name', 'Align Bottom Edges'),
    context
  ),
  ALIGN_CENTER_HORIZONTAL: new AlignAction(
    'center-horizontal',
    $tStr('action.ALIGN_CENTER_HORIZONTAL.name', 'Align Centers Horizontally'),
    context
  ),
  ALIGN_LEFT: new AlignAction('left', $tStr('action.ALIGN_LEFT.name', 'Align Left Edges'), context),
  ALIGN_RIGHT: new AlignAction(
    'right',
    $tStr('action.ALIGN_RIGHT.name', 'Align Right Edges'),
    context
  ),
  ALIGN_CENTER_VERTICAL: new AlignAction(
    'center-vertical',
    $tStr('action.ALIGN_CENTER_VERTICAL.name', 'Align Centers Vertically'),
    context
  ),
  ALIGN_WIDTH: new DimensionAlignAction(
    'width',
    $tStr('action.ALIGN_WIDTH.name', 'Align Width'),
    context
  ),
  ALIGN_HEIGHT: new DimensionAlignAction(
    'height',
    $tStr('action.ALIGN_HEIGHT.name', 'Align Height'),
    context
  )
});

type Mode = 'top' | 'bottom' | 'right' | 'left' | 'center-vertical' | 'center-horizontal';

export class AlignAction extends AbstractSelectionAction {
  constructor(
    private readonly mode: Mode,
    public readonly name: TranslatedString,
    context: ActionContext
  ) {
    super(context, MultipleType.MultipleOnly, ElementType.Node);
  }

  getCriteria(context: ActionContext): Array<ActionCriteria> {
    const cb = () => {
      const $s = context.model.activeDiagram.selection;
      if ($s.isEmpty()) {
        return false;
      }

      const nodes = $s.nodes;
      if (nodes.length === 0) {
        return false;
      }

      // Allow if multiple nodes selected
      if (nodes.length > 1) {
        return true;
      }

      // Allow if single node with at least 2 children
      if (nodes.length === 1) {
        const node = nodes[0];
        if (node && node.children.length >= 2) {
          return true;
        }
      }

      return false;
    };

    return [
      ActionCriteria.EventTriggered(context.model.activeDiagram.selection, 'add', cb),
      ActionCriteria.EventTriggered(context.model.activeDiagram.selection, 'remove', cb)
    ];
  }

  execute(): void {
    const uow = new UnitOfWork(this.context.model.activeDiagram, true);

    // Get elements to align - either selected nodes or children of a single selected node
    const elements = this.getElementsToAlign();
    assert.arrayNotEmpty(elements);

    const first = elements[0];

    switch (this.mode) {
      case 'top':
        this.alignY(first.bounds.y, 0, uow, elements);
        break;
      case 'bottom':
        this.alignY(first.bounds.y + first.bounds.h, 1, uow, elements);
        break;
      case 'center-horizontal':
        this.alignY(first.bounds.y + first.bounds.h / 2, 0.5, uow, elements);
        break;
      case 'left':
        this.alignX(first.bounds.x, 0, uow, elements);
        break;
      case 'right':
        this.alignX(first.bounds.x + first.bounds.w, 1, uow, elements);
        break;
      case 'center-vertical':
        this.alignX(first.bounds.x + first.bounds.w / 2, 0.5, uow, elements);
        break;
    }

    commitWithUndo(uow, `Align ${this.mode}`);

    this.emit('actionTriggered', {});
  }

  private getElementsToAlign(): ReadonlyArray<DiagramElement> {
    const selection = this.context.model.activeDiagram.selection;
    const nodes = selection.nodes;

    // If single node with at least 2 children, return the children
    if (nodes.length === 1) {
      assert.arrayNotEmpty(nodes);
      const node = nodes[0];
      if (node.children.length >= 2) {
        return node.children;
      }
    }

    // Otherwise return the selected elements
    return selection.elements;
  }

  // y + h === Y       => y = Y - h       => y = Y - h * offset (offset = 1)
  // y + h / 2 === Y   => y = Y - h / 2   => y = Y - h * offset (offset = 0.5)
  // y === Y           => y = Y           => y = Y - h * offset (offset = 0)
  private alignY(
    y: number,
    offset: number,
    uow: UnitOfWork,
    elements: ReadonlyArray<DiagramElement>
  ) {
    elements.forEach(e => {
      if (isNode(e) && e.renderProps.capabilities.movable === false) return;
      e.setBounds({ ...e.bounds, y: y - e.bounds.h * offset }, uow);
    });
  }

  // x + w === X       => x = X - w       => x = X - w * offset (offset = 1)
  // x + w / 2 === X   => x = X - w / 2   => x = X - w * offset (offset = 0.5)
  // x === X           => x = X           => x = X - w * offset (offset = 0)
  private alignX(
    x: number,
    offset: number,
    uow: UnitOfWork,
    elements: ReadonlyArray<DiagramElement>
  ) {
    elements.forEach(e => {
      if (isNode(e) && e.renderProps.capabilities.movable === false) return;
      e.setBounds({ ...e.bounds, x: x - e.bounds.w * offset }, uow);
    });
  }
}

type DimensionMode = 'width' | 'height';

export class DimensionAlignAction extends AbstractSelectionAction {
  constructor(
    private readonly mode: DimensionMode,
    public readonly name: TranslatedString,
    context: ActionContext
  ) {
    super(context, MultipleType.MultipleOnly, ElementType.Node);
  }

  execute(): void {
    const uow = new UnitOfWork(this.context.model.activeDiagram, true);

    const elements = this.context.model.activeDiagram.selection.elements;
    assert.arrayNotEmpty(elements);

    const first = elements[0];
    const targetDimension = this.mode === 'width' ? first.bounds.w : first.bounds.h;

    elements.forEach(e => {
      if (isNode(e) && e.renderProps.capabilities.movable === false) return;

      if (this.mode === 'width') {
        e.setBounds({ ...e.bounds, w: targetDimension }, uow);
      } else {
        e.setBounds({ ...e.bounds, h: targetDimension }, uow);
      }
    });

    commitWithUndo(uow, `Align ${this.mode}`);

    this.emit('actionTriggered', {});
  }
}
