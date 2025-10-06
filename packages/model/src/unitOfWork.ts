import type { DiagramElement } from './diagramElement';
import { assert } from '@diagram-craft/utils/assert';
import { SerializedEdge, SerializedNode } from './serialization/types';
import type { Stylesheet, StylesheetType } from './diagramStyles';
import type { Layer, LayerType } from './diagramLayer';
import type { Diagram } from './diagram';
import type { AdjustmentRule } from './diagramLayerRuleTypes';
import type { LayerManager } from './diagramLayerManager';
import { newid } from '@diagram-craft/utils/id';

type ActionCallback = () => void;

type ChangeType = 'interactive' | 'non-interactive';

const remoteUnitOfWorkRegistry = new Map<string, UnitOfWork>();

export const getRemoteUnitOfWork = (diagram: Diagram) => {
  let uow = remoteUnitOfWorkRegistry.get(diagram.id);
  if (!uow) {
    uow = new UnitOfWork(diagram, false, false, true);
    remoteUnitOfWorkRegistry.set(diagram.id, uow);
    uow.registerOnCommitCallback('remoteCleanup', undefined, () => {
      remoteUnitOfWorkRegistry.delete(diagram.id);
    });
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

export interface UOWTrackable<T extends Snapshot> {
  id: string;
  invalidate(uow: UnitOfWork): void;
  snapshot(): T;
  restore(snapshot: T, uow: UnitOfWork): void;
}

// biome-ignore lint/suspicious/noExplicitAny: false positive
type Trackable = (DiagramElement | Layer | LayerManager | Stylesheet<any>) & UOWTrackable<Snapshot>;

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

export class UnitOfWork {
  uid = newid();

  #elementsToUpdate = new Map<string, Trackable>();
  #elementsToRemove = new Map<string, Trackable>();
  #elementsToAdd = new Map<string, Trackable>();

  #invalidatedElements = new Set<Trackable>();

  #shouldUpdateDiagram = false;

  #snapshots = new Map<string, undefined | Snapshot>();

  #onCommitCallbacks = new Map<string, ActionCallback>();

  changeType: ChangeType = 'non-interactive';

  constructor(
    readonly diagram: Diagram,
    public trackChanges: boolean = false,
    public isThrowaway: boolean = false,
    public isRemote: boolean = false
  ) {
    registry.register(this, `${this.isThrowaway.toString()};${new Error().stack}`, this);
  }

  static immediate(diagram: Diagram) {
    return new UnitOfWork(diagram, false, true);
  }

  static execute<T>(diagram: Diagram, cb: (uow: UnitOfWork) => T, silent = false): T {
    const uow = new UnitOfWork(diagram);
    const result = cb(uow);
    uow.commit(silent);
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

  contains(element: Trackable, type?: 'update' | 'remove') {
    if (type === 'update') {
      return this.#elementsToUpdate.has(element.id);
    } else if (type === 'remove') {
      return this.#elementsToRemove.has(element.id);
    } else {
      return this.#elementsToUpdate.has(element.id) || this.#elementsToRemove.has(element.id);
    }
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
    if (this.trackChanges && !this.#snapshots.has(element.id)) {
      this.#snapshots.set(element.id, undefined);
    }
    this.#elementsToAdd.set(element.id, element);
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

  commit(silent = false) {
    this.changeType = 'non-interactive';

    // Note, onCommitCallbacks must run before elements events are emitted
    this.processOnCommitCallbacks();
    this.processEvents(silent);

    if (this.#shouldUpdateDiagram) {
      this.diagram.emit('change', { diagram: this.diagram });
    }

    registry.unregister(this);

    return new ElementsSnapshot(this.#snapshots);
  }

  abort() {
    registry.unregister(this);
  }

  private processEvents(silent = false) {
    // At this point, any elements have been added and or removed
    if (!this.isRemote) {
      this.#elementsToRemove.forEach(e => e.invalidate(this));
      this.#elementsToUpdate.forEach(e => e.invalidate(this));
      this.#elementsToAdd.forEach(e => e.invalidate(this));
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
              stylesheet: e as Stylesheet<StylesheetType>
            });
            break;
        }
      } else {
        switch (s) {
          case 'add':
            this.diagram.emit('elementAdd', { element: e as DiagramElement });
            break;
          case 'update':
            this.diagram.emit('elementChange', { element: e as DiagramElement, silent });
            break;
          case 'remove':
            this.diagram.emit('elementRemove', { element: e as DiagramElement });
            break;
        }
      }
    };

    // TODO: Need to think about the order here a bit better to optimize the number of events
    //       ... can be only CHANGE, ADD, REMOVE, ADD_CHANGE
    this.#elementsToRemove.forEach(handle('remove'));
    this.#elementsToUpdate.forEach(handle('update'));
    this.#elementsToAdd.forEach(handle('add'));

    this.diagram.emit('uowCommit', {
      removed: [...this.#elementsToRemove.values()].filter(
        e => e.trackableType === 'element'
      ) as DiagramElement[],
      updated: [...this.#elementsToUpdate.values()].filter(
        e => e.trackableType === 'element'
      ) as DiagramElement[],
      added: [...this.#elementsToAdd.values()].filter(
        e => e.trackableType === 'element'
      ) as DiagramElement[]
    });

    this.#elementsToUpdate.clear();
    this.#elementsToRemove.clear();
    this.#elementsToAdd.clear();
  }

  private processOnCommitCallbacks() {
    while (this.#onCommitCallbacks.size > 0) {
      this.#onCommitCallbacks.forEach((callback, key) => {
        this.#onCommitCallbacks.delete(key);
        callback();
      });
    }
  }

  stopTracking() {
    this.trackChanges = false;
  }

  updateDiagram() {
    this.#shouldUpdateDiagram = true;
  }
}
