import { AbstractDrag, Modifiers } from './dragDropManager.ts';
import { Point } from '../../geometry/point.ts';
import { Box } from '../../geometry/box.ts';
import { Direction } from '../../geometry/direction.ts';
import { Translation } from '../../geometry/transform.ts';
import { Vector } from '../../geometry/vector.ts';
import { Angle } from '../../geometry/angle.ts';
import { createResizeCanvasActionToFit } from '../../model/helpers/canvasResizeHelper.ts';
import { MoveAction, ElementAddUndoableAction } from '../../model/diagramUndoActions.ts';
import { Axis } from '../../geometry/axis.ts';
import { Diagram, excludeLabelNodes, includeAll } from '../../model/diagram.ts';
import { DiagramElement } from '../../model/diagramElement.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { DiagramEdge } from '../../model/diagramEdge.ts';
import { largest } from '../../utils/array.ts';

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

  onKeyDown(event: KeyboardEvent) {
    this.#keys.push(event.key);
    this.updateState(this.diagram.selectionState.bounds.pos);
  }

  onDrag(coord: Point, modifiers: Modifiers): void {
    const selection = this.diagram.selectionState;

    // Don't move connected edges
    if (
      selection.isEdgesOnly() &&
      selection.edges.every(e => e.isStartConnected() || e.isEndConnected())
    ) {
      return;
    }

    // Disable pointer events on the first onDrag event
    if (!this.#dragStarted) {
      this.#dragStarted = true;
      this.disablePointerEvents(selection.elements);
    }

    const hover = this.getHoverElement(coord);
    if (hover !== this.#currentElement) {
      this.clearHighlight();
      this.#currentElement = hover;
      this.setHighlight();
    }

    // Determine the delta between the current mouse position and the original mouse position
    const delta = Point.subtract(coord, Point.add(selection.bounds.pos, this.offset));

    const newBounds = Box.asMutableSnapshot(selection.bounds);

    const newPos = Point.add(selection.bounds.pos, delta);
    this.updateState(newPos);
    newBounds.set('pos', newPos);

    let snapDirections = Direction.all();

    const isDuplicateDrag = modifiers.metaKey;
    const isConstraintDrag = modifiers.shiftKey;
    const isFreeDrag = modifiers.altKey;

    // TODO: Ideally we would want to trigger some of this based on button press instead of mouse move
    if (isDuplicateDrag && !this.#hasDuplicatedSelection) {
      // Reset current selection back to original
      const uow = new UnitOfWork(this.diagram);
      this.diagram.transformElements(
        selection.nodes,
        [new Translation(Point.subtract(selection.source.boundingBox.pos, selection.bounds.pos))],
        uow,
        'interactive',
        selection.getSelectionType() === 'single-label-node' ? includeAll : excludeLabelNodes
      );
      uow.commit();

      newBounds.set('pos', selection.source.boundingBox.pos);
      selection.guides = [];

      this.enablePointerEvents(selection.elements);

      const newElements = selection.source.elementIds.map(e => this.diagram.lookup(e)!.duplicate());
      newElements.forEach(e => {
        this.diagram.layers.active.addElement(e);
      });
      selection.setElements(newElements, false);

      this.#hasDuplicatedSelection = true;
    } else if (!isDuplicateDrag && this.#hasDuplicatedSelection) {
      this.#hasDuplicatedSelection = false;

      const elementsToRemove = selection.elements;

      selection.setElements(selection.source.elementIds.map(e => this.diagram.lookup(e)!));
      selection.guides = [];

      elementsToRemove.forEach(e => {
        e.layer!.removeElement(e);
      });
    }

    // TODO: Perhaps support 45 degree angles
    if (isConstraintDrag) {
      const source = Point.add(selection.source.boundingBox.pos, this.offset);

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

      newBounds.set(
        'pos',
        Point.add(selection.source.boundingBox.pos, Vector.fromPolar(snapAngle, length))
      );
    }

    if (isFreeDrag) {
      selection.guides = [];
    } else {
      const snapManager = this.diagram.createSnapManager();

      const result = snapManager.snapMove(newBounds.getSnapshot(), snapDirections);
      selection.guides = result.guides;

      newBounds.set('pos', result.adjusted.pos);
    }

    const uow = new UnitOfWork(this.diagram);
    this.diagram.transformElements(
      selection.elements,
      [new Translation(Point.subtract(newBounds.get('pos'), selection.bounds.pos))],
      uow,
      'interactive',
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

      if (this.#currentElement) {
        selection.guides = [];

        const el = this.#currentElement;
        // TODO: Handle the same for edges
        if (el.type === 'node') {
          this.clearHighlight();
          UnitOfWork.execute(this.diagram, uow =>
            el
              .getNodeDefinition()
              .onDrop(
                Point.add(selection.bounds.pos, this.offset),
                el,
                selection.elements,
                uow,
                'non-interactive',
                'default'
              )
          );
        } else {
          this.clearHighlight();
          UnitOfWork.execute(this.diagram, uow =>
            el.onDrop(
              Point.add(selection.bounds.pos, this.offset),
              selection.elements,
              uow,
              'non-interactive',
              this.getLastState(2) === 1 ? 'split' : 'attach'
            )
          );
        }
      } else if (this.diagram.selectionState.elements.some(e => !!e.parent)) {
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
      UnitOfWork.execute(this.diagram, uow =>
        this.diagram.transformElements(selection.elements, [], uow, 'non-interactive')
      );

      selection.rebaseline();
    }

    this.#hasDuplicatedSelection = false;
  }

  private getHoverElement(coord: Point): DiagramElement | undefined {
    if (this.diagram.selectionState.getSelectionType() === 'single-label-node') return;
    const hover = this.diagram.layers.active
      .findElementsByPoint(coord)
      .filter(e => !this.diagram.selectionState.elements.includes(e));
    if (hover.length === 0) {
      return undefined;
    } else {
      // Find the deepest element we are currently hovering above
      let best: DiagramElement | undefined = hover[0];
      while (best.type === 'node' && best.children.length > 0) {
        const bestEl: DiagramNode = best;
        const bestChildren = hover.find(e => bestEl.children.includes(e));
        if (bestChildren) {
          best = bestChildren;
        } else {
          break;
        }
      }

      // Need to filter any edges that are connected to the current selection
      if (
        best.type === 'edge' &&
        this.diagram.selectionState.elements.some(
          e => e.type === 'node' && e.listEdges().includes(best as DiagramEdge)
        )
      ) {
        best = undefined;
      }

      return best;
    }
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
      if (e.type === 'node') {
        const n = document.getElementById(`node-${e.id}`)!;
        n.style.pointerEvents = this.#oldPEvents[n.id];
        this.enablePointerEvents(e.children);
      } else if (e.type === 'edge') {
        const n = document.getElementById(`edge-${e.id}`)!;
        n.style.pointerEvents = this.#oldPEvents[n.id];
      }
    }
  }

  private disablePointerEvents(elements: ReadonlyArray<DiagramElement>) {
    for (const e of elements) {
      if (e.type === 'node') {
        const n = document.getElementById(`node-${e.id}`)!;
        this.#oldPEvents[n.id] = n.style.pointerEvents;
        n.style.pointerEvents = 'none';
        this.enablePointerEvents(e.children);
      } else if (e.type === 'edge') {
        const n = document.getElementById(`edge-${e.id}`)!;
        this.#oldPEvents[n.id] = n.style.pointerEvents;
        n.style.pointerEvents = 'none';
      }
    }
  }
}
