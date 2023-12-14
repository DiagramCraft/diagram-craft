import { Diagram } from './diagram.ts';
import { EventEmitter } from '../utils/event.ts';

export type DocumentEvents = {
  diagramchanged: { after: Diagram };
  diagramadded: { node: Diagram };
  diagramremoved: { node: Diagram };
};

export class DiagramDocument<T extends Diagram> extends EventEmitter<DocumentEvents> {
  constructor(public readonly diagrams: T[]) {
    super();
  }

  getById(id: string) {
    return (
      this.diagrams.find(d => d.id === id) ??
      this.diagrams.map(d => d.findChildDiagramById(id)).find(d => d !== undefined)
    );
  }

  addDiagram(diagram: T) {
    this.diagrams.push(diagram);
    this.emit('diagramadded', { node: diagram });
  }

  removeDiagram(diagram: T) {
    const idx = this.diagrams.indexOf(diagram);
    if (idx !== -1) {
      this.diagrams.splice(idx, 1);
      this.emit('diagramremoved', { node: diagram });
    }
  }

  changeDiagram(diagram: T) {
    this.emit('diagramchanged', { after: diagram });
  }
}
