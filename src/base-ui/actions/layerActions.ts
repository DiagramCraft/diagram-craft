import { Diagram } from '../../model/diagram.ts';
import { ActionMapFactory, State } from '../keyMap.ts';
import { assert } from '../../utils/assert.ts';
import { AbstractAction, ActionContext } from '../action.ts';

declare global {
  interface ActionMap {
    LAYER_DELETE_LAYER: LayerDeleteAction;
    LAYER_TOGGLE_VISIBILITY: LayerDeleteAction;
    LAYER_TOGGLE_LOCK: LayerDeleteAction;
  }
}

export const layerActions: ActionMapFactory = (state: State) => ({
  LAYER_DELETE_LAYER: new LayerDeleteAction(state.diagram),
  LAYER_TOGGLE_VISIBILITY: new LayerDeleteAction(state.diagram),
  LAYER_TOGGLE_LOCK: new LayerDeleteAction(state.diagram)
});

export class LayerDeleteAction extends AbstractAction {
  constructor(protected readonly diagram: Diagram) {
    super();
  }

  execute(context: ActionContext): void {
    assert.present(context.id);
    const layer = this.diagram.layers.byId(context.id);

    assert.present(layer);
    this.diagram.layers.remove(layer);
  }
}
