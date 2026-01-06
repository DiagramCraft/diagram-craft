import { Layer, LayerCRDT, StackPosition } from './diagramLayer';
import { DiagramElement, type DiagramElementCRDT, isNode } from './diagramElement';
import type { Diagram } from './diagram';
import { getRemoteUnitOfWork, LayerSnapshot, UnitOfWork } from './unitOfWork';
import { groupBy } from '@diagram-craft/utils/array';
import { DiagramEdge } from './diagramEdge';
import { makeElementMapper, registerElementFactory } from './diagramElementMapper';
import { watch } from '@diagram-craft/utils/watchableValue';
import { ElementFactory } from './elementFactory';
import { MappedCRDTOrderedMap } from '@diagram-craft/collaboration/datatypes/mapped/mappedCrdtOrderedMap';
import type { CRDTMap } from '@diagram-craft/collaboration/crdt';
import { SpatialIndex } from './spatialIndex';

registerElementFactory('node', (id, layer, _, c) => ElementFactory.emptyNode(id, layer, c));
registerElementFactory('edge', (id, layer, _, c) => ElementFactory.emptyEdge(id, layer, c));

export class RegularLayer extends Layer<RegularLayer> {
  #elements: MappedCRDTOrderedMap<DiagramElement, DiagramElementCRDT>;
  #spatialIndex: SpatialIndex | undefined;

  constructor(
    id: string,
    name: string,
    elements: ReadonlyArray<DiagramElement>,
    diagram: Diagram,
    crdt?: CRDTMap<LayerCRDT>
  ) {
    super(id, name, diagram, 'regular', crdt);

    this.#elements = new MappedCRDTOrderedMap<DiagramElement, DiagramElementCRDT>(
      watch(this.crdt.get('elements', () => diagram.document.root.factory.makeMap())!),
      makeElementMapper(this, undefined),
      {
        onRemoteAdd: e => {
          const uow = getRemoteUnitOfWork(diagram);
          uow.addElement(e, this, this.#elements.size - 1);
          this.processElementForAdd(e);
        },
        onRemoteChange: e => {
          const uow = getRemoteUnitOfWork(diagram);
          uow.updateElement(e);
        },
        onRemoteRemove: e => {
          const uow = getRemoteUnitOfWork(diagram);
          uow.removeElement(e, this, this.elements.indexOf(e));
        },
        onInit: e => {
          diagram.emit('elementAdd', { element: e });
          this.processElementForAdd(e);
        }
      }
    );

    UnitOfWork.executeSilently(diagram, uow => {
      elements.forEach(e => this.addElement(e, uow));
    });
  }

  get elements(): ReadonlyArray<DiagramElement> {
    return this.#elements.values;
  }

  get index(): SpatialIndex {
    if (!this.#spatialIndex) {
      this.#spatialIndex = new SpatialIndex(this);
    }
    return this.#spatialIndex;
  }

  resolve() {
    return this;
  }

  // TODO: Add some tests for the stack operations
  stackModify(elements: ReadonlyArray<DiagramElement>, positionDelta: number, uow: UnitOfWork) {
    const snapshot = new Map<DiagramElement | undefined, StackPosition[]>();

    uow.executeUpdate(this, () => {
      const byParent = groupBy(elements, e => e.parent);

      const newPositions = new Map<DiagramElement | undefined, StackPosition[]>();

      for (const [parent, elements] of byParent) {
        const existing = parent?.children ?? this.elements;

        const oldStackPositions = existing.map((e, i) => ({ element: e, idx: i }));
        snapshot.set(parent, oldStackPositions);

        const newStackPositions = existing.map((e, i) => ({ element: e, idx: i }));
        for (const p of newStackPositions) {
          if (!elements.includes(p.element)) continue;
          p.idx += positionDelta;
        }
        newPositions.set(parent, newStackPositions);
      }

      this.stackSet(newPositions, uow);
    });

    return snapshot;
  }

  private stackSet(
    newPositions: Map<DiagramElement | undefined, StackPosition[]>,
    uow: UnitOfWork
  ) {
    for (const [parent, positions] of newPositions) {
      positions.sort((a, b) => a.idx - b.idx);
      if (parent) {
        parent.setChildren(
          positions.map(e => e.element),
          uow
        );
      } else {
        for (const p of positions) {
          this.#elements.setIndex(p.element.id, p.idx);
        }
      }
    }
  }

  addElement(element: DiagramElement, uow: UnitOfWork) {
    uow.executeAdd(element, this, this.#elements.size - 1, () => {
      if (!element.parent && !this.#elements.has(element.id))
        this.#elements.add(element.id, element);
      this.processElementForAdd(element);
    });
  }

  removeElement(element: DiagramElement, uow: UnitOfWork) {
    uow.executeRemove(element, this, this.elements.indexOf(element), () => {
      element.detachCRDT(() => {
        this.#elements.remove(element.id);
      });

      element.detach(uow);
    });
  }

  setElements(elements: ReadonlyArray<DiagramElement>, uow: UnitOfWork) {
    const ids = elements.map(e => e.id);
    const added = elements.filter(e => !this.#elements.has(e.id));
    const removed = this.#elements.values.filter(e => ids.indexOf(e.id) < 0);

    for (const e of added) {
      uow.executeAdd(e, this, this.#elements.size - 1, () => {
        this.#elements.add(e.id, e);
        this.processElementForAdd(e);
      });
    }

    for (const e of removed) {
      uow.executeRemove(e, this, this.elements.indexOf(e), () => {
        e.detachCRDT(() => {
          this.#elements.remove(e.id);
        });
      });
    }
  }

  private processElementForAdd(e: DiagramElement) {
    e._setLayer(this, this.diagram);
    if (isNode(e)) {
      this.diagram.nodeLookup.set(e.id, e);
      for (const child of e.children) {
        this.processElementForAdd(child);
      }
    } else {
      this.diagram.edgeLookup.set(e.id, e as DiagramEdge);
    }
  }

  restore(snapshot: LayerSnapshot, uow: UnitOfWork) {
    super.restore(snapshot, uow);

    this.setElements(
      (snapshot.elements ?? []).map(id => this.diagram.lookup(id)!),
      uow
    );
  }

  snapshot(): LayerSnapshot {
    return {
      ...super.snapshot(),
      elements: this.elements.map(e => e.id)
    };
  }

  getAttachmentsInUse() {
    return this.elements.flatMap(e => e.getAttachmentsInUse());
  }
}
