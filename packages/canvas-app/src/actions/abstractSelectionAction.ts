import { AbstractAction } from '@diagram-craft/canvas/action';
import { Diagram } from '@diagram-craft/model/diagram';
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

export abstract class AbstractSelectionAction extends AbstractAction {
  protected constructor(
    protected readonly diagram: Diagram,
    protected readonly multipleType: MultipleType,
    protected readonly elementType: ElementType = 'both',
    protected readonly layerTypes: LayerType[] | undefined = undefined
  ) {
    super();

    const cb = () => {
      const $s = this.diagram.selectionState;
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
    this.addCriterion(this.diagram.selectionState, 'add', cb);
    this.addCriterion(this.diagram.selectionState, 'remove', cb);
  }

  abstract execute(): void;
}
