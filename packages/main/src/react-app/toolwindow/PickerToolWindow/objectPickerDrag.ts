import { AbstractMoveDrag } from '@diagram-craft/canvas/drag/moveDrag';
import { DiagramElement, transformElements } from '@diagram-craft/model/diagramElement';
import { Diagram } from '@diagram-craft/model/diagram';
import { Context } from '@diagram-craft/canvas/context';
import { _p, Point } from '@diagram-craft/geometry/point';
import { DRAG_DROP_MANAGER, DragEvents } from '@diagram-craft/canvas/dragDropManager';
import { getAncestorWithClass, setPosition } from '@diagram-craft/utils/dom';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import {
  addAllChildren,
  assignNewBounds,
  cloneElements
} from '@diagram-craft/model/diagramElementUtils';
import { Box } from '@diagram-craft/geometry/box';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { clamp } from '@diagram-craft/utils/math';
import { insert } from '@diagram-craft/canvas/component/vdom';
import { StaticCanvasComponent } from '@diagram-craft/canvas/canvas/StaticCanvasComponent';
import { createThumbnail } from '@diagram-craft/canvas-app/diagramThumbnail';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { Translation } from '@diagram-craft/geometry/transform';
import { Stylesheet } from '@diagram-craft/model/diagramStyles';
import { StencilStyle } from '@diagram-craft/model/stencilRegistry';

enum State {
  INSIDE,
  OUTSIDE
}

export class ObjectPickerDrag extends AbstractMoveDrag {
  readonly #originalSelectionState: readonly DiagramElement[];

  #state: State = State.OUTSIDE;
  #dragImage: HTMLElement | undefined;
  #elements: DiagramElement[] = [];

  constructor(
    event: MouseEvent,
    readonly source: DiagramElement[],
    readonly diagram: Diagram,
    readonly stencilId: string | undefined,
    readonly styles: Array<StencilStyle>,
    context: Context
  ) {
    super(diagram, Point.ORIGIN, event, context);
    this.isGlobal = true;

    this.#originalSelectionState = diagram.selection.elements;

    this.addDragImage({ x: event.clientX, y: event.clientY });

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

    const activeLayer = this.diagram.activeLayer;
    assertRegularLayer(activeLayer);

    // We abort the current unit of work and re-add the elements back to the diagram
    // This ensures the uow is streamlined and does not contain a mix of adds and removes
    const point = this.diagram.selection.bounds;
    this.removeElement();
    this.uow.abort();

    this.uow = UnitOfWork.begin(this.diagram);

    this.addElement(_p(0, 0));
    transformElements(this.diagram.selection.elements, [new Translation(point)], this.uow);

    super.onDragEnd();

    if (this.stencilId) {
      this.diagram.document.props.recentStencils.register(this.stencilId);
    }
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

  private addDragImage(point: Point) {
    if (this.#dragImage) return;

    const scale = clamp(this.diagram.viewBox.zoomLevel, 0.3, 3);

    const { diagram: dest } = createThumbnail(
      (_d, l, uow) => cloneElements(this.source, l, uow),
      this.diagram.document.registry
    );

    const bounds = Box.boundingBox(this.source.map(e => e.bounds));

    const props = {
      id: `canvas-drag-image-${dest.id}`,
      context: this.context,
      diagram: dest,
      width: bounds.w / scale,
      height: bounds.h / scale
    };

    const canvas = new StaticCanvasComponent(props);
    const $canvasVdomNode = canvas.render(props);
    insert($canvasVdomNode);

    const $canvasEl = $canvasVdomNode.el!;
    $canvasEl.style.background = 'transparent';
    $canvasEl.setAttribute('viewBox', `-2 -2 ${bounds.w + 4} ${bounds.h + 4}`);

    this.#dragImage = document.createElement('div');
    setPosition(this.#dragImage, point);
    this.#dragImage.style.position = 'absolute';
    this.#dragImage.style.zIndex = '1000';
    this.#dragImage.style.pointerEvents = 'none';
    this.#dragImage.appendChild($canvasEl);
    document.body.appendChild(this.#dragImage);
  }

  private removeDragImage() {
    this.#dragImage?.remove();
    this.#dragImage = undefined;
  }

  private addElement(point: Point) {
    const styleManager = this.diagram.document.styles;
    for (const style of this.styles) {
      if (styleManager.get(style.id) === undefined) {
        const stylesheet = Stylesheet.fromSnapshot(
          style.type,
          style,
          styleManager.crdt.factory,
          styleManager
        );
        styleManager.addStylesheet(style.id, stylesheet, this.uow);
      }
    }

    const sourceDiagram = this.source[0]!.diagram;
    const sourceLayer = sourceDiagram.activeLayer;
    assertRegularLayer(sourceLayer);

    const activeLayer = this.diagram.activeLayer;
    assertRegularLayer(activeLayer);

    this.#elements = cloneElements(sourceLayer.elements, activeLayer);

    const sourceBounds = Box.boundingBox(this.source.map(e => e.bounds));
    const bounds = Box.boundingBox(this.#elements.map(e => e.bounds));

    const scaleX = sourceBounds.w / bounds.w;

    // Prevent NaN for zero-heigh edges
    const scaleY = Math.max(0.1, sourceBounds.h) / Math.max(0.1, bounds.h);

    this.#elements.forEach(e => {
      activeLayer.addElement(e, this.uow);
      addAllChildren(e, this.uow);
    });

    UnitOfWork.execute(this.diagram, uow => {
      assignNewBounds(this.#elements, point, Point.of(scaleX, scaleY), uow);
    });

    this.diagram.selection.clear();
    this.diagram.selection.setElements(this.#elements);
  }

  private removeElement() {
    const activeLayer = this.diagram.activeLayer;
    assertRegularLayer(activeLayer);
    UnitOfWork.execute(this.diagram, uow => {
      this.#elements.map(e => activeLayer.removeElement(e, uow));
    });
  }
}
