import { Layer, LayerCRDT, StackPosition } from './diagramLayer';
import { DiagramElement, type DiagramElementCRDT, isNode } from './diagramElement';
import type { Diagram } from './diagram';
import { CRDTMap } from './collaboration/crdt';
import { LayerSnapshot, UnitOfWork } from './unitOfWork';
import { groupBy } from '@diagram-craft/utils/array';
import { DiagramEdge } from './diagramEdge';
import { MappedCRDTOrderedMap } from './collaboration/mappedCRDTOrderedMap';
import { CRDTMapper } from './collaboration/mappedCRDT';
import { DiagramNode } from './diagramNode';
import { FreeEndpoint } from './endpoint';

const makeElementMapper = (layer: Layer): CRDTMapper<DiagramElement, DiagramElementCRDT> => {
  return {
    fromCRDT(e: CRDTMap<DiagramElementCRDT>): DiagramElement {
      const type = e.get('type')!;
      const id = e.get('id')!;

      if (type === 'node') {
        return new DiagramNode(
          id,
          'test',
          { w: 10, h: 10, x: 0, y: 0, r: 0 },
          layer,
          {},
          {},
          { text: '' },
          []
        );
      } else {
        return new DiagramEdge(
          id,
          new FreeEndpoint({ x: 0, y: 0 }),
          new FreeEndpoint({ x: 0, y: 0 }),
          {},
          {},
          [],
          layer
        );
      }

      throw new Error(`Unknown layer type: ${type}`);
    },

    toCRDT(e: DiagramElement): CRDTMap<DiagramElementCRDT> {
      return e.crdt;
    }
  };
};

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
      this.crdt.get('elements', () => diagram.document.root.factory.makeMap())!,
      makeElementMapper(this),
      true
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

    this.#elements.remove(element.id);
    element.detach(uow);
    uow.removeElement(element);
    uow.updateElement(this);
  }

  setElements(elements: ReadonlyArray<DiagramElement>, uow: UnitOfWork) {
    uow.snapshot(this);

    const added = elements.filter(e => !this.#elements.has(e.id));
    const removed = this.#elements.values.filter(e => !elements.includes(e));

    this.#elements.set(elements.map(e => [e.id, e]));
    for (const e of added) {
      this.processElementForAdd(e);
      uow.addElement(e);
    }
    for (const e of removed) {
      uow.removeElement(e);
    }

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
