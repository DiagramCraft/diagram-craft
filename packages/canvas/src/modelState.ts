import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { Diagram } from '@diagram-craft/model/diagram';
import { EventEmitter } from '@diagram-craft/utils/event';
import { ProgressCallback } from '@diagram-craft/model/types';

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

  setActiveDocument(document: DiagramDocument, callback: ProgressCallback) {
    if (this.#activeDocument === document) return;

    if (this.#activeDocument?.url === document.url) {
      this.#activeDocument = document;
      this.emit('activeDocumentChange', { document: document });
      return;
    }

    this.#activeDocument?.deactivate(callback);
    this.#activeDocument = document;
    this.#activeDocument?.activate(callback);
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
