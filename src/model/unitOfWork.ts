import { DiagramElement } from './diagramElement.ts';
import { Diagram, DiagramEvents } from './diagram.ts';
import { assert } from '../utils/assert.ts';
import { Layer, LayerManager } from './diagramLayer.ts';
import { EventKey } from '../utils/event.ts';
import { SerializedEdge, SerializedNode } from './serialization/types.ts';

type ActionCallback = () => void;

type ChangeType = 'interactive' | 'non-interactive';

export type LayersSnapshot = {
  _snapshotType: 'layers';
  layers: string[];
};

export type LayerSnapshot = {
  _snapshotType: 'layer';
  elements: string[];
};

export type DiagramNodeSnapshot = Omit<SerializedNode, 'children'> & {
  _snapshotType: 'node';
  parentId?: string;
  children: string[];
};

export type DiagramEdgeSnapshot = SerializedEdge & {
  _snapshotType: 'edge';
};

type Snapshot = { _snapshotType: string } & (
  | LayersSnapshot
  | LayerSnapshot
  | DiagramNodeSnapshot
  | DiagramEdgeSnapshot
);

export interface UOWTrackable<T extends Snapshot> {
  id: string;
  invalidate(uow: UnitOfWork): void;
  snapshot(): T;
  restore(snapshot: T, uow: UnitOfWork): void;
}

type Trackable = (DiagramElement | Layer | LayerManager) & UOWTrackable<Snapshot>;

export class ElementsSnapshot {
  constructor(readonly snapshots: Map<string, undefined | Snapshot>) {}

  onlyUpdated() {
    return new ElementsSnapshot(
      new Map([...this.snapshots.entries()].filter(([, v]) => v !== undefined))
    );
  }

  onlyAdded() {
    return new ElementsSnapshot(
      new Map([...this.snapshots.entries()].filter(([, v]) => v === undefined))
    );
  }

  get keys() {
    return [...this.snapshots.keys()];
  }

  get(key: string) {
    return this.snapshots.get(key);
  }

  retakeSnapshot(diagram: Diagram) {
    const dest = new Map<string, undefined | Snapshot>();
    for (const k of this.snapshots.keys()) {
      if (this.snapshots.get(k)?._snapshotType === 'layer') {
        const layer = diagram.layers.byId(k);
        if (!layer) continue;
        dest.set(k, layer.snapshot());
      } else {
        const element = diagram.lookup(k);
        if (!element) continue;
        dest.set(k, element.snapshot());
      }
    }
    return new ElementsSnapshot(dest);
  }
}

export class UnitOfWork {
  #elementsToUpdate = new Map<string, Trackable>();
  #elementsToRemove = new Map<string, Trackable>();
  #elementsToAdd = new Map<string, Trackable>();

  #invalidatedElements = new Set<Trackable>();

  #shouldUpdateDiagram = false;

  #snapshots = new Map<string, undefined | Snapshot>();

  // TODO: Will we really need #actions going forward
  #actions = new Map<string, ActionCallback>();

  changeType: ChangeType = 'non-interactive';

  constructor(
    readonly diagram: Diagram,
    public trackChanges: boolean = false
  ) {}

  static throwaway(diagram: Diagram) {
    return new UnitOfWork(diagram, false);
  }

  static execute<T>(diagram: Diagram, cb: (uow: UnitOfWork) => T): T {
    const uow = new UnitOfWork(diagram);
    const result = cb(uow);
    uow.commit();
    return result;
  }

  snapshot(element: Trackable) {
    if (!this.trackChanges) return;
    if (this.#snapshots.has(element.id)) return;

    this.#snapshots.set(element.id, element.snapshot());
  }

  hasBeenInvalidated(element: Trackable) {
    return this.#invalidatedElements.has(element);
  }

  beginInvalidation(element: Trackable) {
    this.#invalidatedElements.add(element);
  }

  contains(element: Trackable) {
    return this.#elementsToUpdate.has(element.id) || this.#elementsToRemove.has(element.id);
  }

  updateElement(element: Trackable) {
    assert.true(
      !this.trackChanges || this.#snapshots.has(element.id),
      'Must create snapshot before updating element'
    );
    this.#elementsToUpdate.set(element.id, element);
  }

  removeElement(element: Trackable) {
    assert.true(
      !this.trackChanges || this.#snapshots.has(element.id),
      'Must create snapshot before updating element'
    );
    this.#elementsToRemove.set(element.id, element);
  }

  addElement(element: Trackable) {
    /*assert.false(
      this.trackChanges && this.#snapshots.has(element.id),
      'Cannot add element that has a snapshot'
    );*/
    if (this.trackChanges && !this.#snapshots.has(element.id)) {
      this.#snapshots.set(element.id, undefined);
    }
    this.#elementsToAdd.set(element.id, element);
  }

  pushAction(name: string, element: Trackable, cb: ActionCallback) {
    const id = name + element.id;
    if (this.#actions.has(id)) return;

    // Note, a Map retains insertion order, so this ensure actions are
    // executed in the order they are added
    this.#actions.set(id, cb);
  }

  notify() {
    this.changeType = 'interactive';

    this.processEvents();

    this.#actions.clear();
    this.#elementsToUpdate.clear();
    this.#elementsToRemove.clear();
    this.#elementsToAdd.clear();
    this.#invalidatedElements.clear();

    return this.#snapshots;
  }

  commit() {
    this.changeType = 'non-interactive';

    this.processEvents();

    if (this.#shouldUpdateDiagram) {
      this.diagram.emit('change', { diagram: this.diagram });
    }

    return new ElementsSnapshot(this.#snapshots);
  }

  abort() {}

  private processEvents() {
    // Note, actions must run before elements events are emitted
    this.#actions.forEach(a => a());

    // At this point, any elements have been added and or removed
    this.#elementsToRemove.forEach(e => e.invalidate(this));
    this.#elementsToUpdate.forEach(e => e.invalidate(this));
    this.#elementsToAdd.forEach(e => e.invalidate(this));

    const handle = (s: EventKey<DiagramEvents>) => (e: Trackable) => {
      if (e instanceof Layer || e instanceof LayerManager) {
        this.#shouldUpdateDiagram = true;
      } else {
        this.diagram.emit(s, { element: e });
      }
    };

    // TODO: Need to think about the order here a bit better to optimize the number of events
    //       ... can be only CHANGE, ADD, REMOVE, ADD_CHANGE
    this.#elementsToRemove.forEach(handle('elementRemove'));
    this.#elementsToUpdate.forEach(handle('elementChange'));
    this.#elementsToAdd.forEach(handle('elementAdd'));
  }

  stopTracking() {
    this.trackChanges = false;
  }

  updateDiagram() {
    this.#shouldUpdateDiagram = true;
  }
}
