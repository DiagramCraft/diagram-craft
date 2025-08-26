import { Drag, DragEvents } from '../dragDropManager';
import { Diagram } from '@diagram-craft/model/diagram';
import { DEFAULT_GUIDE_COLOR, Guide, GuideType } from '@diagram-craft/model/types';
import { round } from '@diagram-craft/utils/math';
import { CreateGuideUndoableAction } from '@diagram-craft/model/guides';
import { assert } from '@diagram-craft/utils/assert';

export class GuideCreateDrag extends Drag {
  isGlobal = true;

  private guide: Guide | undefined;
  private readonly mainSvg: SVGSVGElement;

  constructor(
    private diagram: Diagram,
    private guideType: GuideType
  ) {
    super();

    this.mainSvg = document.querySelector('svg.canvas.editable-canvas') as SVGSVGElement;
    assert.present(this.mainSvg);
  }

  onDrag(event: DragEvents.DragStart): void {
    const rect = this.mainSvg.getBoundingClientRect();
    const canvasPoint = { x: event.offset.x - rect.left, y: event.offset.y - rect.top };

    const diagramPoint = this.diagram.viewBox.toDiagramPoint(canvasPoint);
    const position = this.guideType === 'horizontal' ? diagramPoint.y : diagramPoint.x;

    if (!this.guide) {
      this.guide = this.diagram.addGuide({
        type: this.guideType,
        position: round(position),
        color: DEFAULT_GUIDE_COLOR
      });
    } else {
      this.diagram.updateGuide(this.guide.id, { position: round(position) });
    }

    this.setState({ label: `Creating ${this.guideType} guide: ${round(position)}px` });
  }

  onDragEnd(_event: DragEvents.DragEnd): void {
    if (this.guide) {
      this.diagram.undoManager.add(
        new CreateGuideUndoableAction(
          this.diagram,
          this.diagram.guides.find(g => g.id === this.guide!.id)!
        )
      );
    }

    this.emit('dragEnd');
  }
}
