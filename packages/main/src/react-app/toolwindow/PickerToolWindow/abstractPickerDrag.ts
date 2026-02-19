import { AbstractMoveDrag } from '@diagram-craft/canvas/drag/moveDrag';
import { DiagramElement, transformElements } from '@diagram-craft/model/diagramElement';
import { Diagram } from '@diagram-craft/model/diagram';
import { Context } from '@diagram-craft/canvas/context';
import { _p, Point } from '@diagram-craft/geometry/point';
import { DRAG_DROP_MANAGER, DragEvents } from '@diagram-craft/canvas/dragDropManager';
import { getAncestorWithClass, setPosition } from '@diagram-craft/utils/dom';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { Translation } from '@diagram-craft/geometry/transform';

enum State {
  INSIDE,
  OUTSIDE
}

export abstract class AbstractPickerDrag extends AbstractMoveDrag {
  readonly #originalSelectionState: readonly DiagramElement[];
  #state: State = State.OUTSIDE;
  #dragImage: HTMLElement | undefined;
  protected _elements: DiagramElement[] = [];

  protected constructor(event: MouseEvent, diagram: Diagram, context: Context) {
    super(diagram, Point.ORIGIN, event, context);
    this.isGlobal = true;
    this.#originalSelectionState = diagram.selection.elements;
    this.context.help.push('AddDrag', 'Add element. Shift - constrain, Option - free');
    document.body.classList.add('no-select');
  }

  onDrag(event: DragEvents.DragStart) {
    if (this.isCanvasEvent(event.target)) {
      super.onDrag(event);
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

    const point = this.diagram.selection.bounds;
    this.removeElement();
    this.uow.abort();
    this.uow = UnitOfWork.begin(this.diagram);
    this.addElement(_p(0, 0));
    transformElements(this.diagram.selection.elements, [new Translation(point)], this.uow);

    super.onDragEnd();
  }

  cancel() {
    this.diagram.selection.clear();
    this.diagram.selection.setElements(this.#originalSelectionState);
    this.removeElement();
  }

  onDragEnter(event: DragEvents.DragEnter) {
    const svgElement = getAncestorWithClass(
      event.target as HTMLElement,
      'editable-canvas'
    ) as HTMLElement;
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

  /** Returns the inner element to display as the drag preview. */
  protected abstract createDragImageContent(): HTMLElement;

  /** Adds the element(s) to the active layer at the given diagram point. */
  protected abstract addElement(point: Point): void;

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
      this.addElement(diagramPoint);
    } else {
      this.removeElement();
      this.diagram.selection.clear();
      this.addDragImage(point);
    }
  }

  private isCanvasEvent(element: EventTarget): boolean {
    return this.#state === State.INSIDE && (element as HTMLElement).tagName === 'svg';
  }
}
