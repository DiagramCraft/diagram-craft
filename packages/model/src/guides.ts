import { UndoableAction } from './undoManager';
import { Diagram } from './diagram';

export type GuideType = 'horizontal' | 'vertical';

export interface Guide {
  id: string;
  type: GuideType;
  position: number;
  color?: string;
}

export const DEFAULT_GUIDE_COLOR = 'var(--accent-9)';

export class CreateGuideUndoableAction implements UndoableAction {
  description = `Create guide`;

  constructor(
    private readonly diagram: Diagram,
    private readonly guide: Guide
  ) {}

  undo() {
    this.diagram.removeGuide(this.guide.id);
  }

  redo() {
    this.diagram.addGuide(this.guide);
  }
}

export class DeleteGuideUndoableAction implements UndoableAction {
  description = `Delete guide`;

  constructor(
    private readonly diagram: Diagram,
    private readonly guide: Guide
  ) {}

  undo() {
    this.diagram.addGuide(this.guide);
  }

  redo() {
    this.diagram.removeGuide(this.guide.id);
  }
}

export class MoveGuideUndoableAction implements UndoableAction {
  description = `Move guide`;

  constructor(
    private readonly diagram: Diagram,
    private readonly guide: Guide,
    private readonly oldPosition: number,
    private readonly newPosition: number
  ) {}

  undo() {
    this.diagram.updateGuide(this.guide.id, { position: this.oldPosition });
  }

  redo() {
    this.diagram.updateGuide(this.guide.id, { position: this.newPosition });
  }
}

export class EditGuideUndoableAction implements UndoableAction {
  description = `Edit guide`;

  constructor(
    private readonly diagram: Diagram,
    private readonly guide: Guide,
    private readonly oldGuide: Partial<Guide>,
    private readonly newGuide: Partial<Guide>
  ) {}

  undo() {
    this.diagram.updateGuide(this.guide.id, this.oldGuide);
  }

  redo() {
    this.diagram.updateGuide(this.guide.id, this.newGuide);
  }
}
