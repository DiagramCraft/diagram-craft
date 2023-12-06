import { Drag } from '../drag.ts';
import { Point } from '../../geometry/point.ts';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { assert } from '../../utils/assert.ts';
import { Box } from '../../geometry/box.ts';
import { Vector } from '../../geometry/vector.ts';
import { TransformFactory } from '../../geometry/transform.ts';
import { RotateAction } from '../../model-viewer/actions.ts';

export class RotateDrag implements Drag {
  onDrag(coord: Point, diagram: EditableDiagram) {
    const selection = diagram.selectionState;
    assert.false(selection.isEmpty());

    const before = selection.bounds;

    const center = Box.center(selection.source.boundingBox);

    selection.bounds = {
      ...selection.bounds,
      rotation: Vector.angle(Vector.from(center, coord)) + Math.PI / 2
    };
    selection.guides = [];

    diagram.transformElements(selection.nodes, TransformFactory.fromTo(before, selection.bounds));
  }

  onDragEnd(_coord: Point, diagram: EditableDiagram): void {
    const selection = diagram.selectionState;
    if (selection.isChanged()) {
      diagram.undoManager.add(
        new RotateAction(
          selection.source.elementBoxes,
          selection.nodes.map(e => e.bounds),
          selection.nodes,
          diagram
        )
      );
      selection.rebaseline();
    }
  }
}
