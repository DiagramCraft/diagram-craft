import { Diagram, DiagramEdge, DiagramNode } from '../model-viewer/diagram.ts';
import { SelectionState } from './selectionState.ts';

export class EditableDiagram extends Diagram {
  selectionState: SelectionState = new SelectionState();

  constructor(elements: (DiagramEdge | DiagramNode)[]) {
    super(elements);
  }
}
