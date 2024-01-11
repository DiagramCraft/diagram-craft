import { AbstractDrag, Modifiers } from './dragDropManager.ts';
import { Point } from '../../geometry/point.ts';
import { Box, WritableBox } from '../../geometry/box.ts';
import { Direction } from '../../geometry/direction.ts';
import { Translation } from '../../geometry/transform.ts';
import { Vector } from '../../geometry/vector.ts';
import { Angle } from '../../geometry/angle.ts';
import { createResizeCanvasActionToFit } from '../../model/helpers/canvasResizeHelper.ts';
import { ElementAddUndoableAction, MoveAction } from '../../model/diagramUndoActions.ts';
import { Axis } from '../../geometry/axis.ts';
import { Diagram, excludeLabelNodes, includeAll } from '../../model/diagram.ts';
import { DiagramElement, isEdge, isNode } from '../../model/diagramElement.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { largest } from '../../utils/array.ts';
import { isConnected } from '../../model/diagramEdge.ts';
import { VERIFY_NOT_REACHED } from '../../utils/assert.ts';

export class MoveDrag extends AbstractDrag {
  #snapAngle?: Axis;
  #hasDuplicatedSelection?: boolean = false;
  #oldPEvents: Record<string, string> = {};
  #dragStarted = false;
  #currentElement: DiagramElement | undefined = undefined;
  #keys: string[] = [];

  constructor(
    private readonly diagram: Diagram,
    private readonly offset: Point
  ) {
    super();
  }

  onDragEnter(id: string) {
    const selection = this.diagram.selectionState;
    if (selection.getSelectionType() !== 'single-node') return;

    const hover = this.diagram.lookup(id);

    // Need to filter any edges that are connected to the current selection
    if (isEdge(hover) && selection.elements.some(e => isNode(e) && e.listEdges().includes(hover))) {
      this.clearHighlight();
      this.#currentElement = undefined;
      return;
    }

    if (hover !== this.#currentElement) {
      this.clearHighlight();
      this.#currentElement = hover;
      this.setHighlight();
    }
  }

  onDragLeave() {
    this.clearHighlight();
    this.#currentElement = undefined;
  }

  onKeyDown(event: KeyboardEvent) {
    this.#keys.push(event.key);
    this.updateState(this.diagram.selectionState.bounds);
  }

  onDrag(coord: Point, modifiers: Modifiers): void {
    const selection = this.diagram.selectionState;

    // Don't move connected edges
    if (
      selection.isEdgesOnly() &&
      selection.edges.every(e => isConnected(e.start) || isConnected(e.end))
    ) {
      return;
    }

    // Disable pointer events on the first onDrag event
    if (!this.#dragStarted) {
      this.#dragStarted = true;
      this.disablePointerEvents(selection.elements);
    }

    // Determine the delta between the current mouse position and the original mouse position
    const delta = Point.subtract(coord, Point.add(selection.bounds, this.offset));

    const newBounds = Box.asReadWrite(selection.bounds);

    const newPos = Point.add(selection.bounds, delta);
    this.updateState(newPos);
    newBounds.x = newPos.x;
    newBounds.y = newPos.y;

    let snapDirections = Direction.all();

    const isDuplicateDrag = modifiers.metaKey;
    const isConstraintDrag = modifiers.shiftKey;
    const isFreeDrag = modifiers.altKey;

    // TODO: Ideally we would want to trigger some of this based on button press instead of mouse move
    if (isDuplicateDrag && !this.#hasDuplicatedSelection) {
      // Reset current selection back to original
      const uow = new UnitOfWork(this.diagram, 'interactive');
      this.diagram.transformElements(
        selection.nodes,
        [new Translation(Point.subtract(selection.source.boundingBox, selection.bounds))],
        uow,
        selection.getSelectionType() === 'single-label-node' ? includeAll : excludeLabelNodes
      );

      newBounds.x = selection.source.boundingBox.x;
      newBounds.y = selection.source.boundingBox.y;
      selection.guides = [];

      this.enablePointerEvents(selection.elements);

      const newElements = selection.source.elementIds.map(e => this.diagram.lookup(e)!.duplicate());
      newElements.forEach(e => {
        this.diagram.layers.active.addElement(e, uow);
      });
      selection.setElements(newElements, false);

      uow.commit();

      this.#hasDuplicatedSelection = true;
    } else if (!isDuplicateDrag && this.#hasDuplicatedSelection) {
      this.#hasDuplicatedSelection = false;

      const elementsToRemove = selection.elements;

      selection.setElements(selection.source.elementIds.map(e => this.diagram.lookup(e)!));
      selection.guides = [];

      UnitOfWork.execute(this.diagram, uow => {
        elementsToRemove.forEach(e => {
          e.layer!.removeElement(e, uow);
        });
      });
    }

    // TODO: Perhaps support 45 degree angles
    if (isConstraintDrag) {
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

      const newPos = Point.add(selection.source.boundingBox, Vector.fromPolar(snapAngle, length));
      newBounds.x = newPos.x;
      newBounds.y = newPos.y;
    }

    if (isFreeDrag) {
      selection.guides = [];
    } else {
      const snapManager = this.diagram.createSnapManager();

      const result = snapManager.snapMove(WritableBox.asBox(newBounds), snapDirections);
      selection.guides = result.guides;

      newBounds.x = result.adjusted.x;
      newBounds.y = result.adjusted.y;
    }

    const uow = new UnitOfWork(this.diagram, 'interactive');
    this.diagram.transformElements(
      selection.elements,
      [new Translation(Point.subtract(newBounds, selection.bounds))],
      uow,
      selection.getSelectionType() === 'single-label-node' ? includeAll : excludeLabelNodes
    );
    uow.commit();

    // This is mainly a performance optimization and not strictly necessary
    this.diagram.selectionState.recalculateBoundingBox();
  }

