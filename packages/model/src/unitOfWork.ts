import { assert, mustExist } from '@diagram-craft/utils/assert';
import type { Diagram } from './diagram';
import { newid } from '@diagram-craft/utils/id';
import { CompoundUndoableAction, UndoableAction } from '@diagram-craft/model/undoManager';
import { groupBy, hasSameElements } from '@diagram-craft/utils/array';
import { MultiMap } from '@diagram-craft/utils/multimap';
import { isDebug } from '@diagram-craft/utils/debug';
import { ArrayOrROArray, ArrayOrSingle } from '@diagram-craft/utils/types';

const remoteUnitOfWorkRegistry = new Map<string, UnitOfWork>();

export const getRemoteUnitOfWork = (diagram: Diagram) => {
  let uow = remoteUnitOfWorkRegistry.get(diagram.id);
  if (!uow) {
    uow = UnitOfWork.remote(diagram);
    remoteUnitOfWorkRegistry.set(diagram.id, uow);
    uow.on('before', 'commit', 'remoteCleanup', () => remoteUnitOfWorkRegistry.delete(diagram.id));
  }
  return uow;
};

export interface Snapshot {
  _snapshotType: string;
}

const NULL_SNAPSHOT: Snapshot = { _snapshotType: 'dummy' };

export interface UOWTrackable {
  _trackableType: string;
}

export interface UOWAdapter<S extends Snapshot, E extends UOWTrackable> {
  id(element: E): string;

  update: (diagram: Diagram, elementId: string, snapshot: S, uow: UnitOfWork) => void;

  onNotify?: (elements: Array<UOWOperation>, uow: UnitOfWork) => void;
  onBeforeCommit?: (elements: Array<UOWOperation>, uow: UnitOfWork) => void;
  onAfterCommit?: (elements: Array<UOWOperation>, uow: UnitOfWork) => void;

  snapshot: (element: E) => S;
  restore: (snapshot: S, element: E, uow: UnitOfWork) => void;
}

export interface UOWChildAdapter<S extends Snapshot> {
  add: (d: Diagram, pId: string, cId: string, cS: S, idx: number, uow: UnitOfWork) => void;
  remove: (d: Diagram, pId: string, cId: string, uow: UnitOfWork) => void;
}

const registry = new FinalizationRegistry((v: string) => {
  // No warnings for throwaways
  if (v.startsWith('true;')) return;
  if (process.env.NODE_ENV === 'development') console.error('Failed uow cleanup', v.substring(5));
});

declare global {
  namespace DiagramCraft {
    interface UnitOfWorkMetadata {
      nonDirty?: boolean;
    }
  }
}

export type UOWOperation = { notified?: boolean } & (
  | {
      type: 'add';
      target: { object: UOWTrackable; id: string; type: string };
      parent: { id: string; type: string };
      idx: number;
      afterSnapshot: Snapshot;
    }
  | {
      type: 'remove';
      target: { object: UOWTrackable; id: string; type: string };

      idx: number;
      parent: { id: string; type: string };
      beforeSnapshot: Snapshot;
    }
  | {
      type: 'update';
      target: { object: UOWTrackable; id: string; type: string };

      beforeSnapshot: Snapshot;
      afterSnapshot: Snapshot;
    }
);

type UOWEventMap = Map<string, Map<string, (uow: UnitOfWork) => void>>;

/**
 * Begin tracking an operation on an element within the UnitOfWork.
 * Only for debugging
 */
const beginOperation = (uow: UnitOfWork, type: UOWOperation['type'], element: UOWTrackable) => {
  // biome-ignore lint/suspicious/noExplicitAny: debugging only
  let s = (uow.metadata as any).__operations as Set<string>;
  if (!s) {
    s = new Set();
    // biome-ignore lint/suspicious/noExplicitAny: debugging only
    (uow.metadata as any).__operations = s;
  }

  const adapter = UOWRegistry.getAdapter(element._trackableType);
  const key = `${type}-${element._trackableType}-${adapter.id(element)}`;
  if (s.has(key)) assert.fail(`Duplicate nested operation: ${key}`);

  s!.add(`${type}-${element._trackableType}`);
};

/**
 * End tracking an operation on an element within the UnitOfWork.
 * Only for debugging
 */
const endOperation = (uow: UnitOfWork, type: UOWOperation['type'], element: UOWTrackable) => {
  // biome-ignore lint/suspicious/noExplicitAny: debugging only
  const s = (uow.metadata as any).__operations as Set<string>;
  if (!s) return;

  const adapter = UOWRegistry.getAdapter(element._trackableType);
  const key = `${type}-${element._trackableType}-${adapter.id(element)}`;
  s.delete(key);
};

