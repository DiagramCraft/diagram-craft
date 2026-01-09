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
import { assert } from '@diagram-craft/utils/assert';

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

  /**
   * Adjusts the z-order (stacking position) of elements by applying a position delta.
   * This method modifies the relative positions of elements within their parent containers.
   *
   * Elements are grouped by their parent (either a node for nested elements, or undefined
   * for top-level elements on the layer). Within each group, only the specified elements
   * have their positions adjusted, while other elements remain in their original positions.
   * After applying the delta, elements are re-sorted to determine their final order.
   *
   * @param elements - Elements whose stacking positions should be modified
   * @param positionDelta - Relative change to apply to current positions (positive moves forward/up, negative moves backward/down)
   * @param uow - Unit of work for tracking the operation
   * @returns Snapshot of original positions for all affected parent groups (used for undo)
   *
   * @example
   * // Move elements forward by 2 positions
   * layer.stackModify([element1, element2], 2, uow);
   *
   * // Move elements to front (using large positive delta)
   * layer.stackModify([element], Number.MAX_SAFE_INTEGER / 2, uow);
   */
  // TODO: Add some tests for the stack operations
  stackModify(elements: ReadonlyArray<DiagramElement>, positionDelta: number, uow: UnitOfWork) {
    const snapshot = new Map<DiagramElement | undefined, StackPosition[]>();

    uow.executeUpdate(this, () => {
      // Group elements by their parent container
      const byParent = groupBy(elements, e => e.parent);

      const newPositions = new Map<DiagramElement | undefined, StackPosition[]>();

      for (const [parent, elements] of byParent) {
        // Get all elements in this container (either parent's children or layer's top-level elements)
        const existing = parent?.children ?? this.elements;

        // Capture original positions for undo
        const oldStackPositions = existing.map((e, i) => ({ element: e, idx: i }));
        snapshot.set(parent, oldStackPositions);

        // Create new positions by applying delta only to specified elements
        const newStackPositions = existing.map((e, i) => ({ element: e, idx: i }));
        for (const p of newStackPositions) {
          if (!elements.includes(p.element)) continue;
          p.idx += positionDelta;
        }
        newPositions.set(parent, newStackPositions);
      }

      // Apply the new positions
      this.stackSet(newPositions, uow);
    });

    return snapshot;
  }

  /**
   * Applies new stacking positions to elements within their parent containers.
   * This is an internal method called by stackModify to execute the actual reordering.
   *
   * The method handles two cases:
   * 1. Elements with a parent node: Updates the parent's children array in sorted order
   * 2. Top-level elements (no parent): Updates their index positions directly in the layer's element map
   *
   * @param newPositions - Map of parent containers to their elements' new positions
   * @param uow - Unit of work for tracking the operation
   */
  private stackSet(
    newPositions: Map<DiagramElement | undefined, StackPosition[]>,
    uow: UnitOfWork
  ) {
    for (const [parent, positions] of newPositions) {
      // Sort by index to determine final element order
      positions.sort((a, b) => a.idx - b.idx);
      if (parent) {
        // For nested elements, update the parent's children array
        parent.setChildren(
          positions.map(e => e.element),
          uow
        );
      } else {
        // For top-level elements, update their index in the layer's CRDT map
        this.#elements.setOrder(positions.map(p => p.element.id));
      }
    }
  }

  insertElement(element: DiagramElement, index: number, uow: UnitOfWork) {
    uow.executeAdd(element, this, index, () => {
      if (!element.parent && !this.#elements.has(element.id))
        this.#elements.insert(element.id, element, index);
      this.processElementForAdd(element);
    });
  }

  addElement(element: DiagramElement, uow: UnitOfWork) {
    this.insertElement(element, this.#elements.size, uow);
  }

  removeElement(element: DiagramElement, uow: UnitOfWork) {
    assert.true(this.#elements.has(element.id));

    for (const child of element.children) {
      element.removeChild(child, uow);
    }

    uow.executeRemove(element, this, this.#elements.getIndex(element.id), () => {
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
      uow.executeAdd(e, this, this.#elements.size, () => {
        this.#elements.add(e.id, e);
        this.processElementForAdd(e);
      });
    }

    for (const e of removed) {
      uow.executeRemove(e, this, this.#elements.getIndex(e.id), () => {
        e.detachCRDT(() => {
          this.#elements.remove(e.id);
        });
      });
    }

    uow.executeUpdate(this, () => {
      this.#elements.setOrder(ids);
    });
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
