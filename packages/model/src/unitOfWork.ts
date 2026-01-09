import type { DiagramElement } from './diagramElement';
import { assert, mustExist } from '@diagram-craft/utils/assert';
import type { Stylesheet, StylesheetType } from './diagramStyles';
import type { Layer } from './diagramLayer';
import type { Diagram } from './diagram';
import { newid } from '@diagram-craft/utils/id';
import { CompoundUndoableAction, UndoableAction } from '@diagram-craft/model/undoManager';
import { UnitOfWorkManager } from '@diagram-craft/model/unitOfWorkManager';
import { hasSameElements } from '@diagram-craft/utils/array';
import { MultiMap } from '@diagram-craft/utils/multimap';
import { isDebug } from '@diagram-craft/utils/debug';
import { ArrayOrSingle } from '@diagram-craft/utils/types';

type ActionCallback = () => void;

type ChangeType = 'interactive' | 'non-interactive';

const remoteUnitOfWorkRegistry = new Map<string, UnitOfWork>();

export const getRemoteUnitOfWork = (diagram: Diagram) => {
  let uow = remoteUnitOfWorkRegistry.get(diagram.id);
  if (!uow) {
    uow = UnitOfWork.remote(diagram);
    remoteUnitOfWorkRegistry.set(diagram.id, uow);
    uow.registerOnCommitCallback('remoteCleanup', undefined, () =>
      remoteUnitOfWorkRegistry.delete(diagram.id)
    );
  }
  return uow;
};

export interface Snapshot {
  _snapshotType: string;
}

export interface UOWTrackable {
  _trackableType: string;
}

export interface UOWTrackableSpecification<S extends Snapshot, E extends UOWTrackable> {
  id(element: E): string;
  invalidate: (element: E, uow: UnitOfWork) => void;

  updateElement: (diagram: Diagram, elementId: string, snapshot: S, uow: UnitOfWork) => void;

  onCommit: (elements: Array<E>, uow: UnitOfWork) => void;

  snapshot: (element: E) => S;
  restore: (snapshot: S, element: E, uow: UnitOfWork) => void;
}

export interface UOWTrackableParentChildSpecification<S extends Snapshot> {
  addElement: (
    diagram: Diagram,
    parentId: string,
    childId: string,
    childSnapshot: S,
    idx: number,
    uow: UnitOfWork
  ) => void;
  removeElement: (diagram: Diagram, parentId: string, child: string, uow: UnitOfWork) => void;
}

const registry =
  process.env.NODE_ENV === 'development'
    ? new FinalizationRegistry((v: string) => {
        // No warnings for throwaways
        if (v.startsWith('true;')) return;
        console.error('Failed uow cleanup', v.substring(5));
      })
    : {
        register: () => {},
        unregister: () => {}
      };

declare global {
  namespace DiagramCraft {
    interface UnitOfWorkMetadata {
      nonDirty?: boolean;
    }
  }
}

type UOWOperation =
  | {
      type: 'add';
      id: string;
      trackable: UOWTrackable;
      trackableType: UOWTrackable['_trackableType'];

      idx: number;
      parentId: string;
      parentType: string;
      afterSnapshot: Snapshot;
    }
  | {
      type: 'remove';
      id: string;
      trackable: UOWTrackable;
      trackableType: UOWTrackable['_trackableType'];

      idx: number;
      parentId: string;
      parentType: string;
      beforeSnapshot: Snapshot;
    }
  | {
      type: 'update';
      id: string;
      trackable: UOWTrackable;
      trackableType: UOWTrackable['_trackableType'];

      beforeSnapshot: Snapshot;
      afterSnapshot: Snapshot;
    };

type UOWEventMap = Map<string, Map<string, (uow: UnitOfWork) => void>>;

const emitEvent = (map: UOWEventMap, key: string, uow: UnitOfWork) => {
  const eventsById = map.get(key);
  if (!eventsById) return;

  for (const cb of eventsById!.values()) {
    cb(uow);
  }
};

export class UnitOfWork {
  uid = newid();

