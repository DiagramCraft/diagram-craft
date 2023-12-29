import { DiagramElement } from './diagramNode.ts';
import { Diagram } from './diagram.ts';

type Callback = () => void;

export class UnitOfWork {
  #elementsToUpdate = new Map<string, DiagramElement>();
  #actions = new Map<string, Callback>();

  constructor(readonly diagram: Diagram) {}

  static updateElement(element: DiagramElement) {
    element.diagram.emit('elementChange', { element: element });
  }

  contains(element: DiagramElement) {
    return this.#elementsToUpdate.has(element.id);
  }

  updateElement(element: DiagramElement) {
    this.#elementsToUpdate.set(element.id, element);
  }

  pushAction(name: string, element: DiagramElement, cb: Callback) {
    const id = name + element.id;
    if (this.#actions.has(id)) return;

    // Note, a Map retains insertion order, so this ensure actions are
    // executed in the order they are added
    this.#actions.set(id, cb);
  }

  commit() {
    // Note, actions must run before elements events are emitted
    this.#actions.forEach(a => a());
    this.#elementsToUpdate.forEach(e => this.diagram.emit('elementChange', { element: e }));
  }
}