  onDragEnd(): void {
    const selection = this.diagram.selectionState;

    this.enablePointerEvents(selection.elements);

    if (selection.isChanged()) {
      // TODO: Definitely need a compound undoable action here
      const resizeCanvasAction = createResizeCanvasActionToFit(
        this.diagram,
        Box.boundingBox(
          selection.nodes.map(e => e.bounds),
          true
        )
      );
      if (resizeCanvasAction) {
        this.diagram.undoManager.addAndExecute(resizeCanvasAction);
      }

      if (this.#hasDuplicatedSelection) {
        this.diagram.undoManager.add(new ElementAddUndoableAction(selection.nodes, this.diagram));
      } else {
        this.diagram.undoManager.add(
          new MoveAction(
            selection.source.elementBoxes,
            selection.elements.map(e => e.bounds),
            selection.elements,
            this.diagram,
            'Move'
          )
        );
      }

      const uow = new UnitOfWork(this.diagram);
      if (this.#currentElement) {
        selection.guides = [];

        const el = this.#currentElement;
        // TODO: Handle the same for edges
        if (isNode(el)) {
          this.clearHighlight();
          el.getNodeDefinition().onDrop(
            Point.add(selection.bounds, this.offset),
            el,
            selection.elements,
            uow,
            'default'
          );
        } else if (isEdge(el)) {
          this.clearHighlight();
          el.getEdgeDefinition().onDrop(
            Point.add(selection.bounds, this.offset),
            el,
            selection.elements,
            uow,
            this.getLastState(2) === 1 ? 'split' : 'attach'
          );
        } else {
          VERIFY_NOT_REACHED();
        }
      } else if (
        this.diagram.selectionState.elements.some(e => !!e.parent) &&
        !this.diagram.selectionState.elements.some(e => e.parent?.nodeType === 'group')
      ) {
        const activeLayer = this.diagram.layers.active;
        this.diagram.moveElement(
          selection.elements,
          activeLayer,
          activeLayer.elements.length > 0
            ? {
                relation: 'above',
                element: this.diagram.layers.active.elements.at(-1)!
              }
            : undefined
        );
      }

      // This is needed to force a final transformation to be applied
      this.diagram.transformElements(selection.elements, [], uow);
      uow.commit();

      selection.rebaseline();
    }

    this.#hasDuplicatedSelection = false;
  }

  private clearHighlight() {
    if (!this.#currentElement) return;
    this.#currentElement.props.highlight = this.#currentElement.props.highlight?.filter(
      h => h !== 'drop-target'
    );
    UnitOfWork.updateElement(this.#currentElement);
  }

  private setHighlight() {
    if (!this.#currentElement) return;
    this.#currentElement.props.highlight ??= [];
    this.#currentElement.props.highlight.push('drop-target');
    UnitOfWork.updateElement(this.#currentElement);
  }

  private getLastState(max: number) {
    const last: [number, number][] = [];
    for (let i = 1; i <= max; i++) {
      last[i] = [i, this.#keys.lastIndexOf(i.toString())];
    }
    return largest(last.slice(1).toReversed(), (a, b) => a[1] - b[1])[0];
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

  private enablePointerEvents(elements: ReadonlyArray<DiagramElement>) {
    for (const e of elements) {
      if (isNode(e)) {
        const n = document.getElementById(`node-${e.id}`)!;
        n.style.pointerEvents = this.#oldPEvents[n.id];
        this.enablePointerEvents(e.children);
      } else if (isEdge(e)) {
        const n = document.getElementById(`edge-${e.id}`)!;
        n.style.pointerEvents = this.#oldPEvents[n.id];
      }
    }
  }

  private disablePointerEvents(elements: ReadonlyArray<DiagramElement>) {
    for (const e of elements) {
      if (isNode(e)) {
        const n = document.getElementById(`node-${e.id}`)!;
        this.#oldPEvents[n.id] = n.style.pointerEvents;
        n.style.pointerEvents = 'none';
        this.enablePointerEvents(e.children);
      } else if (isEdge(e)) {
        const n = document.getElementById(`edge-${e.id}`)!;
        this.#oldPEvents[n.id] = n.style.pointerEvents;
        n.style.pointerEvents = 'none';
      }
    }
  }
}
