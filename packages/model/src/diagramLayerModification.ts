import { Layer, type LayerCRDT } from './diagramLayer';
import { CRDTMap } from './collaboration/crdt';
import type { Diagram } from './diagram';
import { type DiagramElement, type DiagramElementCRDT, isNode } from './diagramElement';
import { MappedCRDTOrderedMap } from './collaboration/datatypes/mapped/mappedCrdtOrderedMap';
import { watch } from '@diagram-craft/utils/watchableValue';
import { makeElementMapper, registerElementFactory } from './diagramElementMapper';
import { getRemoteUnitOfWork, type LayerSnapshot, UnitOfWork } from './unitOfWork';
import { assert, mustExist } from '@diagram-craft/utils/assert';
import { DiagramEdge, type DiagramEdgeCRDT } from './diagramEdge';
import type { Adjustment } from './diagramLayerRuleTypes';
import type { RegularLayer } from './diagramLayerRegular';
import type { DiagramNode } from './diagramNode';
import { DelegatingDiagramNode } from './delegatingDiagramNode';
import { DelegatingDiagramEdge } from './delegatingDiagramEdge';

registerElementFactory(
  'delegating-node',
  (
    id: string,
    layer: RegularLayer | ModificationLayer,
    delegate: DiagramElement | undefined,
    crdt?: CRDTMap<DiagramElementCRDT>
  ) => {
    return new DelegatingDiagramNode(id, delegate! as DiagramNode, layer, { crdt });
  }
);
registerElementFactory(
  'delegating-edge',
  (
    id: string,
    layer: RegularLayer | ModificationLayer,
    delegate: DiagramElement | undefined,
    crdt?: CRDTMap<DiagramElementCRDT>
  ) => {
    return new DelegatingDiagramEdge(id, delegate! as DiagramEdge, layer, {
      crdt: crdt as CRDTMap<DiagramEdgeCRDT>
    });
  }
);

type ModificationType = 'add' | 'remove' | 'change';
const ModificationType = {
  Add: 'add' as const,
  Remove: 'remove' as const,
  Change: 'change' as const
};

type Modification = {
  /* ID of the element to modify */
  id: string;
  type: ModificationType;

  /* In case of add or change, the element to add or change */
  element?: DiagramElement;
};

export type ModificationCRDT = {
  id: string;
  type: ModificationType;
  element?: CRDTMap<DiagramElementCRDT>;
};

export class ModificationLayer extends Layer<ModificationLayer> {
  #modifications: MappedCRDTOrderedMap<Modification, ModificationCRDT>;

  constructor(
    id: string,
    name: string,
    diagram: Diagram,
    modifications: Readonly<Array<Modification>>,
    crdt?: CRDTMap<LayerCRDT>
  ) {
    super(id, name, diagram, 'modification', crdt);

    this.#modifications = new MappedCRDTOrderedMap<Modification, ModificationCRDT>(
      watch(this.crdt.get('modifications', () => diagram.document.root.factory.makeMap())!),
      {
        fromCRDT: (e: CRDTMap<ModificationCRDT>) => {
          const id = e.get('id')!;
          const type = e.get('type')!;

          let element: DiagramElement | undefined;
          if (type === ModificationType.Add || type === ModificationType.Change) {
            element = makeElementMapper(this, this.diagram.lookup(id)!).fromCRDT(e.get('element')!);
          }

          return { id, type, element };
        },

        toCRDT: (e: Modification) => {
          return diagram.document.root.factory.makeMap({
            id: e.id,
            type: e.type,
            element: e.element
              ? makeElementMapper(this, this.diagram.lookup(id)!).toCRDT(e.element)
              : undefined
          });
        }
      },
      {
        onRemoteAdd: e => {
          const uow = getRemoteUnitOfWork(diagram);
          if (e.type === ModificationType.Add) {
            uow.addElement(e.element!);
            this.processElementForAdd(e.element!);
          } else if (e.type === ModificationType.Change || e.type === ModificationType.Remove) {
            if (e.element) uow.updateElement(e.element);
            if (e.type === ModificationType.Remove) uow.updateElement(diagram.lookup(e.id)!);
          }
        },
        onRemoteChange: e => {
          const uow = getRemoteUnitOfWork(diagram);
          if (e.type === ModificationType.Change) {
            uow.updateElement(e.element!);
          }
        },
        onRemoteRemove: e => {
          const uow = getRemoteUnitOfWork(diagram);
          if (e.type === ModificationType.Add) {
            uow.removeElement(e.element!);
          } else if (e.type === ModificationType.Change || e.type === ModificationType.Remove) {
            if (e.element) uow.updateElement(e.element);
            if (e.type === ModificationType.Remove) uow.updateElement(diagram.lookup(e.id)!);
          }
        },
        onInit: e => {
          if (e.type === ModificationType.Add) {
            this.processElementForAdd(e.element!);
            diagram.emit('elementAdd', { element: e.element! });
          } else if (e.type === ModificationType.Change) {
            this.processElementForAdd(e.element!);
            diagram.emit('elementAdd', { element: e.element! });
            diagram.emit('elementChange', { element: diagram.lookup(e.id)! });
          } else {
            diagram.emit('elementChange', { element: diagram.lookup(e.id)! });
          }
        }
      }
    );

