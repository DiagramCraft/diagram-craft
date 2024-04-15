import { DiagramPalette } from './diagramPalette';
import { DiagramStyles } from './diagramStyles';
import { DiagramDataSchemas } from './diagramDataSchemas';
import { Diagram } from './diagram';
import { AttachmentConsumer, AttachmentManager } from './attachment';
import { EventEmitter } from '@diagram-craft/utils/event';
import { range } from '@diagram-craft/utils/array';

export type DocumentEvents = {
  diagramchanged: { after: Diagram };
  diagramadded: { node: Diagram };
  diagramremoved: { node: Diagram };
};

export class DiagramDocument extends EventEmitter<DocumentEvents> implements AttachmentConsumer {
  attachments = new AttachmentManager(this);
  customPalette = new DiagramPalette(range(0, 14).map(() => '#000000'));
  styles = new DiagramStyles(this);

  // TODO: To be loaded from file
  schemas = new DiagramDataSchemas(this, [
    {
      id: 'default',
      name: 'Default',
      fields: [
        {
          id: 'name',
          name: 'Name',
          type: 'text'
        },
        {
          id: 'notes',
          name: 'Notes',
          type: 'longtext'
        }
      ]
    }
  ]);

  // TODO: To be loaded from file
  props: DocumentProps = {
    query: {
      saved: [
        ['active-layer', '.elements[]'],
        ['active-layer', '.elements[] | select(.edges | length > 0)']
      ]
    }
  };

  constructor(public readonly diagrams: Array<Diagram>) {
    super();
    this.diagrams.forEach(d => (d.document = this));
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

  toJSON() {
    return {
      diagrams: this.diagrams,
      styles: this.styles,
      props: this.props,
      customPalette: this.customPalette
    };
  }

  getAttachmentsInUse() {
    return this.diagrams.flatMap(e => e.getAttachmentsInUse());
  }
}