  #operations: Array<UOWOperation> = [];
  #updates = new Set<string>();
  #invalidatedElements = new Set<UOWTrackable>();
  #snapshots = new MultiMap<string, undefined | Snapshot>();
  #onCommitCallbacks = new Map<string, ActionCallback>();
  #undoableActions: Array<UndoableAction> = [];

  #callbacks: UOWEventMap = new Map<string, Map<string, (uow: UnitOfWork) => void>>();

  state: 'pending' | 'committed' | 'aborted' = 'pending';
  changeType: ChangeType = 'non-interactive';
  metadata: DiagramCraft.UnitOfWorkMetadata = {};

  private constructor(
    readonly diagram: Diagram,
    public trackChanges: boolean = false,
    public isThrowaway: boolean = false,
    public isRemote: boolean = false
  ) {
    if (!isThrowaway) {
      registry.register(this, `${this.isThrowaway.toString()};${new Error().stack}`, this);
    }
  }

  static remote(diagram: Diagram) {
    return new UnitOfWork(diagram, false, false, true);
  }

  static begin(diagram: Diagram) {
    return new UnitOfWork(diagram, true);
  }

  static execute<T>(diagram: Diagram, cb: (uow: UnitOfWork) => T): T {
    const uow = new UnitOfWork(diagram);
    try {
      return cb(uow);
    } finally {
      if (uow.state === 'pending') uow.commit();
    }
  }

  static executeSilently<T>(diagram: Diagram | undefined, cb: (uow: UnitOfWork) => T): T {
    const uow = new UnitOfWork(diagram!, false, true);
    try {
      return cb(uow);
    } finally {
      if (uow.state === 'pending') uow.abort();
    }
  }

  static async executeAsync<T>(diagram: Diagram, cb: (uow: UnitOfWork) => Promise<T>): Promise<T> {
    const uow = new UnitOfWork(diagram);
    try {
      return await cb(uow);
    } finally {
      if (uow.state === 'pending') uow.commit();
    }
  }

  static executeWithUndo<T>(diagram: Diagram, label: string, cb: (uow: UnitOfWork) => T): T {
    const uow = new UnitOfWork(diagram, true);
    try {
      return cb(uow);
    } finally {
      if (uow.state === 'pending') uow.commitWithUndo(label);
    }
  }

  get operations() {
    return this.#operations;
  }

  add(action: UndoableAction) {
    this.#undoableActions.push(action);
  }

  private snapshot(element: UOWTrackable) {
    if (!this.trackChanges) return;

    const spec = UnitOfWorkManager.getSpec(element._trackableType);
    const s = spec.snapshot(element);
    this.#snapshots.add(spec.id(element), s);
    return s;
  }

  hasBeenInvalidated(element: UOWTrackable) {
    return this.#invalidatedElements.has(element);
  }

  beginInvalidation(element: UOWTrackable) {
    this.#invalidatedElements.add(element);
  }

