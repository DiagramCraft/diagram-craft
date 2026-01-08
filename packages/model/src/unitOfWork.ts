import type { DiagramElement } from './diagramElement';
import { assert, mustExist } from '@diagram-craft/utils/assert';
import { SerializedEdge, SerializedNode } from './serialization/serializedTypes';
import type { DiagramStyles, Stylesheet, StylesheetType } from './diagramStyles';
import type { Layer, LayerType } from './diagramLayer';
import type { Diagram } from './diagram';
import type { AdjustmentRule } from './diagramLayerRuleTypes';
import { newid } from '@diagram-craft/utils/id';
import type { ModificationCRDT } from './diagramLayerModification';
import type { EdgeProps, NodeProps } from './diagramProps';
import { CompoundUndoableAction, UndoableAction } from '@diagram-craft/model/undoManager';
import type { LayerManager } from '@diagram-craft/model/diagramLayerManager';
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

export type LayersSnapshot = {
  _snapshotType: 'layers';
  layers: string[];
};

export type LayerSnapshot = {
  _snapshotType: 'layer';
  name: string;
  locked: boolean;
  elements?: string[];
  type: LayerType;
  rules?: AdjustmentRule[];
  modifications?: Array<Pick<ModificationCRDT, 'id' | 'type'> & { elementId?: string }>;
};

export type DiagramNodeSnapshot = Omit<SerializedNode, 'children'> & {
  _snapshotType: 'node';
  parentId?: string;
  children: string[];
};

export type DiagramEdgeSnapshot = SerializedEdge & {
  _snapshotType: 'edge';
};

export type StylesheetSnapshot = {
  id: string;
  name: string;
  props: NodeProps | EdgeProps;
  type: StylesheetType;
  _snapshotType: 'stylesheet';
};

type Snapshot = { _snapshotType: string } & (
  | LayersSnapshot
  | LayerSnapshot
  | DiagramNodeSnapshot
  | DiagramEdgeSnapshot
  | StylesheetSnapshot
);

export interface UOWTrackableSpecification<S extends Snapshot, E> {
  updateElement: (diagram: Diagram, elementId: string, snapshot: S, uow: UnitOfWork) => void;

  onBeforeCommit: (elements: Array<E>, uow: UnitOfWork) => void;
  onAfterCommit: (elements: Array<E>, uow: UnitOfWork) => void;

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

export interface UOWTrackable {
  id: string;
  trackableType: string;
  invalidate(uow: UnitOfWork): void;
}

// biome-ignore lint/suspicious/noExplicitAny: false positive
export type Trackable = (DiagramElement | Layer | LayerManager | Stylesheet<any> | DiagramStyles) &
  UOWTrackable;

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
      trackable: Trackable;
      trackableType: Trackable['trackableType'];

      idx: number;
      parentId: string;
      parentType: string;
      afterSnapshot: Snapshot;
    }
  | {
      type: 'remove';
      id: string;
      trackable: Trackable;
      trackableType: Trackable['trackableType'];

      idx: number;
      parentId: string;
      parentType: string;
      beforeSnapshot: Snapshot;
    }
  | {
      type: 'update';
      id: string;
      trackable: Trackable;
      trackableType: Trackable['trackableType'];

      beforeSnapshot: Snapshot;
      afterSnapshot: Snapshot;
    };

export class UnitOfWork {
  uid = newid();

  #operations: Array<UOWOperation> = [];
  #updates = new Set<string>();
  #invalidatedElements = new Set<Trackable>();
  #snapshots = new MultiMap<string, undefined | Snapshot>();
  #onCommitCallbacks = new Map<string, ActionCallback>();
  #undoableActions: Array<UndoableAction> = [];
  #callbacks = new MultiMap<string, (uow: UnitOfWork) => void>();

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

  private snapshot(element: Trackable) {
    if (!this.trackChanges) return;

    const spec = UnitOfWorkManager.trackableSpecs[element.trackableType];
    const s = spec.snapshot(element);
    this.#snapshots.add(element.id, s);
    return s;
  }

  hasBeenInvalidated(element: Trackable) {
    return this.#invalidatedElements.has(element);
  }

  beginInvalidation(element: Trackable) {
    this.#invalidatedElements.add(element);
  }