    const uow = new UnitOfWork(diagram);
    for (const m of modifications) {
      if (m.type === ModificationType.Add) {
        assert.present(m.element);
        this.modifyAdd(m.id, m.element, uow);
      } else if (m.type === ModificationType.Remove) {
        this.modifyRemove(m.id, uow);
      } else if (m.type === ModificationType.Change) {
        assert.present(m.element);
        this.modifyChange(m.id, m.element, uow);
      }
    }
    uow.abort();
  }

  resolve() {
    return this;
  }

  get elements(): DiagramElement[] {
    return this.#modifications.values
      .filter(e => e.type === ModificationType.Add || e.type === ModificationType.Change)
      .map(e => e.element!);
  }

  get modifications(): ReadonlyArray<Modification> {
    return this.#modifications.values;
  }

  removeElement(el: DiagramElement, uow: UnitOfWork) {
    this.modifyRemove(el.id, uow);
  }

  modifyRemove(id: string, uow: UnitOfWork) {
    uow.snapshot(this);
    this.#modifications.add(id, { id, type: ModificationType.Remove });
  }

  modifyAdd(id: string, el: DiagramElement, uow: UnitOfWork) {
    assert.true(el instanceof DelegatingDiagramNode || el instanceof DelegatingDiagramEdge);

    uow.snapshot(this);
    this.#modifications.add(id, { id, type: ModificationType.Add, element: el });

    this.processElementForAdd(el);

    uow.addElement(el);
    uow.updateElement(this);
  }

  modifyChange(id: string, el: DiagramElement, uow: UnitOfWork) {
    assert.true(el instanceof DelegatingDiagramNode || el instanceof DelegatingDiagramEdge);

    uow.snapshot(this);
    this.#modifications.add(id, { id, type: ModificationType.Change, element: el });

    this.processElementForAdd(el);

    uow.addElement(el);
    uow.updateElement(this);
  }

  clearModification(id: string, uow: UnitOfWork) {
    uow.snapshot(this);

    const m = mustExist(this.#modifications.get(id));
    this.#modifications.remove(id);

    if (m.type === ModificationType.Add) {
      uow.snapshot(m.element!);
      uow.removeElement(m.element!);
    } else if (m.type === ModificationType.Change || m.type === ModificationType.Remove) {
      const el = this.diagram.lookup(id)!;
      uow.snapshot(el);
      uow.updateElement(el);
    }
    uow.updateElement(this);
  }

  getModification(id: string): Modification | undefined {
    return this.#modifications.get(id);
  }

  adjustments(): Map<string, Adjustment> {
    const dest = new Map<string, Adjustment>();
    for (const m of this.#modifications.values) {
      dest.set(m.id, { props: { hidden: true } });
    }
    return dest;
  }

  snapshot(): LayerSnapshot {
    return {
      ...super.snapshot(),
      modifications: this.#modifications.values.map(e => ({
        id: e.id,
        type: e.type,
        elementId: e.element?.id
      }))
    };
  }

  restore(snapshot: LayerSnapshot, uow: UnitOfWork) {
    super.restore(snapshot, uow);
    this.#modifications.clear();
    for (const m of snapshot.modifications ?? []) {
      this.#modifications.add(m.id, {
        id: m.id,
        type: m.type,
        element: m.elementId ? this.diagram.lookup(m.elementId)! : undefined
      });
    }
  }

  private processElementForAdd(e: DiagramElement) {
    e._setLayer(this, this.diagram);
    if (isNode(e)) {
      this.diagram.nodeLookup.set(e.id, e);
    } else {
      this.diagram.edgeLookup.set(e.id, e as DiagramEdge);
    }
  }
}
