import { Drag, DragEvents } from '../dragDropManager';
import { Diagram } from '@diagram-craft/model/diagram';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { Guide } from '@diagram-craft/model/types';
import { round } from '@diagram-craft/utils/math';

export class GuideDrag extends Drag {
  private readonly originalPosition: number;

  constructor(
    private diagram: Diagram,
    private guide: Guide
  ) {
    super();
    this.originalPosition = guide.position;
    this.isGlobal = false;
  }

  onDrag(event: DragEvents.DragStart): void {
    // Calculate new position based on guide type
    let newPosition: number;
    if (this.guide.type === 'horizontal') {
      newPosition = event.offset.y;
    } else {
      newPosition = event.offset.x;
    }

    // Update the guide position
    this.diagram.updateGuide(this.guide.id, { position: round(newPosition) });

    this.setState({
      label: `${this.guide.type} guide: ${round(newPosition)}px`
    });
  }

  onDragEnd(_event: DragEvents.DragEnd): void {
    // Commit the final position change with undo support
    const currentGuide = this.diagram.guides.find(g => g.id === this.guide.id);
    if (currentGuide && currentGuide.position !== this.originalPosition) {
      const uow = new UnitOfWork(this.diagram, true);
      this.diagram.updateGuide(this.guide.id, { position: currentGuide.position });
      commitWithUndo(uow, 'Move guide');
    }

    this.emit('dragEnd');
  }
}
