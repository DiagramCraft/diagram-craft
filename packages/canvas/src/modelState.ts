import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { Diagram } from '@diagram-craft/model/diagram';
import { EventEmitter } from '@diagram-craft/utils/event';

export type ModelStateEvents = {
  activeDocumentChange: { document: DiagramDocument };
  activeDiagramChange: { document: Diagram };
};

class ModelState extends EventEmitter<ModelStateEvents> {
  #activeDocument: DiagramDocument | undefined;
  #activeDiagram: Diagram | undefined;

  get activeDocument() {
    return this.#activeDocument!;
  }

  set activeDocument(document: DiagramDocument) {
    this.#activeDocument = document;
    this.emit('activeDocumentChange', { document: document });
  }

  get activeDiagram() {
    return this.#activeDiagram!;
  }

  set activeDiagram(diagram: Diagram) {
    this.#activeDiagram = diagram;
    this.emit('activeDiagramChange', { document: diagram });
  }
}

const MODEL_STATE = new ModelState();
export const model = MODEL_STATE;
