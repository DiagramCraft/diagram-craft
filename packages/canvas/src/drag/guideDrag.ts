import { Drag, DragEvents, Modifiers } from '../dragDropManager';
import { Diagram } from '@diagram-craft/model/diagram';
import { round } from '@diagram-craft/utils/math';
import {
  CreateGuideUndoableAction,
  DEFAULT_GUIDE_COLOR,
  type Guide,
  type GuideType,
  MoveGuideUndoableAction
} from '@diagram-craft/model/guides';
import { getSnapConfig, SnapManager } from '../snap/snapManager';
import { assert } from '@diagram-craft/utils/assert';
import { Line } from '@diagram-craft/geometry/line';
import { Range } from '@diagram-craft/geometry/range';

const isFreeDrag = (m: Modifiers) => m.altKey;

const LINE_RANGE = Range.of(-10000, 10000);

abstract class BaseGuideDrag extends Drag {
  protected readonly snapManager: SnapManager;

  protected constructor(
    protected diagram: Diagram,
    protected guideType: GuideType
  ) {
    super();

    this.snapManager = new SnapManager(
      this.diagram,
      id => !diagram.lookup(id)?.parent,
      getSnapConfig(diagram)
    );
  }

  protected snapGuidePosition(rawPosition: number, modifiers: Modifiers): number {
    if (isFreeDrag(modifiers)) return round(rawPosition);

    const isHorizontal = this.guideType === 'horizontal';

    const line = isHorizontal
      ? Line.horizontal(rawPosition, LINE_RANGE)
      : Line.vertical(rawPosition, LINE_RANGE);

    const snapResult = this.snapManager.snapOrthoLinearLine(line);
    return isHorizontal ? snapResult.adjusted.from.y : snapResult.adjusted.from.x;
  }
}

export class GuideMoveDrag extends BaseGuideDrag {
  private readonly originalPosition: number;

  constructor(
    diagram: Diagram,
    private guide: Guide
  ) {
    super(diagram, guide.type);
    this.originalPosition = guide.position;
  }

  onDrag(event: DragEvents.DragStart): void {
    const rawPosition = this.guideType === 'horizontal' ? event.offset.y : event.offset.x;
    const snappedPosition = this.snapGuidePosition(rawPosition, event.modifiers);

    this.diagram.updateGuide(this.guide.id, { position: round(snappedPosition) });
    this.setState({ label: `${this.guide.type} guide: ${round(snappedPosition)}px` });

    this.emit('drag', { coord: event.offset, modifiers: event.modifiers });
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

  cancel() {
    this.diagram.updateGuide(this.guide.id, { position: this.originalPosition });
  }
}

export class GuideCreateDrag extends BaseGuideDrag {
  isGlobal = true;

  private guide: Guide | undefined;
  private readonly mainSvg: SVGSVGElement;
  private rect: DOMRect;

  constructor(diagram: Diagram, guideType: GuideType) {
    super(diagram, guideType);

    this.mainSvg = document.querySelector('svg.canvas.editable-canvas') as SVGSVGElement;
    assert.present(this.mainSvg);
    this.rect = this.mainSvg.getBoundingClientRect();
  }

  onDrag(event: DragEvents.DragStart): void {
    const canvasPoint = { x: event.offset.x - this.rect.left, y: event.offset.y - this.rect.top };
    const diagramPoint = this.diagram.viewBox.toDiagramPoint(canvasPoint);

    const rawPosition = this.guideType === 'horizontal' ? diagramPoint.y : diagramPoint.x;
    const snappedPosition = this.snapGuidePosition(rawPosition, event.modifiers);

    if (!this.guide) {
      this.guide = this.diagram.addGuide({
        type: this.guideType,
        position: round(snappedPosition),
        color: DEFAULT_GUIDE_COLOR
      });
    } else {
      this.diagram.updateGuide(this.guide.id, { position: round(snappedPosition) });
    }

    this.setState({ label: `Creating ${this.guideType} guide: ${round(snappedPosition)}px` });

    this.emit('drag', { coord: event.offset, modifiers: event.modifiers });
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

  cancel() {}
}
