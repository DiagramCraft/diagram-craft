import { Layer, LayerCRDT, StackPosition } from './diagramLayer';
import { DiagramElement, type DiagramElementCRDT, isNode } from './diagramElement';
import type { Diagram } from './diagram';
import { CRDTMap } from './collaboration/crdt';
import { LayerSnapshot, UnitOfWork } from './unitOfWork';
import { groupBy } from '@diagram-craft/utils/array';
import { DiagramEdge } from './diagramEdge';
import { MappedCRDTOrderedMap } from './collaboration/datatypes/mapped/mappedCrdtOrderedMap';
import { makeElementMapper, registerElementFactory } from './diagramElementMapper';
import { DiagramNode } from './diagramNode';
import { watch } from '@diagram-craft/utils/watchableValue';

registerElementFactory('node', (id, layer, crdt) => new DiagramNode(id, layer, undefined, crdt));
registerElementFactory('edge', (id, layer, crdt) => new DiagramEdge(id, layer, crdt));

export class RegularLayer extends Layer<RegularLayer> {
  #elements: MappedCRDTOrderedMap<DiagramElement, DiagramElementCRDT>;

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
      makeElementMapper(this),
      {
        onRemoteAdd: e => {
          diagram.emit('elementAdd', { element: e });
          this.processElementForAdd(e);
        },
        onRemoteChange: e => {
          diagram.emit('elementChange', { element: e });
        },
        onRemoteRemove: e => diagram.emit('elementRemove', { element: e }),
        onInit: e => {
          diagram.emit('elementAdd', { element: e });
          this.processElementForAdd(e);
        }
      }
    );

    const uow = new UnitOfWork(diagram);
    elements.forEach(e => this.addElement(e, uow));
    uow.abort();
  }

  get elements(): ReadonlyArray<DiagramElement> {
    return this.#elements.values;
  }

  resolve() {
    return this;
  }

  // TODO: Add some tests for the stack operations
  stackModify(elements: ReadonlyArray<DiagramElement>, positionDelta: number, uow: UnitOfWork) {
    uow.snapshot(this);

    const byParent = groupBy(elements, e => e.parent);

    const snapshot = new Map<DiagramElement | undefined, StackPosition[]>();
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

    return snapshot;
  }

  stackSet(newPositions: Map<DiagramElement | undefined, StackPosition[]>, uow: UnitOfWork) {
    uow.snapshot(this);

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

    uow.updateElement(this);
  }

  addElement(element: DiagramElement, uow: UnitOfWork) {
    uow.snapshot(this);

    if (!element.parent && !this.#elements.has(element.id)) this.#elements.add(element.id, element);
    this.processElementForAdd(element);
    uow.addElement(element);
    uow.updateElement(this);
  }

  removeElement(element: DiagramElement, uow: UnitOfWork) {
    uow.snapshot(this);

    element.detachCRDT(() => {
      this.#elements.remove(element.id);
    });

    element.detach(uow);
    uow.removeElement(element);
    uow.updateElement(this);
  }

  setElements(elements: ReadonlyArray<DiagramElement>, uow: UnitOfWork) {
    uow.snapshot(this);

    const added = elements.filter(e => !this.#elements.has(e.id));
    const removed = this.#elements.values.filter(e => !elements.includes(e));

    for (const e of added) {
      this.#elements.add(e.id, e);
      this.processElementForAdd(e);
      uow.addElement(e);
    }

    for (const e of removed) {
      e.detachCRDT(() => {
        this.#elements.remove(e.id);
      });
      uow.removeElement(e);
    }

    this.#elements.setOrder(elements.map(e => e.id));

    uow.updateElement(this);
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
      snapshot.elements.map(id => this.diagram.lookup(id)!),
      uow
    );
  }

  toJSON() {
    return {
      ...super.toJSON(),
      elements: this.elements
    };
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
