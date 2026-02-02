import { UndoableAction } from './undoManager';
import { UnitOfWork } from './unitOfWork';
import { DiagramDocument } from './diagramDocument';
import { Diagram } from './diagram';

export class DiagramReorderUndoableAction implements UndoableAction {
  description: string;
  private readonly originalPositions: Array<{ diagram: Diagram; index: number }>;

  constructor(
    private readonly document: DiagramDocument,
    private readonly diagramsToMove: Diagram[],
    private readonly targetDiagram: Diagram,
    private readonly relation: 'above' | 'below'
  ) {
    this.description = 'Reorder diagrams';

    // Store original positions for undo
    const parent = document.getDiagramPath(targetDiagram).at(-2);
    const peerDiagrams = parent ? parent.diagrams : document.diagrams;
    this.originalPositions = diagramsToMove.map(d => ({
      diagram: d,
      index: peerDiagrams.indexOf(d)
    }));
  }

  undo(_uow: UnitOfWork): void {
    // Restore each diagram to its original position
    // Sort by original index to restore in correct order
    const sorted = [...this.originalPositions].sort((a, b) => a.index - b.index);
    const parent = this.document.getDiagramPath(this.targetDiagram).at(-2);

    for (const { diagram, index } of sorted) {
      this.document.removeDiagram(diagram);
      this.document.insertDiagram(diagram, index, parent);
    }
  }

  redo(_uow: UnitOfWork): void {
    this.document.moveDiagrams(this.diagramsToMove, {
      diagram: this.targetDiagram,
      relation: this.relation
    });
  }
}
