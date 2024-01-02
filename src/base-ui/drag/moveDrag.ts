import { AbstractDrag, Modifiers } from './dragDropManager.ts';
import { Point } from '../../geometry/point.ts';
import { assert } from '../../utils/assert.ts';
import { Box } from '../../geometry/box.ts';
import { Direction } from '../../geometry/direction.ts';
import { Translation } from '../../geometry/transform.ts';
import { Vector } from '../../geometry/vector.ts';
import { Angle } from '../../geometry/angle.ts';
import { createResizeCanvasActionToFit } from '../../model/helpers/canvasResizeHelper.ts';
import { MoveAction, NodeAddUndoableAction } from '../../model/diagramUndoActions.ts';
import { Axis } from '../../geometry/axis.ts';
import { Diagram, excludeLabelNodes, includeAll } from '../../model/diagram.ts';
import { DiagramElement } from '../../model/diagramElement.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';
import { DiagramNode } from '../../model/diagramNode.ts';
import { DiagramEdge } from '../../model/diagramEdge.ts';

export class MoveDrag extends AbstractDrag {
  snapAngle?: Axis;
  isDuplicateDrag?: boolean = false;

  oldPointerEventsValues: Record<string, string> = {};

  #dragStarted = false;

  #currentElement: string | undefined = undefined;

  constructor(
    private readonly diagram: Diagram,
    private readonly offset: Point
  ) {
    super();
    const selection = this.diagram.selectionState;
    assert.false(selection.isEmpty());
  }

  private clearHighlight() {
    if (!this.#currentElement) return;
    const el = this.diagram.lookup(this.#currentElement);
    if (!el) return;
    el.props.highlight = el.props.highlight?.filter(h => h !== 'drop-target');
    UnitOfWork.updateElement(el);
  }

  private setHighlight() {
    if (!this.#currentElement) return;
    const el = this.diagram.lookup(this.#currentElement);
    if (!el) return;
    el.props.highlight ??= [];
    el.props.highlight.push('drop-target');
    UnitOfWork.updateElement(el);
  }

  onDrag(coord: Point, modifiers: Modifiers): void {
    const selection = this.diagram.selectionState;

    if (!this.#dragStarted) {
      this.#dragStarted = true;
      this.disablePointerEvents(selection.elements);
    }

    // Don't move connected edges
    if (
      selection.nodes.length === 0 &&
      selection.edges.every(e => e.isStartConnected() || e.isEndConnected())
    ) {
      return;
    }

    const hover = this.diagram.layers.active
      .findElementsByPoint(coord)
      .filter(e => !this.diagram.selectionState.elements.includes(e));
    if (hover.length === 0) {
      this.clearHighlight();
      this.#currentElement = undefined;
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

      this.clearHighlight();
      this.#currentElement = best?.id;
      this.setHighlight();
    }

    const d = Point.subtract(coord, Point.add(selection.bounds.pos, this.offset));

    const newBounds = Box.asMutableSnapshot(selection.bounds);

    const newPos = Point.add(selection.bounds.pos, d);
    this.setState({
      label: `x: ${newPos.x.toFixed(0)}, y: ${newPos.y.toFixed(0)}`
    });
    newBounds.set('pos', newPos);

    let snapDirections = Direction.all();

    // TODO: Ideally we would want to trigger some of this based on button press instead of mouse move
    if (modifiers.metaKey && !this.isDuplicateDrag) {
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

      this.isDuplicateDrag = true;
    } else if (!modifiers.metaKey && this.isDuplicateDrag) {
      this.isDuplicateDrag = false;

      const elementsToRemove = selection.elements;

      selection.setElements(selection.source.elementIds.map(e => this.diagram.lookup(e)!));
      selection.guides = [];

      elementsToRemove.forEach(e => {
        e.layer!.removeElement(e);
      });
    }

    // TODO: Perhaps support 45 degree angles
    if (modifiers.shiftKey) {
      const source = Point.add(selection.source.boundingBox.pos, this.offset);

      const v = Vector.from(source, coord);
      const length = Vector.length(v);
      const angle = Vector.angle(v);

      let snapAngle = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);

      if (this.snapAngle === 'h') {
        snapAngle = Math.round(angle / Math.PI) * Math.PI;
      } else if (this.snapAngle === 'v') {
        snapAngle = Math.round((angle + Math.PI / 2) / Math.PI) * Math.PI - Math.PI / 2;
        snapDirections = ['n', 's'];
      } else if (length > 20) {
        this.snapAngle = Angle.isHorizontal(snapAngle) ? 'h' : 'v';
        snapDirections = ['e', 'w'];
      }

      newBounds.set(
        'pos',
        Point.add(selection.source.boundingBox.pos, Vector.fromPolar(snapAngle, length))
      );
    }

    if (modifiers.altKey) {
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

      if (this.isDuplicateDrag) {
        this.diagram.undoManager.add(new NodeAddUndoableAction(selection.nodes, this.diagram));
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
        const el = this.diagram.lookup(this.#currentElement);
        if (el) {
          // TODO: Handle the same for edges
          if (el.type === 'node') {
            this.clearHighlight();
            el.getNodeDefinition().onDrop(
              el,
              selection.elements,
              new UnitOfWork(this.diagram),
              'non-interactive'
            );
          } else {
            this.clearHighlight();
            el.onDrop(selection.elements, new UnitOfWork(this.diagram), 'non-interactive');
          }
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
      const uow = new UnitOfWork(this.diagram);
      this.diagram.transformElements(selection.elements, [], uow, 'non-interactive');
      uow.commit();

      selection.rebaseline();
    }

    this.isDuplicateDrag = false;
  }

  private enablePointerEvents(elements: ReadonlyArray<DiagramElement>) {
    for (const e of elements) {
      if (e.type === 'node') {
        const n = document.getElementById(`node-${e.id}`)!;
        if (!n) continue; // TODO: This seems to be for groups - but why?:
        n.style.pointerEvents = this.oldPointerEventsValues[n.id];

        if (e.nodeType === 'group') this.enablePointerEvents(e.children);
      } else if (e.type === 'edge') {
        const n = document.getElementById(`edge-${e.id}`)!;
        n.style.pointerEvents = this.oldPointerEventsValues[n.id];
      }
    }
  }

  private disablePointerEvents(elements: ReadonlyArray<DiagramElement>) {
    for (const e of elements) {
      if (e.type === 'node') {
        const n = document.getElementById(`node-${e.id}`)!;
        if (!n) continue; // TODO: This seems to be for groups - but why?:
        this.oldPointerEventsValues[n.id] = n.style.pointerEvents;
        n.style.pointerEvents = 'none';

        if (e.nodeType === 'group') this.enablePointerEvents(e.children);
      } else if (e.type === 'edge') {
        const n = document.getElementById(`edge-${e.id}`)!;
        this.oldPointerEventsValues[n.id] = n.style.pointerEvents;
        n.style.pointerEvents = 'none';
      }
    }
  }
}
