import { Drag, DragEvents } from '../dragDropManager';
import { Diagram } from '@diagram-craft/model/diagram';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { DEFAULT_GUIDE_COLOR, Guide, GuideType } from '@diagram-craft/model/types';
import { round } from '@diagram-craft/utils/math';
import { newid } from '@diagram-craft/utils/id';

export class GuideCreateDrag extends Drag {
  private guide: Guide | undefined;
  private hasBeenCreated = false;

  constructor(
    private diagram: Diagram,
    private guideType: GuideType
  ) {
    super();
    this.isGlobal = true;
  }

  onDrag(event: DragEvents.DragStart): void {
    // For global drags, event.offset contains clientX/clientY coordinates
    // Convert to canvas-relative coordinates
    const mainSvg = document.querySelector('svg.canvas.editable-canvas') as SVGSVGElement;
    if (!mainSvg) return;

    const rect = mainSvg.getBoundingClientRect();
    const canvasPoint = {
      x: event.offset.x - rect.left,
      y: event.offset.y - rect.top
    };

    const diagramPoint = this.diagram.viewBox.toDiagramPoint(canvasPoint);

    // Calculate position based on guide type
    let position: number;
    if (this.guideType === 'horizontal') {
      position = diagramPoint.y;
    } else {
      position = diagramPoint.x;
    }

    if (!this.hasBeenCreated) {
      // Create the guide on first drag
      this.guide = this.diagram.addGuide({
        id: newid(),
        type: this.guideType,
        position: round(position),
        color: DEFAULT_GUIDE_COLOR
      });
      this.hasBeenCreated = true;
    } else if (this.guide) {
      // Update existing guide position
      this.diagram.updateGuide(this.guide.id, { position: round(position) });
    }

    this.setState({
      label: `Creating ${this.guideType} guide: ${round(position)}px`
    });
  }

  onDragEnd(_event: DragEvents.DragEnd): void {
    if (this.guide) {
      // Commit the guide creation with undo support
      const uow = new UnitOfWork(this.diagram, true);
      // The guide is already created, just commit it for undo
      commitWithUndo(uow, `Create ${this.guideType} guide`);
    }

    this.emit('dragEnd');
  }
}
