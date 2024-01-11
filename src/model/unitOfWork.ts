import { DiagramElement } from './diagramElement.ts';
import { Diagram } from './diagram.ts';

type Callback = () => void;

type ChangeType = 'interactive' | 'non-interactive';

export class UnitOfWork {
  #elementsToUpdate = new Map<string, DiagramElement>();
  #elementsToRemove = new Map<string, DiagramElement>();
  #elementsToAdd = new Map<string, DiagramElement>();

  #invalidatedElements = new Set<DiagramElement>();

  // TODO: Will we really need #actions going forward
  #actions = new Map<string, Callback>();

  constructor(
    readonly diagram: Diagram,
    public readonly changeType: ChangeType = 'non-interactive'
  ) {}

  static updateElement(element: DiagramElement) {
    element.diagram.emit('elementChange', { element: element });
  }

  static execute<T>(diagram: Diagram, cb: (uow: UnitOfWork) => T): T {
    const uow = new UnitOfWork(diagram);
    const result = cb(uow);
    uow.commit();
    return result;
  }

  static noCommit<T>(diagram: Diagram, cb: (uow: UnitOfWork) => T): T {
    const uow = new UnitOfWork(diagram);
    return cb(uow);
  }

  hasBeenInvalidated(element: DiagramElement) {
    return this.#invalidatedElements.has(element);
  }

  beginInvalidation(element: DiagramElement) {
    this.#invalidatedElements.add(element);
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

    // At this point, any elements have been added and or removed
    this.#elementsToRemove.forEach(e => e.invalidate(this));
    this.#elementsToUpdate.forEach(e => e.invalidate(this));
    this.#elementsToAdd.forEach(e => e.invalidate(this));

    // TODO: Need to think about the order here a bit better to optimize the number of events
    //       ... can be only CHANGE, ADD, REMOVE, ADD_CHANGE
    this.#elementsToRemove.forEach(e => this.diagram.emit('elementRemove', { element: e }));
    this.#elementsToUpdate.forEach(e => this.diagram.emit('elementChange', { element: e }));
    this.#elementsToAdd.forEach(e => this.diagram.emit('elementAdd', { element: e }));
  }

  commitWithoutEvents() {
    this.#actions.forEach(a => a());
  }

  // TODO: We should defer this, and only do it once per commit - as well as cancelling all other elementChange events
  updateDiagram() {
    this.diagram.emit('change', { diagram: this.diagram });
  }
}
