import { Drag, DragEvents, Modifiers } from '../dragDropManager';
import { addHighlight, Highlights, removeHighlight } from '../highlight';
import { Axis } from '@diagram-craft/geometry/axis';
import { Point } from '@diagram-craft/geometry/point';
import { Box, WritableBox } from '@diagram-craft/geometry/box';
import { Direction } from '@diagram-craft/geometry/direction';
import { Translation } from '@diagram-craft/geometry/transform';
import { Vector } from '@diagram-craft/geometry/vector';
import { Angle } from '@diagram-craft/geometry/angle';
import {
  DiagramElement,
  isEdge,
  isNode,
  transformElements
} from '@diagram-craft/model/diagramElement';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Diagram } from '@diagram-craft/model/diagram';
import { excludeLabelNodes, includeAll, Selection } from '@diagram-craft/model/selection';
import { precondition, VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { largest } from '@diagram-craft/utils/array';
import { Context } from '../context';
import {
  assertRegularLayer,
  assertRegularOrModificationLayer
} from '@diagram-craft/model/diagramLayerUtils';
import { LayerCapabilities } from '@diagram-craft/model/diagramLayerManager';
import { CanvasDomHelper } from '../utils/canvasDomHelper';
import { SnapManager, SnapMarkers } from '../snap/snapManager';

const enablePointerEvents = (elements: ReadonlyArray<DiagramElement>) => {
  for (const e of elements) {
    const $el = CanvasDomHelper.elementElement(e)!;
    if (!$el) continue;
    $el.style.pointerEvents = '';
    if (isNode(e)) enablePointerEvents(e.children);
  }
};

const disablePointerEvents = (elements: ReadonlyArray<DiagramElement>) => {
  for (const e of elements) {
    const $el = CanvasDomHelper.elementElement(e)!;
    if (!$el) continue;
    $el.style.pointerEvents = 'none';
    if (isNode(e)) disablePointerEvents(e.children);
  }
};

// TODO: We can/should make this configurable by platform
const isConstraintDrag = (m: Modifiers) => m.shiftKey;
const isFreeDrag = (m: Modifiers) => m.altKey;
const isDuplicateDrag = (e: KeyboardEvent | Modifiers) =>
  ('metaKey' in e && e.metaKey) || ('key' in e && e.key === 'Meta');

export abstract class AbstractMoveDrag extends Drag {
  #snapAngle?: Axis;
  #currentElement: DiagramElement | undefined = undefined;
  #keys: string[] = [];

  protected dragStarted = false;
  protected readonly uow: UnitOfWork;

  protected constructor(
    protected readonly diagram: Diagram,
    protected readonly offset: Point,
    protected modifiers: Modifiers,
    protected context: Context
  ) {
    super();

    precondition.is.true(LayerCapabilities.canMove(this.diagram.activeLayer));
    this.uow = UnitOfWork.begin(this.diagram);
  }

  onDragEnter({ id }: DragEvents.DragEnter) {
    if (!id) return;

    const selection = this.diagram.selection;
    if (selection.type !== 'single-node') return;

    const hover = this.diagram.lookup(id);

    this.clearHighlight();

    // Need to filter any edges that are connected to the current selection
    if (isEdge(hover) && selection.elements.some(e => isNode(e) && e.edges.includes(hover))) {
      this.#currentElement = undefined;
      return;
    }

    if (hover !== this.#currentElement) {
      this.#currentElement = hover;
      this.setHighlight();
    }
  }

  onDragLeave(_event: DragEvents.DragLeave) {
    this.clearHighlight();
    this.#currentElement = undefined;
  }

  onKeyDown(event: KeyboardEvent) {
    this.#keys.push(event.key);
    this.updateState(this.diagram.selection.bounds);
  }

  onDrag({ offset, modifiers }: DragEvents.DragStart): void {
    const selection = this.diagram.selection;
    selection.setDragging(true);

    // Don't move connected edges
    if (selection.isEdgesOnly() && selection.edges.every(e => e.isConnected())) {
      return;
    }

    // Disable pointer events on the first onDrag event
    if (!this.dragStarted) {
      this.dragStarted = true;
      disablePointerEvents(selection.elements);
    }

    // Determine the delta between the current mouse position and the original mouse position
    const delta = Point.subtract(offset, Point.add(selection.bounds, this.offset));
    const newPos = Point.add(selection.bounds, delta);

    const newBounds = Box.asReadWrite(selection.bounds);
    newBounds.x = newPos.x;
    newBounds.y = newPos.y;

    let snapDirections = Direction.all();

    if (isConstraintDrag(modifiers)) {
      const res = this.constrainDrag(selection, offset);
      snapDirections = res.availableSnapDirections;
      newBounds.x = res.adjustedPosition.x;
      newBounds.y = res.adjustedPosition.y;
    }

    if (isFreeDrag(modifiers)) {
      SnapMarkers.get(this.diagram).clear();
    } else {
      const snapManager = SnapManager.create(this.diagram);

      const result = snapManager.snapMove(WritableBox.asBox(newBounds), snapDirections);
      SnapMarkers.get(this.diagram).set(result.markers);

      newBounds.x = result.adjusted.x;
      newBounds.y = result.adjusted.y;
    }

    // This is to update the tooltip
    this.updateState(newBounds);

    if (!Point.isEqual(Point.ORIGIN, Point.subtract(newBounds, selection.bounds))) {
      transformElements(
        selection.filter(
          'all',
          selection.type === 'single-label-node' ? includeAll : excludeLabelNodes
        ),
        [new Translation(Point.subtract(newBounds, selection.bounds))],
        this.uow
      );

      // This is mainly a performance optimization and not strictly necessary
      this.diagram.selection.recalculateBoundingBox();

      this.uow.notify();
    }

    this.emit('drag', { coord: offset, modifiers });
  }

  onDragEnd(): void {
    const activeLayer = this.diagram.activeLayer;
    assertRegularOrModificationLayer(activeLayer);

    const selection = this.diagram.selection;
    selection.setDragging(false);
    SnapMarkers.get(this.diagram).clear();

    this.clearHighlight();
    enablePointerEvents(selection.elements);

    if (selection.isChanged()) {
      const selectionBounds = Box.boundingBox(
        selection.nodes.map(e => e.bounds),
        true
      );
      const diagramBounds = { ...this.diagram.bounds, r: 0 };
      if (!Box.contains(diagramBounds, selectionBounds)) {
        this.diagram.setBounds(
          Box.boundingBox([diagramBounds, Box.grow(selectionBounds, 20)], true),
          this.uow
        );
      }

      // This means we are dropping onto an element
      if (this.#currentElement) {
        const p = Point.add(selection.bounds, this.offset);
        const el = this.#currentElement;
        if (isNode(el)) {
          el.getDefinition().onDrop(p, el, selection.elements, this.uow, 'default');
        } else if (isEdge(el)) {
          const operation = this.getLastState(2) === 1 ? 'split' : 'attach';
          el.getDefinition().onDrop(p, el, selection.elements, this.uow, operation);
        } else {
          VERIFY_NOT_REACHED();
        }

        // TODO: Change to use capabilities - or perhaps onDragOut
        // Move elements out of a container
      } else if (
        selection.elements.every(
          e =>
            isNode(e.parent) &&
            (e.parent?.nodeType === 'container' || e.parent?.nodeType === 'swimlane')
        )
      ) {
        this.diagram.moveElement(
          selection.elements,
          this.uow,
          activeLayer,
          activeLayer.elements.length > 0
            ? {
                relation: 'above',
                element: activeLayer.elements.at(-1)!
              }
            : undefined
        );
      }

      this.uow.commitWithUndo('Move');
    } else {
      this.uow.commit();
    }
    selection.rebaseline();
  }

  private constrainDrag(selection: Selection, coord: Point) {
    let snapDirections = Direction.all();
    const source = Point.add(selection.source.boundingBox, this.offset);

    const v = Vector.from(source, coord);
    const length = Vector.length(v);
    const angle = Vector.angle(v);

    let snapAngle = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);

    if (this.#snapAngle === 'h') {
      snapAngle = Math.round(angle / Math.PI) * Math.PI;
    } else if (this.#snapAngle === 'v') {
      snapAngle = Math.round((angle + Math.PI / 2) / Math.PI) * Math.PI - Math.PI / 2;
      snapDirections = ['n', 's'];
    } else if (length > 20) {
      this.#snapAngle = Angle.isHorizontal(snapAngle) ? 'h' : 'v';
      snapDirections = ['e', 'w'];
    }

    return {
      availableSnapDirections: snapDirections,
      adjustedPosition: Point.add(selection.source.boundingBox, Vector.fromPolar(snapAngle, length))
    };
  }

  private clearHighlight() {
    if (!this.#currentElement) return;
    removeHighlight(this.#currentElement, Highlights.NODE__DROP_TARGET);
  }

  private setHighlight() {
    if (!this.#currentElement) return;
    addHighlight(this.#currentElement, Highlights.NODE__DROP_TARGET);
  }

  private getLastState(max: number) {
    const last: [number, number][] = [];
    for (let i = 1; i <= max; i++) {
      last[i] = [i, this.#keys.lastIndexOf(i.toString())];
    }
    return largest(last.slice(1).toReversed(), (a, b) => a[1] - b[1])![0];
  }

  private updateState(newPos: { x: number; y: number }) {
    const lastState = this.getLastState(2);
    this.setState({
      label: `x: ${newPos.x.toFixed(0)}, y: ${newPos.y.toFixed(0)}`,
      modifiers:
        this.#currentElement?.type === 'edge'
          ? [
              { key: '1', label: 'Split', isActive: lastState === 1 },
              { key: '2', label: 'Attach as label', isActive: lastState === 2 }
            ]
          : []
    });
  }
}

export class MoveDrag extends AbstractMoveDrag {
  #hasDuplicatedSelection?: boolean = false;

  constructor(diagram: Diagram, offset: Point, modifiers: Modifiers, context: Context) {
    super(diagram, offset, modifiers, context);

    this.context.help.push(
      'MoveDrag',
      'Move elements. Shift+Click - add, Shift - constrain, Option - free, Cmd - duplicate'
    );

    if (isDuplicateDrag(modifiers)) {
      this.duplicate();
    }
  }

  onKeyUp(event: KeyboardEvent) {
    super.onKeyUp(event);

    if (isDuplicateDrag(event)) {
      this.removeDuplicate();
    }
  }

  onKeyDown(event: KeyboardEvent) {
    super.onKeyDown(event);

    if (isDuplicateDrag(event)) {
      this.duplicate();
    }
  }

  onDragEnd() {
    super.onDragEnd();
    this.#hasDuplicatedSelection = false;
    this.context.help.pop('MoveDrag');
  }

  cancel() {
    this.uow.abort();
  }

  private duplicate() {
    const activeLayer = this.diagram.activeLayer;
    assertRegularLayer(activeLayer);
    if (this.#hasDuplicatedSelection) return;

    this.#hasDuplicatedSelection = true;

    const selection = this.diagram.selection;

    // Clone the current selection to keep in its original position
    const newElements = selection.source.elementIds.map(e => this.diagram.lookup(e)!.duplicate());
    newElements.forEach(e => {
      activeLayer.addElement(e, this.uow);
    });

    // Reset current selection back to original
    transformElements(
      selection.filter(
        'nodes',
        selection.type === 'single-label-node' ? includeAll : excludeLabelNodes
      ),
      [new Translation(Point.subtract(selection.source.boundingBox, selection.bounds))],
      this.uow
    );

    enablePointerEvents(selection.elements);

    SnapMarkers.get(this.diagram).clear();
    selection.setElements(newElements, false);

    this.uow.notify();

    // To ensure that pointer events are disabled at the next drag event
    this.dragStarted = false;
  }

  private removeDuplicate() {
    if (!this.#hasDuplicatedSelection) return;

    this.#hasDuplicatedSelection = false;

    const selection = this.diagram.selection;

    const elementsToRemove = selection.elements;
    const posititions = elementsToRemove.map(e => e.bounds);

    selection.setElements(selection.source.elementIds.map(e => this.diagram.lookup(e)!));
    SnapMarkers.get(this.diagram).clear();

    elementsToRemove.forEach(e => {
      e.layer.removeElement(e, this.uow);
    });

    // Reset the original selection back to the position of the now
    // removed duplicates
    selection.elements.forEach((e, idx) => {
      e.setBounds(posititions[idx]!, this.uow);
    });

    this.uow.notify();
  }
}
