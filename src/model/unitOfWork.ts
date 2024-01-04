import { DiagramElement } from './diagramElement.ts';
import { Diagram } from './diagram.ts';

type Callback = () => void;

export class UnitOfWork {
  #elementsToUpdate = new Map<string, DiagramElement>();
  #elementsToRemove = new Map<string, DiagramElement>();
  #elementsToAdd = new Map<string, DiagramElement>();
  #actions = new Map<string, Callback>();

  constructor(readonly diagram: Diagram) {}

  static updateElement(element: DiagramElement) {
    element.diagram.emit('elementChange', { element: element });
  }

  static execute<T>(diagram: Diagram, cb: (uow: UnitOfWork) => T): T {
    const uow = new UnitOfWork(diagram);
    const result = cb(uow);
    uow.commit();
    return result;
  }

  contains(element: DiagramElement) {
    return this.#elementsToUpdate.has(element.id) || this.#elementsToRemove.has(element.id);
  }

  updateElement(element: DiagramElement) {
    this.#elementsToUpdate.set(element.id, element);
  }

  removeElement(element: DiagramElement) {
    this.#elementsToRemove.set(element.id, element);
  }

  addElement(element: DiagramElement) {
    this.#elementsToAdd.set(element.id, element);
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

    // TODO: Need to think about the order here a bit better to optimize the number of events
    //       ... can be only CHANGE, ADD, REMOVE, ADD_CHANGE
    this.#elementsToRemove.forEach(e => this.diagram.emit('elementRemove', { element: e }));
    this.#elementsToUpdate.forEach(e => this.diagram.emit('elementChange', { element: e }));
    this.#elementsToAdd.forEach(e => this.diagram.emit('elementAdd', { element: e }));
  }

  commitWithoutEvents() {
    this.#actions.forEach(a => a());
  }
}
