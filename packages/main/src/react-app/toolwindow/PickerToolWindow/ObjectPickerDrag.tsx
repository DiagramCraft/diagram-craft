import { AbstractMoveDrag } from '@diagram-craft/canvas/drag/moveDrag';
import { DiagramElement, isEdge, isNode } from '@diagram-craft/model/diagramElement';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Diagram } from '@diagram-craft/model/diagram';
import { Context } from '@diagram-craft/canvas/context';
import { Point } from '@diagram-craft/geometry/point';
import { DRAG_DROP_MANAGER, DragEvents } from '@diagram-craft/canvas/dragDropManager';
import { getAncestorWithClass, setPosition } from '@diagram-craft/utils/dom';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayer';
import { ElementAddUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { deserializeDiagramElements } from '@diagram-craft/model/serialization/deserialize';
import { serializeDiagramElement } from '@diagram-craft/model/serialization/serialize';
import { assignNewBounds, assignNewIds } from '@diagram-craft/model/helpers/cloneHelper';
import { Box } from '@diagram-craft/geometry/box';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { DefaultStyles } from '@diagram-craft/model/diagramDefaults';
import { deepClone } from '@diagram-craft/utils/object';
import { clamp } from '@diagram-craft/utils/math';
import { CanvasComponent } from '@diagram-craft/canvas/CanvasComponent';
import { insert } from '@diagram-craft/canvas/component/vdom';
import { registerStencilUse } from '@diagram-craft/canvas-app/recentStencils';

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
    readonly source: DiagramNode,
    readonly diagram: Diagram,
    readonly stencilId: string | undefined,
    context: Context
  ) {
    super(diagram, Point.ORIGIN, event, context);
    this.isGlobal = true;

    this.#originalSelectionState = diagram.selectionState.elements;

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
  }

  onDragEnd() {
    document.body.classList.remove('no-select');

    this.context.help.pop('AddDrag');
    this.removeDragImage();

    const activeLayer = this.diagram.activeLayer;
    assertRegularLayer(activeLayer);

    this.diagram.undoManager.combine(() => {
      if (this.#state === State.INSIDE) {
        this.diagram.undoManager.addAndExecute(
          new ElementAddUndoableAction(this.#elements, this.diagram, activeLayer)
        );
      }

      super.onDragEnd();
    });

    if (this.stencilId) {
      registerStencilUse(this.stencilId, this.diagram.document);
    }
  }

  onDragEnter(event: DragEvents.DragEnter) {
    const svgElement = getAncestorWithClass(event.target as HTMLElement, 'editable-canvas');
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
      this.diagram.selectionState.clear();
      this.diagram.selectionState.setElements(this.#originalSelectionState);
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
      this.diagram.selectionState.clear();
      this.addDragImage(point);
    }
  }

  private isCanvasEvent(element: EventTarget): boolean {
    return this.#state === State.INSIDE && (element as HTMLElement).tagName === 'svg';
  }

  private addDragImage(point: Point) {
    if (this.#dragImage) return;

    const scale = clamp(this.diagram.viewBox.zoomLevel, 0.3, 3);

    const { diagram: dest } = Diagram.createForNode(
      () => this.source.duplicate(),
      this.diagram.document.definitions
    );

    const canvas = new CanvasComponent();
    const $canvasVdomNode = canvas.render({
      diagram: dest,
      width: (this.source.bounds.w / scale).toString(),
      height: (this.source.bounds.h / scale).toString()
    });
    insert($canvasVdomNode);

    const $canvasEl = $canvasVdomNode.el!;
    $canvasEl.style.background = 'transparent';
    $canvasEl.setAttribute(
      'viewBox',
      `-2 -2 ${this.source.bounds.w + 4} ${this.source.bounds.h + 4}`
    );

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
    const sourceLayer = this.source.diagram.activeLayer;
    assertRegularLayer(sourceLayer);

    const activeLayer = this.diagram.activeLayer;
    assertRegularLayer(activeLayer);

    const sourceEls = sourceLayer.elements.map(e => deepClone(serializeDiagramElement(e)));
    this.#elements = deserializeDiagramElements(sourceEls, this.diagram, activeLayer, {}, {});

    assignNewIds(this.#elements);

    const bounds = Box.boundingBox(this.#elements.map(e => e.bounds));

    const scaleX = this.source.bounds.w / bounds.w;
    const scaleY = this.source.bounds.h / bounds.h;
    assignNewBounds(
      this.#elements,
      point,
      Point.of(scaleX, scaleY),
      UnitOfWork.immediate(this.diagram)
    );

    const uow = UnitOfWork.immediate(this.diagram);
    this.#elements.forEach(e => {
      if (isNode(e)) {
        e.updateMetadata(meta => {
          if (meta.style === DefaultStyles.node.default) {
            meta.style = this.diagram.document.styles.activeNodeStylesheet.id;
          }
          if (meta.textStyle === DefaultStyles.text.default) {
            meta.textStyle = this.diagram.document.styles.activeTextStylesheet.id;
          }
        }, uow);
      } else if (isEdge(e)) {
        e.updateMetadata(
          meta => (meta.style = this.diagram.document.styles.activeEdgeStylesheet.id),
          uow
        );
      }
    });

    new ElementAddUndoableAction(this.#elements, this.diagram, activeLayer).redo();

    this.diagram.selectionState.clear();
    this.diagram.selectionState.setElements(this.#elements);
  }

  private removeElement() {
    const activeLayer = this.diagram.activeLayer;
    assertRegularLayer(activeLayer);
    UnitOfWork.execute(this.diagram, uow => {
      this.#elements.map(e => activeLayer.removeElement(e!, uow));
    });
  }
}
