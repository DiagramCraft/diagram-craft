import { Drag, DragEvents, Modifiers } from '../dragDropManager';
import { Diagram } from '@diagram-craft/model/diagram';
import { DEFAULT_GUIDE_COLOR, Guide, GuideType } from '@diagram-craft/model/types';
import { round } from '@diagram-craft/utils/math';
import { CreateGuideUndoableAction, MoveGuideUndoableAction } from '@diagram-craft/model/guides';
import { SnapManager } from '@diagram-craft/model/snap/snapManager';
import { SnapManagerConfig } from '@diagram-craft/model/snap/snapManagerConfig';
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

    const snapConfig = new SnapManagerConfig(['grid', 'node']);
    snapConfig.enabled = this.diagram.snapManagerConfig.enabled;
    snapConfig.threshold = this.diagram.snapManagerConfig.threshold;

    this.snapManager = new SnapManager(this.diagram, id => !diagram.lookup(id)?.parent, snapConfig);
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

export class GuideCreateDrag extends BaseGuideDrag {
  isGlobal = true;

  private guide: Guide | undefined;
  private readonly mainSvg: SVGSVGElement;

  constructor(diagram: Diagram, guideType: GuideType) {
    super(diagram, guideType);

    this.mainSvg = document.querySelector('svg.canvas.editable-canvas') as SVGSVGElement;
    assert.present(this.mainSvg);
  }

  onDrag(event: DragEvents.DragStart): void {
    const rect = this.mainSvg.getBoundingClientRect();
    const canvasPoint = { x: event.offset.x - rect.left, y: event.offset.y - rect.top };
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
