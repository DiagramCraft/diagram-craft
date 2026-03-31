import { AbstractMoveDrag } from '@diagram-craft/canvas/drag/moveDrag';
import { DiagramElement, transformElements } from '@diagram-craft/model/diagramElement';
import { Diagram } from '@diagram-craft/model/diagram';
import { Context } from '@diagram-craft/canvas/context';
import { _p, Point } from '@diagram-craft/geometry/point';
import {
  DRAG_DROP_MANAGER,
  DragEvents,
  resolveCanvasDragElementId
} from '@diagram-craft/canvas/dragDropManager';
import { setPosition } from '@diagram-craft/utils/dom';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { Translation } from '@diagram-craft/geometry/transform';
import { CanvasDomHelper } from '@diagram-craft/canvas/utils/canvasDomHelper';

enum State {
  INSIDE,
  OUTSIDE
}

const getCanvasSVGElement = (event: { target: EventTarget }) => {
  return CanvasDomHelper.canvasElement(event.target) as HTMLElement;
};

export abstract class AbstractPickerDrag extends AbstractMoveDrag {
  readonly #originalSelectionState: readonly DiagramElement[];
  readonly #dragOffset: Point;
  #state: State = State.OUTSIDE;
  #dragImage: HTMLElement | undefined;
  protected _elements: DiagramElement[] = [];

  protected constructor(event: MouseEvent, diagram: Diagram, context: Context, dragOffset: Point) {
    super(diagram, dragOffset, event, context);
    this.isGlobal = true;
    this.#dragOffset = dragOffset;
    this.#originalSelectionState = diagram.selection.elements;
    this.context.help.push('AddDrag', 'Add element. Shift - constrain, Option - free');
    document.body.classList.add('no-select');
  }

  /** Returns the inner element to display as the drag preview. */
  protected abstract createDragImageContent(): HTMLElement;

  /** Adds the element(s) to the active layer at the given diagram point. */
  protected abstract addElement(point: Point): void;

  onDrag(event: DragEvents.DragStart) {
    if (this.isCanvasEvent(event.target)) {
      const svgElement = getCanvasSVGElement(event);
      const pointInSvgElement = EventHelper.pointWithRespectTo(event.offset, svgElement);
      const diagramPoint = this.diagram.viewBox.toDiagramPoint(pointInSvgElement);

      super.onDrag(new DragEvents.DragStart(diagramPoint, event.modifiers, event.target));
    } else {
      if (this.#dragImage) {
        setPosition(this.#dragImage, event.offset);
      }
    }
    this.emit('drag', { coord: event.offset, modifiers: event.modifiers });
  }

  onDragEnd() {
    document.body.classList.remove('no-select');
    this.context.help.pop('AddDrag');
    this.removeDragImage();

    if (this.#state === State.OUTSIDE) {
      this.cancel();
      this.uow.abort();
      this.uow = UnitOfWork.begin(this.diagram);
      super.onDragEnd();
      return;
    }

    const point = this.diagram.selection.bounds;
    this.removeElement();
    this.uow.abort();

    this.uow = UnitOfWork.begin(this.diagram);
    this.addElement(_p(0, 0));
    transformElements(this.diagram.selection.elements, [new Translation(point)], this.uow);

    super.onDragEnd();
  }

  protected wasDroppedInsideCanvas() {
    return this.#state === State.INSIDE;
  }

  cancel() {
    this.diagram.selection.clear();
    this.diagram.selection.setElements(this.#originalSelectionState);
    this.removeElement();
  }

  onDragEnter(event: DragEvents.DragEnter) {
    const svgElement = getCanvasSVGElement(event);
    if (svgElement) {
      this.onStateChange(State.INSIDE, event.offset, svgElement);
    } else {
      this.onStateChange(State.OUTSIDE, event.offset);
    }

    if (this.isCanvasEvent(event.target)) {
      super.onDragEnter(event);
    }
  }

  onDragLeave(event: DragEvents.DragLeave): void {
    if (this.isCanvasEvent(event.target)) {
      super.onDragLeave(event);
    }
  }

  override resolveDragTarget(
    point: Point,
    fallbackTarget: EventTarget
  ): { target: EventTarget; id?: string } {
    // During picker drags, the dragged preview can sit on top of the real canvas target.
    // Scan the full hit stack and return the first non-selected diagram element, with the
    // canvas itself as a fallback when we are only over background.
    const elements = document.elementsFromPoint(point.x, point.y);
    const selectionIds = new Set(this.diagram.selection.elements.map(e => e.id));

    for (const element of elements) {
      if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) continue;

      // Try to extract node or edge id - and stop in case the id
      // is not part of the selection
      const id = resolveCanvasDragElementId(element);
      if (id && !selectionIds.has(id)) {
        return { target: element, id };
      }
    }

    return super.resolveDragTarget(point, fallbackTarget);
  }

  onKeyDown(event: KeyboardEvent) {
    super.onKeyDown(event);

    if (event.key === 'Escape') {
      this.diagram.selection.clear();
      this.diagram.selection.setElements(this.#originalSelectionState);
      this.removeElement();
      this.onDragEnd();
      DRAG_DROP_MANAGER.clear();
    }
  }

  protected addDragImage(point: Point) {
    if (this.#dragImage) return;
    const content = this.createDragImageContent();
    this.#dragImage = document.createElement('div');
    setPosition(this.#dragImage, point);
    this.#dragImage.style.position = 'absolute';
    this.#dragImage.style.zIndex = '1000';
    this.#dragImage.style.pointerEvents = 'none';
    this.#dragImage.appendChild(content);
    document.body.appendChild(this.#dragImage);
  }

  protected removeDragImage() {
    this.#dragImage?.remove();
    this.#dragImage = undefined;
  }

  protected removeElement() {
    const activeLayer = this.diagram.activeLayer;
    assertRegularLayer(activeLayer);
    UnitOfWork.execute(this.diagram, uow => {
      this._elements.map(e => activeLayer.removeElement(e, uow));
    });
  }

  private onStateChange(
    state: State,
    point: Readonly<{ x: number; y: number }>,
    svgElement?: HTMLElement
  ) {
    if (this.#state === state) return;
    this.#state = state;

    if (this.#state === State.INSIDE) {
      this.removeDragImage();
      const pointInSvgElement = EventHelper.pointWithRespectTo(point, svgElement!);
      const diagramPoint = this.diagram.viewBox.toDiagramPoint(pointInSvgElement);
      this.addElement(Point.subtract(diagramPoint, this.#dragOffset));
    } else {
      this.removeElement();
      this.diagram.selection.clear();
      this.addDragImage(point);
    }
  }

  private isCanvasEvent(element: EventTarget): boolean {
    return this.#state === State.INSIDE && !!CanvasDomHelper.canvasElement(element);
  }
}
