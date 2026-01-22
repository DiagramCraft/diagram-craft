import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { Diagram } from '@diagram-craft/model/diagram';
import { EventEmitter } from '@diagram-craft/utils/event';
import type { AwarenessUserState } from '@diagram-craft/collaboration/awareness';
import type { ProgressCallback } from '@diagram-craft/utils/progress';

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

  setActiveDocument(
    document: DiagramDocument,
    userState: AwarenessUserState,
    callback: ProgressCallback
  ) {
    if (this.#activeDocument === document) return;

    const isUrlChange = this.#activeDocument?.url !== document.url;

    if (isUrlChange) {
      this.#activeDocument?.deactivate(callback);
      this.#activeDocument?.release();
    }
    this.#activeDocument = document;
    if (isUrlChange) this.#activeDocument?.activate(userState, callback);
    this.emit('activeDocumentChange', { document: document });
  }

  get activeDiagram() {
    return this.#activeDiagram!;
  }

  set activeDiagram(diagram: Diagram) {
    this.#activeDiagram = diagram;
    diagram.document.activeDiagramId = diagram.id;
    this.emit('activeDiagramChange', { document: diagram });
  }
}

const MODEL_STATE = new ModelState();
export const model = MODEL_STATE;
