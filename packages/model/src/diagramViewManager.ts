import type { DiagramDocument } from './diagramDocument';
import type { DiagramView } from './diagram';
import type { CRDTMap } from '@diagram-craft/collaboration/crdt';
import type { CRDTMapper } from '@diagram-craft/collaboration/datatypes/mapped/types';
import {
  MappedCRDTOrderedMap,
  type MappedCRDTOrderedMapMapType
} from '@diagram-craft/collaboration/datatypes/mapped/mappedCrdtOrderedMap';
import { EventEmitter } from '@diagram-craft/utils/event';
import type { EmptyObject } from '@diagram-craft/utils/types';
import { newid } from '@diagram-craft/utils/id';
import { watch } from '@diagram-craft/utils/watchableValue';

export type StoredDiagramView = {
  id: string;
  name: string;
  layers: string[];
};

const makeDiagramViewMapper = (
  document: DiagramDocument
): CRDTMapper<DiagramView, CRDTMap<StoredDiagramView>> => {
  return {
    fromCRDT: crdt => ({
      id: crdt.get('id')!,
      name: crdt.get('name')!,
      layers: crdt.get('layers')!
    }),
    toCRDT: view => {
      const map = document.root.factory.makeMap<StoredDiagramView>();
      map.set('id', view.id);
      map.set('name', view.name);
      map.set('layers', view.layers);
      return map;
    }
  };
};

export type DiagramViewManagerEvents = {
  viewAdded: { view: DiagramView };
  viewRemoved: { view: DiagramView };
  viewChange: EmptyObject;
};

export class DiagramViewManager extends EventEmitter<DiagramViewManagerEvents> {
  readonly #views: MappedCRDTOrderedMap<DiagramView, StoredDiagramView>;

  constructor(
    document: DiagramDocument,
    crdt: CRDTMap<MappedCRDTOrderedMapMapType<StoredDiagramView>>,
    private readonly visibleLayerIds: () => string[]
  ) {
    super();
    this.#views = new MappedCRDTOrderedMap(watch(crdt), makeDiagramViewMapper(document), {
      onRemoteAdd: view => {
        this.emit('viewAdded', { view });
        this.emit('viewChange', {});
      },
      onRemoteRemove: view => {
        this.emit('viewRemoved', { view });
        this.emit('viewChange', {});
      },
      onRemoteChange: () => this.emit('viewChange', {})
    });
  }

  get all(): readonly DiagramView[] {
    return this.#views.values;
  }

  byId(id: string): DiagramView | undefined {
    return this.#views.get(id);
  }

  add(name: string, options?: { id?: string; layers?: string[] }): DiagramView {
    const view: DiagramView = {
      id: options?.id ?? newid(),
      name,
      layers: options?.layers ?? this.visibleLayerIds()
    };

    this.#views.add(view.id, view);
    this.emit('viewAdded', { view });
    this.emit('viewChange', {});
    return view;
  }

  remove(id: string): boolean {
    const view = this.#views.get(id);
    if (!view) return false;

    const removed = this.#views.remove(id);
    if (removed) {
      this.emit('viewRemoved', { view });
      this.emit('viewChange', {});
    }

    return removed;
  }
}