const consolidateOperations = (allOperations: UOWOperation[]) => {
  // Collect all update operations by ID
  const updatesByIdMap = new MultiMap<string, UOWOperation & { type: 'update' }>();
  allOperations
    .filter(op => op.type === 'update')
    .forEach(op => updatesByIdMap.add(op.target.id, op));

  const dest: Array<UOWOperation> = [];
  const processedIds = new Set<string>();
  allOperations.forEach(op => {
    if (op.type === 'update') {
      if (processedIds.has(op.target.id)) return;
      processedIds.add(op.target.id);

      const updates = updatesByIdMap.get(op.target.id) ?? [op];

      dest.push({
        ...op,
        beforeSnapshot: updates[0]!.beforeSnapshot,
        afterSnapshot: updates.at(-1)!.afterSnapshot
      });
    } else {
      dest.push(op);
    }
  });
  return dest;
};

export class UnitOfWork {
  uid = newid();

  state: 'pending' | 'committed' | 'aborted' = 'pending';
  metadata: DiagramCraft.UnitOfWorkMetadata = {};

  #operations: Array<UOWOperation> = [];
  #updates = new Set<string>();
  #undoableActions: Array<UndoableAction> = [];
  #callbacks: UOWEventMap = new Map<string, Map<string, (uow: UnitOfWork) => void>>();

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

  add(action: UndoableAction) {
    this.#undoableActions.push(action);
  }

  private snapshot(element: UOWTrackable) {
    if (!this.trackChanges) return NULL_SNAPSHOT;

    const adapter = UOWRegistry.getAdapter(element._trackableType);
    return adapter.snapshot(element);
  }

