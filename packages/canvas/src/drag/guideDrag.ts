import { Drag, DragEvents, Modifiers } from '../dragDropManager';
import { Diagram } from '@diagram-craft/model/diagram';
import { DEFAULT_GUIDE_COLOR, Guide, GuideType } from '@diagram-craft/model/types';
import { round } from '@diagram-craft/utils/math';
import { CreateGuideUndoableAction, MoveGuideUndoableAction } from '@diagram-craft/model/guides';
import { Point } from '@diagram-craft/geometry/point';
import { SnapManager } from '@diagram-craft/model/snap/snapManager';
import { SnapManagerConfig } from '@diagram-craft/model/snap/snapManagerConfig';
import { assert } from '@diagram-craft/utils/assert';
import { Line } from '@diagram-craft/geometry/line';

const isFreeDrag = (m: Modifiers) => m.altKey;

const LINE_LENGTH = 10000;

abstract class BaseGuideDrag extends Drag {
  protected readonly snapManager: SnapManager;

  protected constructor(protected diagram: Diagram) {
    super();

    const snapConfig = new SnapManagerConfig(['grid', 'node']);
    snapConfig.enabled = this.diagram.snapManagerConfig.enabled;
    snapConfig.threshold = this.diagram.snapManagerConfig.threshold;

    this.snapManager = new SnapManager(this.diagram, () => true, snapConfig);
  }

  protected snapGuidePosition(
    rawPosition: number,
    guideType: GuideType,
    modifiers: Modifiers
  ): number {
    if (isFreeDrag(modifiers)) {
      return round(rawPosition);
    }

    const line =
      guideType === 'horizontal'
        ? Line.of(Point.of(-LINE_LENGTH, rawPosition), Point.of(LINE_LENGTH, rawPosition))
        : Line.of(Point.of(rawPosition, -LINE_LENGTH), Point.of(rawPosition, LINE_LENGTH));

    const snapResult = this.snapManager.snapOrthoLinearLine(line);
    return guideType === 'horizontal' ? snapResult.adjusted.from.y : snapResult.adjusted.from.x;
  }
}

export class GuideMoveDrag extends BaseGuideDrag {
  private readonly originalPosition: number;

  constructor(
    diagram: Diagram,
    private guide: Guide
  ) {
    super(diagram);
    this.originalPosition = guide.position;
  }

  onDrag(event: DragEvents.DragStart): void {
    const rawPosition = this.guide.type === 'horizontal' ? event.offset.y : event.offset.x;
    const snappedPosition = this.snapGuidePosition(rawPosition, this.guide.type, event.modifiers);

    this.diagram.updateGuide(this.guide.id, { position: round(snappedPosition) });
    this.setState({
      label: `${this.guide.type} guide: ${round(snappedPosition)}px`
    });
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

  constructor(
    diagram: Diagram,
    private guideType: GuideType
  ) {
    super(diagram);

    this.mainSvg = document.querySelector('svg.canvas.editable-canvas') as SVGSVGElement;
    assert.present(this.mainSvg);
  }

  onDrag(event: DragEvents.DragStart): void {
    const rect = this.mainSvg.getBoundingClientRect();
    const canvasPoint = { x: event.offset.x - rect.left, y: event.offset.y - rect.top };
    const diagramPoint = this.diagram.viewBox.toDiagramPoint(canvasPoint);

    const rawPosition = this.guideType === 'horizontal' ? diagramPoint.y : diagramPoint.x;
    const snappedPosition = this.snapGuidePosition(rawPosition, this.guideType, event.modifiers);

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
