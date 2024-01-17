import { VERIFY_NOT_REACHED } from '../../utils/assert.ts';
import { SnapshotUndoableAction } from '../../model/diagramUndoActions.ts';
import { AbstractSelectionAction } from './abstractSelectionAction.ts';
import { Diagram } from '../../model/diagram.ts';
import { ActionMapFactory, State } from '../keyMap.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';

declare global {
  interface ActionMap {
    ALIGN_TOP: AlignAction;
    ALIGN_BOTTOM: AlignAction;
    ALIGN_CENTER_HORIZONTAL: AlignAction;
    ALIGN_LEFT: AlignAction;
    ALIGN_RIGHT: AlignAction;
    ALIGN_CENTER_VERTICAL: AlignAction;
  }
}

export const alignActions: ActionMapFactory = (state: State) => ({
  ALIGN_TOP: new AlignAction(state.diagram, 'top'),
  ALIGN_BOTTOM: new AlignAction(state.diagram, 'bottom'),
  ALIGN_CENTER_HORIZONTAL: new AlignAction(state.diagram, 'center-horizontal'),
  ALIGN_LEFT: new AlignAction(state.diagram, 'left'),
  ALIGN_RIGHT: new AlignAction(state.diagram, 'right'),
  ALIGN_CENTER_VERTICAL: new AlignAction(state.diagram, 'center-vertical')
});

export class AlignAction extends AbstractSelectionAction {
  enabled = false;

  constructor(
    protected readonly diagram: Diagram,
    private readonly mode:
      | 'top'
      | 'bottom'
      | 'right'
      | 'left'
      | 'center-vertical'
      | 'center-horizontal'
  ) {
    super(diagram, true);
  }

  execute(): void {
    const uow = new UnitOfWork(this.diagram, true);

    const first = this.diagram.selectionState.elements[0];
    if (this.mode === 'top') {
      this.alignY(first.bounds.y, 0, uow);
    } else if (this.mode === 'bottom') {
      this.alignY(first.bounds.y + first.bounds.h, 1, uow);
    } else if (this.mode === 'center-horizontal') {
      this.alignY(first.bounds.y + first.bounds.h / 2, 0.5, uow);
    } else if (this.mode === 'left') {
      this.alignX(first.bounds.x, 0, uow);
    } else if (this.mode === 'right') {
      this.alignX(first.bounds.x + first.bounds.w, 1, uow);
    } else if (this.mode === 'center-vertical') {
      this.alignX(first.bounds.x + first.bounds.w / 2, 0.5, uow);
    } else {
      VERIFY_NOT_REACHED();
    }

    const snapshots = uow.commit();
    this.diagram.undoManager.add(
      new SnapshotUndoableAction(
        `Align ${this.mode}`,
        snapshots,
        snapshots.retakeSnapshot(this.diagram),
        this.diagram
      )
    );
    this.emit('actiontriggered', { action: this });
  }

  // y + h === Y       => y = Y - h       => y = Y - h * offset (offset = 1)
  // y + h / 2 === Y   => y = Y - h / 2   => y = Y - h * offset (offset = 0.5)
  // y === Y           => y = Y           => y = Y - h * offset (offset = 0)
  private alignY(y: number, offset: number, uow: UnitOfWork) {
    this.diagram.selectionState.elements.forEach(e => {
      e.setBounds({ ...e.bounds, y: y - e.bounds.h * offset }, uow);
    });
  }

  // x + w === X       => x = X - w       => x = X - w * offset (offset = 1)
  // x + w / 2 === X   => x = X - w / 2   => x = X - w * offset (offset = 0.5)
  // x === X           => x = X           => x = X - w * offset (offset = 0)
  private alignX(x: number, offset: number, uow: UnitOfWork) {
    this.diagram.selectionState.elements.forEach(e => {
      e.setBounds({ ...e.bounds, x: x - e.bounds.w * offset }, uow);
    });
  }
}
