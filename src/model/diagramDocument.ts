import { Diagram } from './diagram.ts';
import { EventEmitter } from '../utils/event.ts';
import { AttachmentManager } from './attachment.ts';
import { range } from '../utils/array.ts';

export type DocumentEvents = {
  diagramchanged: { after: Diagram };
  diagramadded: { node: Diagram };
  diagramremoved: { node: Diagram };
};

export class DiagramDocument extends EventEmitter<DocumentEvents> {
  attachments = new AttachmentManager(this);
  customPalette = range(0, 14).map(() => '#000000');

  constructor(public readonly diagrams: Array<Diagram>) {
    super();
    this.diagrams.forEach(d => (d.document = this));
  }

  setCustomPalette(idx: number, v: string) {
    this.customPalette = this.customPalette.map((c, i) => (i === idx ? v : c));
  }

  getById(id: string) {
    return (
      this.diagrams.find(d => d.id === id) ??
      this.diagrams.map(d => d.findChildDiagramById(id)).find(d => d !== undefined)
    );
  }

  addDiagram(diagram: Diagram) {
    this.diagrams.push(diagram);
    diagram.document = this;
    this.emit('diagramadded', { node: diagram });
  }

  removeDiagram(diagram: Diagram) {
    const idx = this.diagrams.indexOf(diagram);
    if (idx !== -1) {
      this.diagrams.splice(idx, 1);
      this.emit('diagramremoved', { node: diagram });
    }
  }

  changeDiagram(diagram: Diagram) {
    this.emit('diagramchanged', { after: diagram });
  }
}
