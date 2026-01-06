import type { DiagramElement } from './diagramElement';
import { assert, mustExist } from '@diagram-craft/utils/assert';
import { SerializedEdge, SerializedNode } from './serialization/serializedTypes';
import type { Stylesheet, StylesheetType } from './diagramStyles';
import type { Layer, LayerType } from './diagramLayer';
import type { Diagram } from './diagram';
import type { AdjustmentRule } from './diagramLayerRuleTypes';
import { newid } from '@diagram-craft/utils/id';
import type { ModificationCRDT } from './diagramLayerModification';
import type { EdgeProps, NodeProps } from './diagramProps';
import { SnapshotUndoableAction } from '@diagram-craft/model/diagramUndoActions';
import { CompoundUndoableAction, UndoableAction } from '@diagram-craft/model/undoManager';
import type { LayerManager } from '@diagram-craft/model/diagramLayerManager';
import { UnitOfWorkManager } from '@diagram-craft/model/unitOfWorkManager';
import { hasSameElements } from '@diagram-craft/utils/array';

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
  elements: string[];
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
  //  snapshot(): T;
  //  restore(snapshot: T, uow: UnitOfWork): void;
}

// biome-ignore lint/suspicious/noExplicitAny: false positive
export type Trackable = (DiagramElement | Layer | LayerManager | Stylesheet<any>) & UOWTrackable;

