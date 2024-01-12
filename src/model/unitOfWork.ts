import { DiagramElement, Snapshot } from './diagramElement.ts';
import { Diagram } from './diagram.ts';
import { assert } from '../utils/assert.ts';

type ActionCallback = () => void;

type ChangeType = 'interactive' | 'non-interactive';

export class UnitOfWork {
  #elementsToUpdate = new Map<string, DiagramElement>();
  #elementsToRemove = new Map<string, DiagramElement>();
  #elementsToAdd = new Map<string, DiagramElement>();

  #invalidatedElements = new Set<DiagramElement>();

  #shouldUpdateDiagram = false;

  #snapshots = new Map<string, undefined | Snapshot>();

  // TODO: Will we really need #actions going forward
  #actions = new Map<string, ActionCallback>();

  constructor(
    readonly diagram: Diagram,
    public readonly changeType: ChangeType = 'non-interactive',
    public readonly trackChanges: boolean = false
  ) {}

  static throwaway(diagram: Diagram) {
    return new UnitOfWork(diagram, 'interactive', false);
  }

  static execute<T>(diagram: Diagram, cb: (uow: UnitOfWork) => T): T {
    const uow = new UnitOfWork(diagram);
    const result = cb(uow);
    uow.commit();
    return result;
  }

  snapshot(element: DiagramElement) {
    if (!this.trackChanges) return;
    assert.false(this.#snapshots.has(element.id), 'Can only create snapshot once');

    this.#snapshots.set(element.id, element.snapshot());
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
    assert.true(
      !this.trackChanges || this.#snapshots.has(element.id),
      'Must create snapshot before updating element'
    );
    this.#elementsToUpdate.set(element.id, element);
  }

  removeElement(element: DiagramElement) {
    assert.true(
      !this.trackChanges || this.#snapshots.has(element.id),
      'Must create snapshot before updating element'
    );
    this.#elementsToRemove.set(element.id, element);
  }

  addElement(element: DiagramElement) {
    assert.false(
      this.trackChanges && this.#snapshots.has(element.id),
      'Cannot add element that has a snapshot'
    );
    if (this.trackChanges && this.#snapshots.has(element.id)) {
      this.#snapshots.set(element.id, undefined);
    }
    this.#elementsToAdd.set(element.id, element);
  }

  updateDiagram() {
    this.#shouldUpdateDiagram = true;
  }

  pushAction(name: string, element: DiagramElement, cb: ActionCallback) {
    const id = name + element.id;
    if (this.#actions.has(id)) return;

    // Note, a Map retains insertion order, so this ensure actions are
    // executed in the order they are added
    this.#actions.set(id, cb);
  }

  notify() {
    this.processEvents();

    this.#actions.clear();
    this.#elementsToUpdate.clear();
    this.#elementsToRemove.clear();
    this.#elementsToAdd.clear();

    return this.#snapshots;
  }

  commit() {
    this.processEvents();

    if (this.#shouldUpdateDiagram) {
      this.diagram.emit('change', { diagram: this.diagram });
    }

    return this.#snapshots;
  }

  abort() {}

  private processEvents() {
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
}
