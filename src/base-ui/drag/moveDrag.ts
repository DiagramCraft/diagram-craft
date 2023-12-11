import { Drag, Modifiers } from '../drag.ts';
import { Point } from '../../geometry/point.ts';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { assert } from '../../utils/assert.ts';
import { Box } from '../../geometry/box.ts';
import { Direction } from '../../geometry/direction.ts';
import { Translation } from '../../geometry/transform.ts';
import { Vector } from '../../geometry/vector.ts';
import { Angle } from '../../geometry/angle.ts';
import { createResizeCanvasActionToFit } from '../../model-editor/helpers/canvasResizeHelper.ts';
import { MoveAction, NodeAddAction } from '../../model-viewer/actions.ts';
import { Axis } from '../../geometry/axis.ts';
import { newid } from '../../utils/id.ts';

export class MoveDrag implements Drag {
  snapAngle?: Axis;

  constructor(
    private readonly diagram: EditableDiagram,
    private readonly offset: Point
  ) {}

  onDrag(coord: Point, modifiers: Modifiers): void {
    const selection = this.diagram.selectionState;
    assert.false(selection.isEmpty());

    // Don't move connected edges
    if (
      selection.nodes.length === 0 &&
      selection.edges.every(e => e.isStartConnected() || e.isEndConnected())
    ) {
      return;
    }

    const d = Point.subtract(coord, Point.add(selection.bounds.pos, this.offset));

    const newBounds = Box.asMutableSnapshot(selection.bounds);

    newBounds.set('pos', Point.add(selection.bounds.pos, d));

    let snapDirections: Direction[] = Direction.all();

    // TODO: Ideally we would want to trigger some of this based on button press instead of mouse move
    if (modifiers.metaKey && !selection.state['metaKey']) {
      // Reset current selection back to original
      this.diagram.transformElements(selection.nodes, [
        new Translation(Point.subtract(selection.source.boundingBox.pos, selection.bounds.pos))
      ]);

      newBounds.set('pos', selection.source.boundingBox.pos);
      selection.bounds = newBounds.getSnapshot();
      selection.guides = [];

      const newElements = selection.source.elementIds.map(e => this.diagram.nodeLookup[e].clone());
      newElements.forEach(e => {
        e.id = newid();
        this.diagram.addNode(e);
      });
      selection.elements = newElements;

      selection.state['metaKey'] = true;
    } else if (!modifiers.metaKey && selection.state['metaKey']) {
      selection.state['metaKey'] = false;

      const elementsToRemove = selection.nodes;

      selection.elements = selection.source.elementIds.map(e => this.diagram.nodeLookup[e]);
      selection.recalculateBoundingBox();
      selection.guides = [];

      elementsToRemove.forEach(e => {
        this.diagram.removeNode(e);
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

    this.diagram.transformElements(selection.elements, [
      new Translation(Point.subtract(newBounds.get('pos'), selection.bounds.pos))
    ]);
    selection.bounds = newBounds.getSnapshot();
  }

  onDragEnd(): void {
    const selection = this.diagram.selectionState;
    if (selection.isChanged()) {
      // TODO: Maybe add a compound action here
      const resizeCanvasAction = createResizeCanvasActionToFit(
        this.diagram,
        Box.boundingBox(
          selection.nodes.map(e => e.bounds),
          true
        )
      );
      if (resizeCanvasAction) {
        this.diagram.undoManager.execute(resizeCanvasAction);
      }

      if (selection.state['metaKey']) {
        this.diagram.undoManager.add(new NodeAddAction(selection.nodes, this.diagram));
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
      selection.rebaseline();
    }

    selection.state['metaKey'] = false;
  }
}
