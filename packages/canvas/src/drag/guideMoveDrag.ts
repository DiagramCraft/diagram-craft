import { Drag, DragEvents } from '../dragDropManager';
import { Diagram } from '@diagram-craft/model/diagram';
import { Guide } from '@diagram-craft/model/types';
import { round } from '@diagram-craft/utils/math';
import { MoveGuideUndoableAction } from '@diagram-craft/model/guides';

export class GuideMoveDrag extends Drag {
  private readonly originalPosition: number;

  constructor(
    private diagram: Diagram,
    private guide: Guide
  ) {
    super();
    this.originalPosition = guide.position;
  }

  onDrag(event: DragEvents.DragStart): void {
    const newPosition = this.guide.type === 'horizontal' ? event.offset.y : event.offset.x;

    this.diagram.updateGuide(this.guide.id, { position: round(newPosition) });

    this.setState({ label: `${this.guide.type} guide: ${round(newPosition)}px` });
  }

  onDragEnd(_event: DragEvents.DragEnd): void {
    const currentGuide = this.diagram.guides.find(g => g.id === this.guide.id);
    if (currentGuide && currentGuide.position !== this.originalPosition) {
      this.diagram.undoManager.addAndExecute(
        new MoveGuideUndoableAction(
          this.diagram,
          this.guide,
          this.originalPosition,
          currentGuide.position
        )
      );
    }

    this.emit('dragEnd');
  }
}