  contains(element: UOWTrackable, type?: 'update' | 'remove' | 'add') {
    return this.#operations.some(
      e => (e.trackable === element && type === undefined) || e.type === type
    );
  }

  executeUpdate<T>(element: UOWTrackable, cb: () => T): T {
    const snapshot = this.snapshot(element);

    const res = cb();
    this.updateElement(element, snapshot);
    return res;
  }

  executeRemove<T>(element: UOWTrackable, parent: UOWTrackable, idx: number, cb: () => T) {
    assert.true(idx >= 0);

    this.removeElement(element, parent, idx);
    return cb();
  }

  executeAdd<T>(
    element: ArrayOrSingle<UOWTrackable>,
    parent: UOWTrackable,
    idx: number,
    cb: () => T
  ) {
    assert.true(idx >= 0);

    const res = cb();
    this.addElement(element, parent, idx);
    return res;
  }

  updateElement(element: UOWTrackable, snapshot?: Snapshot) {
    const spec = UnitOfWorkManager.getSpec(element._trackableType);
    const id = spec.id(element);

    const effectiveSnapshot = snapshot ?? this.#snapshots.get(id)!.at(-1)!;
    assert.true(
      !this.trackChanges || effectiveSnapshot !== undefined,
      'Must create snapshot before updating element'
    );

    this.#updates.add(id);

    this.#operations.push({
      type: 'update',
      id: id,
      trackable: element,
      trackableType: element._trackableType,
      beforeSnapshot: effectiveSnapshot,
      afterSnapshot: this.trackChanges ? spec.snapshot(element) : undefined
    });
  }

  removeElement(element: UOWTrackable, parent: UOWTrackable, idx: number) {
    if (Array.isArray(element)) {
      element.forEach(e => this.removeElement(e, parent, idx));
      return;
    }

    const spec = UnitOfWorkManager.getSpec(element._trackableType);
    const parentSpec = UnitOfWorkManager.getSpec(parent._trackableType);
    this.#operations.push({
      type: 'remove',
      id: spec.id(element),
      trackable: element,
      trackableType: element._trackableType,
      idx: idx,
      parentId: parentSpec.id(parent),
      parentType: parent._trackableType,
      beforeSnapshot: this.trackChanges ? spec.snapshot(element) : undefined
    });
  }

  addElement(element: ArrayOrSingle<UOWTrackable>, parent: UOWTrackable, idx: number) {
    if (Array.isArray(element)) {
      element.forEach((e, i) => this.addElement(e, parent, idx + i));
      return;
    }

    const spec = UnitOfWorkManager.getSpec(element._trackableType);
    const parentSpec = UnitOfWorkManager.getSpec(parent._trackableType);
    const id = spec.id(element);

    if (this.trackChanges && !this.#snapshots.has(id)) {
      this.#snapshots.add(id, undefined);
    }

    let existingUpdates: Array<UOWOperation> = [];

    if (this.#updates.has(id) && this.trackChanges) {
      const isUpdate = (e: UOWOperation) => e.id === id && e.type === 'update';

      // Need to make sure all updates happen *after* the add
      existingUpdates = this.#operations.filter(isUpdate);
      if (existingUpdates.length > 0) {
        this.#operations = this.#operations.filter(e => !isUpdate(e));
      }
    }

    this.#operations.push({
      type: 'add',
      id: id,
      trackable: element,
      trackableType: element._trackableType,
      idx: idx,
      parentId: parentSpec.id(parent),
      parentType: parent._trackableType,
      afterSnapshot: this.trackChanges ? spec.snapshot(element) : undefined
    });

    if (existingUpdates.length > 0) {
      this.#operations.push(...existingUpdates);
    }
  }

  select(diagram: Diagram, after: string[]) {
    const before = diagram.selection.elements.map(e => e.id);
    diagram.selection.setElementIds(after);
    this.on('after', 'redo', newid(), () => diagram.selection.setElementIds(after));
    this.on('after', 'undo', newid(), () => diagram.selection.setElementIds(before));
  }

  on(
    when: 'after' | 'before',
    event: 'undo' | 'redo' | 'commit',
    id: string,
    callback: (uow: UnitOfWork) => void
  ) {
    if (this.isThrowaway) return;

    const eventKey = `${when}-${event}`;
    if (!this.#callbacks.has(eventKey)) this.#callbacks.set(eventKey, new Map());
    this.#callbacks.get(eventKey)!.set(id, callback);
  }

  /**
   * Register a callback to be executed after the commit phase. It's coalesced
   * so that only one callback is executed per element/operation per commit phase.
   */
  registerOnCommitCallback(name: string, element: UOWTrackable | undefined, cb: ActionCallback) {
    if (this.isThrowaway) {
      return cb();
    }

    const id =
      name + (element ? UnitOfWorkManager.getSpec(element._trackableType).id(element) : '');
    if (this.#onCommitCallbacks.has(id)) return;

    // Note, a Map retains insertion order, so this ensure actions are
    // executed in the order they are added
    this.#onCommitCallbacks.set(id, cb);
  }

  notify() {
    this.changeType = 'interactive';

    this.processEvents();

    this.#invalidatedElements.clear();

    return this.#snapshots;
  }

  commit() {
    this.state = 'committed';
    this.changeType = 'non-interactive';

    emitEvent(this.#callbacks, 'after-commit', this);

    // Note, onCommitCallbacks must run before elements events are emitted
    this.processOnCommitCallbacks();
    this.processEvents();

    emitEvent(this.#callbacks, 'after-elements', this);

    registry.unregister(this);
  }

  commitWithUndo(description: string) {
    this.commit();

    if (this.#undoableActions.length > 0) {
      const compound = new CompoundUndoableAction(this.#undoableActions, description);
      if (this.#operations.length > 0) {
        compound.addAction(
          new UnitOfWorkUndoableAction(description, this.diagram, this.#operations, this.#callbacks)
        );
      }
      this.diagram.undoManager.add(compound);
    } else {
      if (this.#operations.length > 0) {
        this.diagram.undoManager.add(
          new UnitOfWorkUndoableAction(description, this.diagram, this.#operations, this.#callbacks)
        );
      }
    }
  }

  abort() {
    registry.unregister(this);
    this.state = 'aborted';
  }

  private processEvents() {
    // At this point, any elements have been added and or removed
    if (!this.isRemote) {
      const handled = new Set<string>();
      this.#operations.forEach(({ trackable }) => {
        const spec = UnitOfWorkManager.getSpec(trackable._trackableType);
        if (handled.has(spec.id(trackable))) return;
        spec.invalidate(trackable, this);
        handled.add(spec.id(trackable));
      });
    }

    const handle =
      (s: 'add' | 'remove' | 'update') => (type: string, id: string, e: UOWTrackable) => {
        if (type === 'layerManager') {
          this.diagram.layers.emit('layerStructureChange', {});
        } else if (type === 'layer') {
          switch (s) {
            case 'add':
              this.diagram.layers.emit('layerAdded', { layer: e as Layer });
              break;
            case 'update':
              this.diagram.layers.emit('layerUpdated', { layer: e as Layer });
              break;
            case 'remove':
              this.diagram.layers.emit('layerRemoved', { layer: e as Layer });
              break;
          }
        } else if (type === 'stylesheet') {
          switch (s) {
            case 'add':
              this.diagram.document.styles.emit('stylesheetAdded', {
                stylesheet: e as Stylesheet<StylesheetType>
              });
              break;
            case 'update':
              this.diagram.document.styles.emit('stylesheetUpdated', {
                stylesheet: e as Stylesheet<StylesheetType>
              });
              break;
            case 'remove':
              this.diagram.document.styles.emit('stylesheetRemoved', {
                stylesheet: id
              });
              break;
          }
        } else {
          switch (s) {
            case 'add':
              this.diagram.emit('elementAdd', { element: e as DiagramElement });
              break;
            case 'update':
              this.diagram.emit('elementChange', {
                element: e as DiagramElement,
                silent: this.metadata.nonDirty
              });
              break;
            case 'remove':
              this.diagram.emit('elementRemove', { element: e as DiagramElement });
              break;
          }
        }
      };

    const handled = new Set<string>();
    this.#operations.forEach(({ trackable, trackableType, type, id }) => {
      const spec = UnitOfWorkManager.getSpec(trackable._trackableType);
      const key = type + '/' + spec.id(trackable);
      if (handled.has(key)) return;
      handle(type)(trackableType, id, trackable);
      handled.add(key);
    });

    this.diagram.emit('elementBatchChange', {
      removed: [...this.removed].filter(e => e._trackableType === 'element') as DiagramElement[],
      updated: [...this.updated].filter(e => e._trackableType === 'element') as DiagramElement[],
      added: [...this.added].filter(e => e._trackableType === 'element') as DiagramElement[]
    });
  }

  private processOnCommitCallbacks() {
    while (this.#onCommitCallbacks.size > 0) {
      this.#onCommitCallbacks.forEach((callback, key) => {
        this.#onCommitCallbacks.delete(key);
        callback();
      });
    }
  }

  get added() {
    return new Set([...this.#operations.filter(e => e.type === 'add').map(e => e.trackable)]);
  }

  private get updated() {
    return new Set([...this.#operations.filter(e => e.type === 'update').map(e => e.trackable)]);
  }

  private get removed() {
    return new Set([...this.#operations.filter(e => e.type === 'remove').map(e => e.trackable)]);
  }
}

class UnitOfWorkUndoableAction implements UndoableAction {
  timestamp?: Date;

  constructor(
    public readonly description: string,
    private readonly diagram: Diagram,
    private operations: Array<UOWOperation>,
    private eventMap: UOWEventMap
  ) {
    this.operations = this.consolidateOperations(this.operations);
  }

  undo(uow: UnitOfWork) {
    if (isDebug()) {
      console.log('------------------------------------');
      console.log('Undoing', this.description);
    }
    emitEvent(this.eventMap, 'before-undo', uow);

    for (const op of this.operations.toReversed()) {
      const spec = UnitOfWorkManager.getSpec(op.trackableType);
      switch (op.type) {
        case 'remove': {
          const type = `${op.parentType}-${op.trackableType}`;
          const pcSpec = mustExist(UnitOfWorkManager.parentChildSpecs[type]);
          pcSpec.addElement(this.diagram, op.parentId, op.id, op.beforeSnapshot, op.idx, uow);
          break;
        }
        case 'add': {
          const type = `${op.parentType}-${op.trackableType}`;
          const pcSpec = mustExist(UnitOfWorkManager.parentChildSpecs[type]);
          pcSpec.removeElement(this.diagram, op.parentId, op.id, uow);
          break;
        }
        case 'update':
          spec.updateElement(this.diagram, op.id, op.beforeSnapshot, uow);
          break;
      }
    }

    emitEvent(this.eventMap, 'after-undo', uow);
  }

  redo(uow: UnitOfWork) {
    if (isDebug()) {
      console.log('------------------------------------');
      console.log('Redoing', this.description);
    }
    emitEvent(this.eventMap, 'before-redo', uow);

    for (const op of this.operations) {
      const spec = UnitOfWorkManager.getSpec(op.trackableType);
      switch (op.type) {
        case 'add': {
          const type = `${op.parentType}-${op.trackableType}`;
          const pcSpec = mustExist(UnitOfWorkManager.parentChildSpecs[type]);
          pcSpec.addElement(this.diagram, op.parentId, op.id, op.afterSnapshot, op.idx, uow);
          break;
        }
        case 'remove': {
          const type = `${op.parentType}-${op.trackableType}`;
          const pcSpec = mustExist(UnitOfWorkManager.parentChildSpecs[type]);
          pcSpec.removeElement(this.diagram, op.parentId, op.id, uow);
          break;
        }
        case 'update':
          spec.updateElement(this.diagram, op.id, op.afterSnapshot, uow);
          break;
      }
    }

    emitEvent(this.eventMap, 'after-redo', uow);
  }

  merge(nextAction: UndoableAction): boolean {
    if (!(nextAction instanceof UnitOfWorkUndoableAction)) return false;

    if (
      nextAction.description === this.description &&
      hasSameElements(
        nextAction.operations.map(o => o.id),
        this.operations.map(o => o.id)
      ) &&
      Date.now() - this.timestamp!.getTime() < 2000
    ) {
      this.operations = this.consolidateOperations([...this.operations, ...nextAction.operations]);
      this.timestamp = new Date();
      return true;
    }

    return false;
  }

  private consolidateOperations(allOperations: UOWOperation[]) {
    // Collect all update operations by ID
    const updatesByIdMap = new MultiMap<string, UOWOperation & { type: 'update' }>();
    allOperations.filter(op => op.type === 'update').forEach(op => updatesByIdMap.add(op.id, op));

    const dest: Array<UOWOperation> = [];
    const processedIds = new Set<string>();
    allOperations.forEach(op => {
      if (op.type === 'update') {
        if (processedIds.has(op.id)) return;
        processedIds.add(op.id);

        const updates = updatesByIdMap.get(op.id) ?? [op];

        const first = updates[0]!;
        const last = updates.at(-1)!;
        dest.push({
          ...op,
          beforeSnapshot: first.beforeSnapshot,
          afterSnapshot: last.afterSnapshot
        });
      } else {
        dest.push(op);
      }
    });
    return dest;
  }
}
