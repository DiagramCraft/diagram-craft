import { AbstractAction, ActionContext, ActionCriteria } from '@diagram-craft/canvas/action';
import { LayerType } from '@diagram-craft/model/diagramLayer';

export type MultipleType = 'single-only' | 'multiple-only' | 'both';

export const MultipleType: Record<string, MultipleType> = {
  SingleOnly: 'single-only',
  MultipleOnly: 'multiple-only',
  Both: 'both'
};

export type ElementType = 'node' | 'edge' | 'both';

export const ElementType: Record<string, ElementType> = {
  Node: 'node',
  Edge: 'edge',
  Both: 'both'
};

// TODO: Switch the order of these type parameters
export abstract class AbstractSelectionAction<
  C extends ActionContext = ActionContext,
  T = undefined
> extends AbstractAction<T, C> {
  protected constructor(
    context: C,
    protected readonly multipleType: MultipleType,
    protected readonly elementType: ElementType = 'both',
    protected readonly layerTypes: LayerType[] | undefined = undefined
  ) {
    super(context);
  }

  getCriteria(context: C) {
    const cb = () => {
      const $s = context.model.activeDiagram.selectionState;
      if ($s.isEmpty()) {
        return false;
      }

      if (
        this.layerTypes !== undefined &&
        !$s.elements.every(e => this.layerTypes!.includes(e.layer.type))
      ) {
        return false;
      }

      const elements =
        this.elementType === 'both'
          ? $s.elements
          : this.elementType === 'edge'
            ? $s.edges
            : $s.nodes;

      if (elements.length === 0) {
        return false;
      }

      if (this.multipleType === 'single-only' && elements.length > 1) {
        return false;
      }

      if (this.multipleType === 'multiple-only' && elements.length === 1) {
        return false;
      }

      return true;
    };

    return [
      ActionCriteria.EventTriggered(context.model.activeDiagram.selectionState, 'add', cb),
      ActionCriteria.EventTriggered(context.model.activeDiagram.selectionState, 'remove', cb)
    ];
  }

  abstract execute(arg?: Partial<T>): void;
}