  contains(element: UOWTrackable, type?: 'update' | 'remove' | 'add') {
    return this.#operations.some(
      e => (e.target.object === element && type === undefined) || e.type === type
    );
  }

  executeUpdate<T>(element: UOWTrackable, cb: () => T): T {
    DEBUG: {
      beginOperation(this, 'update', element);
    }
    try {
      const snapshot = this.snapshot(element);

      const res = cb();
      this.updateElement(element, snapshot);

      return res;
    } finally {
      DEBUG: {
        endOperation(this, 'update', element);
      }
    }
  }

  executeRemove<T>(element: UOWTrackable, parent: UOWTrackable, idx: number, cb: () => T) {
    assert.true(idx >= 0);

    DEBUG: {
      beginOperation(this, 'remove', element);
    }

    try {
      this.removeElement(element, parent, idx);
      return cb();
    } finally {
      DEBUG: {
        endOperation(this, 'remove', element);
      }
    }
  }

  executeAdd<T>(
    element: ArrayOrSingle<UOWTrackable>,
    parent: UOWTrackable,
    idx: number,
    cb: () => T
  ) {
    assert.true(idx >= 0);

    DEBUG: {
      (Array.isArray(element) ? element : [element]).forEach(e => beginOperation(this, 'add', e));
    }

    try {
      const res = cb();
      this.addElement(element, parent, idx);
      return res;
    } finally {
      DEBUG: {
        (Array.isArray(element) ? element : [element]).forEach(e => endOperation(this, 'add', e));
      }
    }
  }

  updateElement(element: UOWTrackable, snapshot?: Snapshot) {
    const adapter = UOWRegistry.getAdapter(element._trackableType);
    const id = adapter.id(element);

    assert.true(
      !this.trackChanges || snapshot !== undefined,
      'Must create snapshot before updating element'
    );

    this.#updates.add(id);

    this.#operations.push({
      type: 'update',
      target: { object: element, id, type: element._trackableType },
      beforeSnapshot: snapshot ?? NULL_SNAPSHOT,
      afterSnapshot: this.trackChanges ? adapter.snapshot(element) : NULL_SNAPSHOT
    });
  }

  removeElement(element: UOWTrackable, parent: UOWTrackable, idx: number) {
    if (Array.isArray(element)) {
      element.forEach(e => this.removeElement(e, parent, idx));
      return;
    }

    const adapter = UOWRegistry.getAdapter(element._trackableType);
    const parentAdapter = UOWRegistry.getAdapter(parent._trackableType);
    this.#operations.push({
      type: 'remove',
      target: { id: adapter.id(element), object: element, type: element._trackableType },
      idx: idx,
      parent: { id: parentAdapter.id(parent), type: parent._trackableType },
      beforeSnapshot: this.trackChanges ? adapter.snapshot(element) : NULL_SNAPSHOT
    });
  }

  addElement(element: ArrayOrSingle<UOWTrackable>, parent: UOWTrackable, idx: number) {
    if (Array.isArray(element)) {
      element.forEach((e, i) => this.addElement(e, parent, idx + i));
      return;
    }

    const adapter = UOWRegistry.getAdapter(element._trackableType);
    const parentAdapter = UOWRegistry.getAdapter(parent._trackableType);
    const id = adapter.id(element);

    // Determine out-of-order updates
    const updatesToBeReordered: Array<UOWOperation> = [];
    if (this.#updates.has(id) && this.trackChanges) {
      let removingUpdates = true;
      const newOperations: Array<UOWOperation> = [];
      for (let i = this.#operations.length - 1; i >= 0; i--) {
        const e = this.#operations[i]!;

        if (removingUpdates && e.target.id === id) {
          if (e.type === 'update') {
            updatesToBeReordered.push(e);
            continue;
          }

          removingUpdates = false;
        }

        newOperations.push(e);
      }

      if (updatesToBeReordered.length > 0) {
        console.warn('Out-of-order updates detected');
        console.log(new Error().stack);
        this.#operations = newOperations;
      }
    }

    this.#operations.push({
      type: 'add',
      target: { id, object: element, type: element._trackableType },
      idx: idx,
      parent: { id: parentAdapter.id(parent), type: parent._trackableType },
      afterSnapshot: this.trackChanges ? adapter.snapshot(element) : NULL_SNAPSHOT
    });

    if (updatesToBeReordered.length > 0) {
      this.#operations.push(...updatesToBeReordered);
    }
  }

  select(diagram: Diagram, after: ArrayOrROArray<{ id: string } | string>) {
    const beforeIds = diagram.selection.elements.map(e => e.id);
    const afterIds = after.map(e => (typeof e === 'string' ? e : e.id));
    diagram.selection.setElementIds(afterIds);
    this.on('after', 'redo', newid(), () => diagram.selection.setElementIds(afterIds));
    this.on('after', 'undo', newid(), () => diagram.selection.setElementIds(beforeIds));
  }

  on(
    when: 'after' | 'before',
    event: 'undo' | 'redo' | 'commit',
    id: string,
    callback: (uow: UnitOfWork) => void
  ) {
    if (this.isThrowaway) {
      if (event === 'commit') callback(this);
      return;
    }

    const eventKey = `${when}-${event}`;
    if (!this.#callbacks.has(eventKey)) this.#callbacks.set(eventKey, new Map());
    this.#callbacks.get(eventKey)!.set(id, callback);
  }

  notify() {
    for (const [k, ops] of groupBy(
      this.#operations.filter(op => op.notified !== true),
      op => op.target.type
    )) {
      UOWRegistry.getAdapter(k).onNotify?.(ops, this);
      ops.forEach(op => (op.notified = true));
    }
  }

  commit() {
    this.state = 'committed';

    this.emitEvent('before-commit');

    for (const [k, ops] of groupBy(this.#operations, op => op.target.type)) {
      UOWRegistry.getAdapter(k).onBeforeCommit?.(ops, this);
    }

    for (const [k, ops] of groupBy(this.#operations, op => op.target.type)) {
      UOWRegistry.getAdapter(k).onNotify?.(ops, this);
      UOWRegistry.getAdapter(k).onAfterCommit?.(ops, this);
    }

    this.emitEvent('after-commit');

    registry.unregister(this);
  }

  commitWithUndo(msg: string) {
    this.commit();

    if (this.#undoableActions.length > 0) {
      const action = new CompoundUndoableAction(this.#undoableActions, msg);
      action.add(new UOWUndoableAction(msg, this.diagram, this.#operations, this.#callbacks));
      this.diagram.undoManager.add(action);
    } else if (this.#operations.length === 0) {
      return;
    } else {
      this.diagram.undoManager.add(
        new UOWUndoableAction(msg, this.diagram, this.#operations, this.#callbacks)
      );
    }
  }

  abort() {
    registry.unregister(this);
    this.state = 'aborted';
  }

  private emitEvent(key: string) {
    const eventCallbacks = this.#callbacks.get(key);
    if (eventCallbacks === undefined) return;

    let emitCount: number;
    do {
      emitCount = 0;
      for (const [key, callback] of eventCallbacks.entries()) {
        callback(this);
        eventCallbacks.delete(key);
        emitCount++;
      }
    } while (emitCount > 0);
  }
}

export class UOWRegistry {
  // biome-ignore lint/suspicious/noExplicitAny: Need any in this case
  static adapters: Record<string, UOWAdapter<any, any>> = {};
  // biome-ignore lint/suspicious/noExplicitAny: Need any in this case
  static childAdapters: Record<string, UOWChildAdapter<any>> = {};

  static getAdapter(trackableType: string): UOWAdapter<Snapshot, UOWTrackable> {
    return mustExist(UOWRegistry.adapters[trackableType]);
  }

  static getChildAdapter(parent: string, child: string): UOWChildAdapter<Snapshot> {
    return mustExist(UOWRegistry.childAdapters[`${parent}-${child}`]);
  }
}

class UOWUndoableAction implements UndoableAction {
  timestamp?: Date;

  constructor(
    public readonly description: string,
    private readonly diagram: Diagram,
    private ops: Array<UOWOperation>,
    private eventMap: UOWEventMap
  ) {
    this.ops = consolidateOperations(this.ops);
  }

  undo(uow: UnitOfWork) {
    if (isDebug()) {
      console.log('------------------------------------');
      console.log('Undoing', this.description);
    }
    this.emitEvent(this.eventMap, 'before-undo', uow);

    for (const op of this.ops.toReversed()) {
      const adapter = UOWRegistry.getAdapter(op.target.type);
      switch (op.type) {
        case 'remove': {
          if (isDebug()) {
            console.log(
              `Adding child ${op.target.type}/${op.target.id} to parent ${op.parent.type}/${op.parent.id} at idx ${op.idx}`
            );
          }
          const cAdapter = UOWRegistry.getChildAdapter(op.parent.type, op.target.type);
          cAdapter.add(this.diagram, op.parent.id, op.target.id, op.beforeSnapshot, op.idx, uow);
          break;
        }
        case 'add': {
          if (isDebug()) {
            console.log(
              `Removing child ${op.target.type}/${op.target.id} from parent ${op.parent.type}/${op.parent.id} at idx ${op.idx}`
            );
          }
          const adapter = UOWRegistry.getChildAdapter(op.parent.type, op.target.type);
          adapter.remove(this.diagram, op.parent.id, op.target.id, uow);
          break;
        }
        case 'update':
          if (isDebug()) console.log(`Updating ${op.target.type}/${op.target.id}`);
          adapter.update(this.diagram, op.target.id, op.beforeSnapshot, uow);
          break;
      }
    }

    this.emitEvent(this.eventMap, 'after-undo', uow);
  }

  redo(uow: UnitOfWork) {
    if (isDebug()) {
      console.log('------------------------------------');
      console.log('Redoing', this.description);
    }
    this.emitEvent(this.eventMap, 'before-redo', uow);

    for (const op of this.ops) {
      const adapter = UOWRegistry.getAdapter(op.target.type);
      switch (op.type) {
        case 'add': {
          if (isDebug()) {
            console.log(
              `Adding child ${op.target.type}/${op.target.id} to parent ${op.parent.type}/${op.parent.id} at idx ${op.idx}`
            );
          }
          const cAdapter = UOWRegistry.getChildAdapter(op.parent.type, op.target.type);
          cAdapter.add(this.diagram, op.parent.id, op.target.id, op.afterSnapshot, op.idx, uow);
          break;
        }
        case 'remove': {
          if (isDebug()) {
            console.log(
              `Removing child ${op.target.type}/${op.target.id} from parent ${op.parent.type}/${op.parent.id} at idx$ {op.idx}`
            );
          }
          const cAdapter = UOWRegistry.getChildAdapter(op.parent.type, op.target.type);
          cAdapter.remove(this.diagram, op.parent.id, op.target.id, uow);
          break;
        }
        case 'update':
          if (isDebug()) console.log(`Updating ${op.target.type}/${op.target.id}`);
          adapter.update(this.diagram, op.target.id, op.afterSnapshot, uow);
          break;
      }
    }

    this.emitEvent(this.eventMap, 'after-redo', uow);
  }

  merge(next: UndoableAction): boolean {
    if (!(next instanceof UOWUndoableAction)) return false;

    if (
      next.description === this.description &&
      hasSameElements(
        next.ops.map(o => o.target.id),
        this.ops.map(o => o.target.id)
      ) &&
      Date.now() - this.timestamp!.getTime() < 2000
    ) {
      this.ops = consolidateOperations([...this.ops, ...next.ops]);
      this.timestamp = new Date();
      return true;
    }

    return false;
  }

  private emitEvent(map: UOWEventMap, key: string, uow: UnitOfWork) {
    const eventCallbacks = map.get(key);
    if (eventCallbacks === undefined) return;

    for (const callback of eventCallbacks.values()) {
      callback(uow);
    }
  }
}