  contains(element: Trackable, type?: 'update' | 'remove' | 'add') {
    return this.#operations.some(
      e => (e.trackable === element && type === undefined) || e.type === type
    );
  }

  executeUpdate<T>(element: Trackable, cb: () => T): T {
    const snapshot = this.snapshot(element);

    const res = cb();

    this.updateElement(element, snapshot);

    return res;
  }

  executeRemove<T>(element: ArrayOrSingle<Trackable>, parent: Trackable, idx: number, cb: () => T) {
    /*if (_idx === -1) {
      console.warn('Removing element from invalid index', element.trackableType, element.id, _idx);
    }*/

    this.removeElement(element, parent, idx);

    return cb();
  }

  executeAdd<T>(element: ArrayOrSingle<Trackable>, parent: Trackable, idx: number, cb: () => T) {
    /*if (_idx === -1) {
      console.warn('Adding element to invalid index', element);
    }*/

    const res = cb();

    this.addElement(element, parent, idx);

    return res;
  }

  updateElement(element: Trackable, snapshot?: Snapshot) {
    const effectiveSnapshot = snapshot ?? this.#snapshots.get(element.id)!.at(-1)!;
    assert.true(
      !this.trackChanges || effectiveSnapshot !== undefined,
      'Must create snapshot before updating element'
    );

    this.#updates.add(element.id);

    const spec = UnitOfWorkManager.trackableSpecs[element.trackableType];
    this.#operations.push({
      type: 'update',
      id: element.id,
      trackable: element,
      trackableType: element.trackableType,
      beforeSnapshot: effectiveSnapshot,
      afterSnapshot: this.trackChanges ? spec.snapshot(element) : undefined
    });
  }

  removeElement(element: ArrayOrSingle<Trackable>, parent: Trackable, idx: number) {
    if (Array.isArray(element)) {
      element.forEach(e => this.removeElement(e, parent, idx));
      return;
    }

    /*if (_idx === -1) {
      console.warn('Removing element from invalid index', element.trackableType, element.id, _idx);
    }*/
    const spec = UnitOfWorkManager.trackableSpecs[element.trackableType];
    this.#operations.push({
      type: 'remove',
      id: element.id,
      trackable: element,
      trackableType: element.trackableType,
      idx: idx,
      parentId: parent.id,
      parentType: parent.trackableType,
      beforeSnapshot: this.trackChanges ? spec.snapshot(element) : undefined
    });
  }

  addElement(element: ArrayOrSingle<Trackable>, parent: Trackable, idx: number) {
    if (Array.isArray(element)) {
      element.forEach(e => this.addElement(e, parent, idx));
      return;
    }

    /*if (_idx === -1) {
      console.warn('Adding element to invalid index', element);
    }*/
    if (this.trackChanges && !this.#snapshots.has(element.id)) {
      this.#snapshots.add(element.id, undefined);
    }

    let existingUpdates: Array<UOWOperation> = [];

    if (this.#updates.has(element.id) && this.trackChanges) {
      const isUpdate = (e: UOWOperation) => e.id === element.id && e.type === 'update';

      // Need to make sure all updates happen *after* the add
      existingUpdates = this.#operations.filter(isUpdate);
      if (existingUpdates.length > 0) {
        this.#operations = this.#operations.filter(e => !isUpdate(e));
      }
    }

    const spec = UnitOfWorkManager.trackableSpecs[element.trackableType];
    this.#operations.push({
      type: 'add',
      id: element.id,
      trackable: element,
      trackableType: element.trackableType,
      idx: idx,
      parentId: parent.id,
      parentType: parent.trackableType,
      afterSnapshot: this.trackChanges ? spec.snapshot(element) : undefined
    });

    if (existingUpdates.length > 0) {
      this.#operations.push(...existingUpdates);
    }
  }

  select(diagram: Diagram, after: string[]) {
    const before = diagram.selection.elements.map(e => e.id);
    diagram.selection.setElementIds(after);
    this.on('after', 'redo', () => diagram.selection.setElementIds(after));
    this.on('after', 'undo', () => diagram.selection.setElementIds(before));
  }

  on(
    when: 'after' | 'before',
    event: 'undo' | 'redo' | 'commit',
    callback: (uow: UnitOfWork) => void
  ) {
    if (this.isThrowaway) return;

    this.#callbacks.add(`${when}-${event}`, callback);
  }

  /**
   * Register a callback to be executed after the commit phase. It's coalesced
   * so that only one callback is executed per element/operation per commit phase.
   */
  registerOnCommitCallback(name: string, element: Trackable | undefined, cb: ActionCallback) {
    if (this.isThrowaway) {
      return cb();
    }

    const id = name + (element?.id ?? '');
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

    this.#callbacks.get('before-commit')?.forEach(cb => cb(this));

    // Note, onCommitCallbacks must run before elements events are emitted
    this.processOnCommitCallbacks();
    this.processEvents();

    registry.unregister(this);

    this.#callbacks.get('after-commit')?.forEach(cb => cb(this));
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
        if (handled.has(trackable.id)) return;
        trackable.invalidate(this);
        handled.add(trackable.id);
      });
    }

    const handle = (s: 'add' | 'remove' | 'update') => (type: string, id: string, e: Trackable) => {
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
      const key = type + '/' + trackable.id;
      if (handled.has(key)) return;
      handle(type)(trackableType, id, trackable);
      handled.add(key);
    });

    this.diagram.emit('elementBatchChange', {
      removed: [...this.removed].filter(e => e.trackableType === 'element') as DiagramElement[],
      updated: [...this.updated].filter(e => e.trackableType === 'element') as DiagramElement[],
      added: [...this.added].filter(e => e.trackableType === 'element') as DiagramElement[]
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
    private callbacks: MultiMap<string, (uow: UnitOfWork) => void>
  ) {
    this.operations = this.consolidateOperations(this.operations);
  }

  undo(uow: UnitOfWork) {
    if (isDebug()) {
      console.log('------------------------------------');
      console.log('Undoing', this.description);
    }
    this.callbacks.get('before-undo')?.forEach(cb => cb(uow));

    for (const op of this.operations.toReversed()) {
      const spec = UnitOfWorkManager.trackableSpecs[op.trackableType];
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

    this.callbacks.get('after-undo')?.forEach(cb => cb(uow));
  }

  redo(uow: UnitOfWork) {
    if (isDebug()) {
      console.log('------------------------------------');
      console.log('Redoing', this.description);
    }
    this.callbacks.get('before-redo')?.forEach(cb => cb(uow));

    for (const op of this.operations) {
      const spec = UnitOfWorkManager.trackableSpecs[op.trackableType];
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

    this.callbacks.get('after-redo')?.forEach(cb => cb(uow));
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
