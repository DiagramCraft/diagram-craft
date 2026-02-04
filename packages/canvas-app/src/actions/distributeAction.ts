import { AbstractSelectionAction } from '@diagram-craft/canvas/actions/abstractSelectionAction';
import { Box } from '@diagram-craft/geometry/box';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DiagramElement, isNode } from '@diagram-craft/model/diagramElement';
import { ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';
import { $tStr, TranslatedString } from '@diagram-craft/utils/localize';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof distributeActions> {}
  }
}

export const distributeActions = (context: ActionContext) => ({
  DISTRIBUTE_HORIZONTAL: new DistributeAction(
    'horizontal',
    $tStr('action.DISTRIBUTE_HORIZONTAL.name', 'Distribute Horizontally'),
    context
  ),
  DISTRIBUTE_VERTICAL: new DistributeAction(
    'vertical',
    $tStr('action.DISTRIBUTE_VERTICAL.name', 'Distribute Vertically'),
    context
  )
});

const minBounds = (b: Box) => {
  return { x: Math.min(b.x, b.x + b.w), y: Math.min(b.y, b.y + b.h) };
};

const maxBounds = (b: Box) => {
  return { x: Math.max(b.x, b.x + b.w), y: Math.max(b.y, b.y + b.h) };
};

export class DistributeAction extends AbstractSelectionAction {
  constructor(
    private readonly mode: 'vertical' | 'horizontal',
    public readonly name: TranslatedString,
    context: ActionContext
  ) {
    super(context, 'multiple-only');
  }

  getCriteria(context: ActionContext): Array<ActionCriteria> {
    const cb = () => {
      const $s = context.model.activeDiagram.selection;
      if ($s.isEmpty()) {
        return false;
      }

      const elements = $s.elements;
      if (elements.length === 0) {
        return false;
      }

      // Allow if multiple elements selected
      if (elements.length > 1) {
        return true;
      }

      // Allow if single node with at least 2 children
      if (elements.length === 1) {
        const element = elements[0];
        if (element && isNode(element) && element.children.length >= 2) {
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
    UnitOfWork.executeWithUndo(this.context.model.activeDiagram, `Distribute ${this.mode}`, uow => {
      const boundsOrientation = this.mode === 'vertical' ? 'y' : 'x';
      const boundsSize = this.mode === 'vertical' ? 'h' : 'w';

      this.calculateAndUpdateBounds(boundsOrientation, boundsSize, uow);
    });

    this.emit('actionTriggered', {});
  }

  private getElementsToDistribute(): ReadonlyArray<DiagramElement> {
    const selection = this.context.model.activeDiagram.selection;
    const elements = selection.elements;

    // If single node with at least 2 children, return the children
    if (elements.length === 1) {
      const element = elements[0];
      if (isNode(element) && element.children.length >= 2) {
        return element.children;
      }
    }

    // Otherwise return the selected elements
    return selection.elements;
  }

  private calculateAndUpdateBounds(orientation: 'x' | 'y', size: 'w' | 'h', uow: UnitOfWork): void {
    const elements = this.getElementsToDistribute();
    const elementsInOrder = elements.toSorted(
      (a, b) => minBounds(a.bounds)[orientation] - minBounds(b.bounds)[orientation]
    );

    const minimal = elementsInOrder[0]!;
    const min = minBounds(minimal.bounds)[orientation];
    const max = maxBounds(elementsInOrder.at(-1)!.bounds)[orientation];

    const totalSpace = max - min - elements.reduce((p, c) => p + c.bounds[size], 0);

    const difference = totalSpace / (elements.length - 1);

    let currentPosition = min + Math.abs(minimal.bounds[size] + difference);
    for (const e of elementsInOrder.slice(1)) {
      if (isNode(e) && e.renderProps.capabilities.movable === false) continue;
      if (e.bounds[size] >= 0) {
        e.setBounds(
          orientation === 'y'
            ? { ...e.bounds, y: currentPosition }
            : { ...e.bounds, x: currentPosition },
          uow
        );
      } else {
        e.setBounds(
          orientation === 'y'
            ? { ...e.bounds, y: currentPosition - e.bounds[size] }
            : { ...e.bounds, x: currentPosition - e.bounds[size] },
          uow
        );
      }
      currentPosition += Math.abs(e.bounds[size] + difference);
    }
  }
}