export class ElementsSnapshot {
  constructor(readonly snapshots: Map<string, undefined | Snapshot>) {}

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
      } else if (this.snapshots.get(k)?._snapshotType === 'stylesheet') {
        dest.set(k, diagram.document.styles.get(k)!.snapshot());
      } else {
        const element = diagram.lookup(k);
        if (!element) continue;
        dest.set(k, element.snapshot());
      }
    }
    return new ElementsSnapshot(dest);
  }
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
      trackable: Trackable;
      trackableType: Trackable['trackableType'];

      idx: number;
      parentId: string;
      afterSnapshot: Snapshot;
    }
  | {
      type: 'remove';
      id: string;
      trackable: Trackable;
      trackableType: Trackable['trackableType'];

      idx: number;
      parentId: string;
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

  #elements: Array<UOWOperation> = [];
  #invalidatedElements = new Set<Trackable>();
  #state: 'pending' | 'committed' | 'aborted' = 'pending';

  #shouldUpdateDiagram = false;

  #snapshots = new Map<string, undefined | Snapshot>();

  #onCommitCallbacks = new Map<string, ActionCallback>();

  #undoableActions: UndoableAction[] = [];

  changeType: ChangeType = 'non-interactive';

  metadata: DiagramCraft.UnitOfWorkMetadata = {};

  private constructor(
    readonly diagram: Diagram,
    public trackChanges: boolean = false,
    public isThrowaway: boolean = false,
    public isRemote: boolean = false
  ) {
    registry.register(this, `${this.isThrowaway.toString()};${new Error().stack}`, this);
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

  static executeSilently<T>(diagram: Diagram, cb: (uow: UnitOfWork) => T): T {
    const uow = new UnitOfWork(diagram);
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

  get state() {
    return this.#state;
  }

  add(action: UndoableAction) {
    this.#undoableActions.push(action);
  }

  addAndExecute(action: UndoableAction) {
    action.redo(this);
    this.#undoableActions.push(action);
  }

  snapshot(element: Trackable) {
    if (!this.trackChanges) return;
    if (this.#snapshots.has(element.id)) return;

    const spec = UnitOfWorkManager.trackableSpecs[element.trackableType];
    this.#snapshots.set(element.id, spec.snapshot(element));
  }

  hasBeenInvalidated(element: Trackable) {
    return this.#invalidatedElements.has(element);
  }

  beginInvalidation(element: Trackable) {
    this.#invalidatedElements.add(element);
  }

  contains(element: Trackable, type?: 'update' | 'remove') {
    return this.#elements.some(
      e => (e.trackable === element && type === undefined) || e.type === type
    );
  }

  updateElement(element: Trackable) {
    assert.true(
      !this.trackChanges || this.#snapshots.has(element.id),
      'Must create snapshot before updating element'
    );

    const spec = UnitOfWorkManager.trackableSpecs[element.trackableType];
    this.#elements.push({
      type: 'update',
      id: element.id,
      trackable: element,
      trackableType: element.trackableType,
      beforeSnapshot: this.#snapshots.get(element.id)!,
      afterSnapshot: spec.snapshot(element)
    });
  }

  removeElement(element: Trackable, parent: Trackable, idx: number) {
    /*if (_idx === -1) {
      console.warn('Removing element from invalid index', element.trackableType, element.id, _idx);
    }*/
    assert.true(
      !this.trackChanges || this.#snapshots.has(element.id),
      'Must create snapshot before removing element'
    );
    this.#elements.push({
      type: 'remove',
      id: element.id,
      trackable: element,
      trackableType: element.trackableType,
      idx: idx,
      parentId: parent.id,
      beforeSnapshot: this.#snapshots.get(element.id)!
    });
  }

  addElement(element: Trackable, parent: Trackable, idx: number) {
    /*if (_idx === -1) {
      console.warn('Adding element to invalid index', element);
    }*/
    if (this.trackChanges && !this.#snapshots.has(element.id)) {
      this.#snapshots.set(element.id, undefined);
    }
    const spec = UnitOfWorkManager.trackableSpecs[element.trackableType];
    this.#elements.push({
      type: 'add',
      id: element.id,
      trackable: element,
      trackableType: element.trackableType,
      idx: idx,
      parentId: parent.id,
      afterSnapshot: spec.snapshot(element)
    });
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
    this.#state = 'committed';
    this.changeType = 'non-interactive';

    // Note, onCommitCallbacks must run before elements events are emitted
    this.processOnCommitCallbacks();
    this.processEvents();

    if (this.#shouldUpdateDiagram) {
      this.diagram.emit('diagramChange', { diagram: this.diagram });
    }

    registry.unregister(this);

    return new ElementsSnapshot(this.#snapshots);
  }

  commitWithUndo(description: string) {
    const snapshots = this.commit();

    if (this.#undoableActions.length > 0) {
      const compound = new CompoundUndoableAction(this.#undoableActions, description);
      if (snapshots.snapshots.size > 0) {
        compound.addAction(new SnapshotUndoableAction(description, this.diagram, snapshots));
      }
      if (compound.hasActions()) {
        this.diagram.undoManager.add(compound);
      }
    } else {
      if (snapshots.snapshots.size > 0) {
        this.diagram.undoManager.add(
          new SnapshotUndoableAction(description, this.diagram, snapshots)
        );
      }
    }
  }

  abort() {
    registry.unregister(this);
    this.#state = 'aborted';
  }

  private processEvents() {
    // At this point, any elements have been added and or removed
    if (!this.isRemote) {
      const handled = new Set<string>();
      this.#elements.forEach(({ trackable }) => {
        if (handled.has(trackable.id)) return;
        trackable.invalidate(this);
        handled.add(trackable.id);
      });
    }

    const handle = (s: 'add' | 'remove' | 'update') => (e: Trackable) => {
      if (e.trackableType === 'layerManager') {
        this.diagram.layers.emit('layerStructureChange', {});
      } else if (e.trackableType === 'layer') {
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
      } else if (e.trackableType === 'stylesheet') {
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
              stylesheet: e.id
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
    this.#elements.forEach(({ trackable, type }) => {
      const key = type + '/' + trackable.id;
      if (handled.has(key)) return;
      handle(type)(trackable);
      handled.add(key);
    });

    this.diagram.emit('elementBatchChange', {
      removed: [...this.removed].filter(e => e.trackableType === 'element') as DiagramElement[],
      updated: [...this.updated].filter(e => e.trackableType === 'element') as DiagramElement[],
      added: [...this.added].filter(e => e.trackableType === 'element') as DiagramElement[]
    });

    this.#elements.length = 0;
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
    return new Set([...this.#elements.filter(e => e.type === 'add').map(e => e.trackable)]);
  }

  private get updated() {
    return new Set([...this.#elements.filter(e => e.type === 'update').map(e => e.trackable)]);
  }

  private get removed() {
    return new Set([...this.#elements.filter(e => e.type === 'remove').map(e => e.trackable)]);
  }

  stopTracking() {
    this.trackChanges = false;
  }

  updateDiagram() {
    this.#shouldUpdateDiagram = true;
  }
}

class UnitOfWorkUndoableAction implements UndoableAction {
  timestamp?: Date;

  constructor(
    public readonly description: string,
    private readonly diagram: Diagram,
    private operations: Array<UOWOperation>
  ) {}

  undo(uow: UnitOfWork) {
    for (const op of this.operations.reverse()) {
      const spec = UnitOfWorkManager.trackableSpecs[op.trackableType];
      if (op.trackableType === 'layerManager') {
        switch (op.type) {
          case 'remove': {
            const pcSpec = mustExist(UnitOfWorkManager.parentChildSpecs['layerManager-layer']);
            pcSpec.addElement(this.diagram, op.parentId, op.id, op.beforeSnapshot, -1, uow);
            break;
          }
          case 'add': {
            const pcSpec = mustExist(UnitOfWorkManager.parentChildSpecs['layerManager-layer']);
            pcSpec.removeElement(this.diagram, op.parentId, op.id, uow);
            break;
          }
          case 'update':
            spec.updateElement(this.diagram, op.id, op.beforeSnapshot, uow);
            break;
        }
      } else {
        switch (op.type) {
          case 'update':
            spec.updateElement(this.diagram, op.id, op.beforeSnapshot, uow);
            break;
          default:
            break;
        }
      }
    }
  }

  redo(uow: UnitOfWork) {
    for (const op of this.operations) {
      const spec = UnitOfWorkManager.trackableSpecs[op.trackableType];
      if (op.trackableType === 'layerManager') {
        switch (op.type) {
          case 'add': {
            const pcSpec = mustExist(UnitOfWorkManager.parentChildSpecs['layerManager-layer']);
            pcSpec.addElement(this.diagram, op.parentId, op.id, op.afterSnapshot, -1, uow);
            break;
          }
          case 'remove': {
            const pcSpec = mustExist(UnitOfWorkManager.parentChildSpecs['layerManager-layer']);
            pcSpec.removeElement(this.diagram, op.parentId, op.id, uow);
            break;
          }
          case 'update':
            spec.updateElement(this.diagram, op.id, op.afterSnapshot, uow);
            break;
        }
      } else {
        switch (op.type) {
          case 'update':
            spec.updateElement(this.diagram, op.id, op.afterSnapshot, uow);
            break;
          default:
            break;
        }
      }
    }
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
      this.operations = [...this.operations, ...nextAction.operations];
      this.timestamp = new Date();
      return true;
    }

    return false;
  }
}
