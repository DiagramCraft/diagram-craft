import { UndoableAction } from './undoManager';
import { UnitOfWork } from './unitOfWork';
import { DiagramDocument } from './diagramDocument';
import { Diagram } from './diagram';

export class DiagramReorderUndoableAction implements UndoableAction {
  description: string;
  private readonly originalIndex: number;

  constructor(
    private readonly document: DiagramDocument,
    private readonly diagramToMove: Diagram,
    private readonly targetDiagram: Diagram,
    private readonly relation: 'before' | 'after'
  ) {
    this.description = 'Reorder diagram';

    // Store original position for undo
    const parent = document.getDiagramPath(targetDiagram).at(-2);
    const peerDiagrams = parent ? parent.diagrams : document.diagrams;
    this.originalIndex = peerDiagrams.indexOf(diagramToMove);
  }

  undo(_uow: UnitOfWork): void {
    // Restore diagram to its original position
    const parent = this.document.getDiagramPath(this.targetDiagram).at(-2);
    this.document.removeDiagram(this.diagramToMove);
    this.document.insertDiagram(this.diagramToMove, this.originalIndex, parent);
  }

  redo(_uow: UnitOfWork): void {
    this.document.moveDiagram(this.diagramToMove, {
      diagram: this.targetDiagram,
      relation: this.relation
    });
  }
}
