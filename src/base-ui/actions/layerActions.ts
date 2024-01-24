import { Diagram } from '../../model/diagram.ts';
import { State } from '../keyMap.ts';
import { assert } from '../../utils/assert.ts';
import { AbstractAction, ActionContext } from '../action.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { CompoundUndoableAction, UndoableAction } from '../../model/undoManager.ts';
import { Layer } from '../../model/diagramLayer.ts';
import { SnapshotUndoableAction } from '../../model/diagramUndoActions.ts';

export const layerActions = (state: State) => ({
  LAYER_DELETE_LAYER: new LayerDeleteAction(state.diagram),
  LAYER_TOGGLE_VISIBILITY: new LayerDeleteAction(state.diagram),
  LAYER_TOGGLE_LOCK: new LayerDeleteAction(state.diagram)
});

declare global {
  interface ActionMap extends ReturnType<typeof layerActions> {}
}

export class LayerDeleteAction extends AbstractAction {
  constructor(protected readonly diagram: Diagram) {
    super();
  }

  isEnabled(context: ActionContext): boolean {
    return context.id !== undefined && this.diagram.layers.byId(context.id) !== undefined;
  }

  execute(context: ActionContext): void {
    const uow = new UnitOfWork(this.diagram, true);

    assert.present(context.id);
    const layer = this.diagram.layers.byId(context.id);

    assert.present(layer);
    this.diagram.layers.remove(layer, uow);

    const snapshots = uow.commit();
    this.diagram.undoManager.add(
      new CompoundUndoableAction([
        new LayerDeleteUndoableAction(this.diagram, layer),
        new SnapshotUndoableAction('Delete layer', this.diagram, snapshots)
      ])
    );
  }
}

class LayerDeleteUndoableAction implements UndoableAction {
  description = 'Delete layer';

  constructor(
    private readonly diagram: Diagram,
    private readonly layer: Layer
  ) {}

  undo(uow: UnitOfWork) {
    this.diagram.layers.add(this.layer, uow);
  }

  redo(uow: UnitOfWork) {
    this.diagram.layers.remove(this.layer, uow);
  }
}
