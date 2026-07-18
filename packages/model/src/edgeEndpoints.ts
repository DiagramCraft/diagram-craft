import { Point } from '@diagram-craft/geometry/point';
import type { CRDTMap } from '@diagram-craft/collaboration/crdt';
import {
  MappedCRDTMap,
  type MappedCRDTMapMapType
} from '@diagram-craft/collaboration/datatypes/mapped/mappedCrdtMap';
import { MappedCRDTProp } from '@diagram-craft/collaboration/datatypes/mapped/mappedCrdtProp';
import type { CRDTMapper } from '@diagram-craft/collaboration/datatypes/mapped/types';
import { WatchableValue } from '@diagram-craft/utils/watchableValue';
import type { Releasable } from '@diagram-craft/utils/releasable';
import { assert } from '@diagram-craft/utils/assert';
import { getRemoteUnitOfWork, type UnitOfWork } from './unitOfWork';
import {
  AnchorEndpoint,
  EdgeConnectedEndpoint,
  Endpoint,
  FreeEndpoint,
  isConnectedEndpoint,
  NodeConnectedEndpoint
} from './endpoint';
import type { SerializedEndpoint } from './serialization/serializedTypes';
import type { DiagramEdge, DiagramEdgeCRDT } from './diagramEdge';

const isNodeConnectedEndpoint = (endpoint: Endpoint): endpoint is NodeConnectedEndpoint =>
  endpoint instanceof NodeConnectedEndpoint;

const isEdgeConnectedEndpoint = (endpoint: Endpoint): endpoint is EdgeConnectedEndpoint =>
  endpoint instanceof EdgeConnectedEndpoint;

export type AttachedEdgeCRDTEntry = { edges: Array<string> };

export const makeEndpointMapper = (
  edge: DiagramEdge
): CRDTMapper<Endpoint, SerializedEndpoint> => ({
  fromCRDT: (e: SerializedEndpoint) =>
    Endpoint.deserialize(e, edge.diagram.nodeLookup, edge.diagram.edgeLookup, true),
  toCRDT: (e: Endpoint) => e.serialize()
});

export const makeAttachedEdgesMapper = (
  edge: DiagramEdge
): CRDTMapper<string[], CRDTMap<AttachedEdgeCRDTEntry>> => ({
  fromCRDT: (e: CRDTMap<AttachedEdgeCRDTEntry>) => e.get('edges')!,
  toCRDT: (e: string[]) =>
    edge.crdt.get().factory.makeMap<AttachedEdgeCRDTEntry>({
      edges: e
    })
});

/**
 * Owns edge connection topology: the start/end endpoints, the set of edges
 * attached to this edge (via PointOnEdgeEndpoint), and cycle prevention across
 * edge-to-edge attachments.
 */
export class EdgeEndpoints {
  readonly #edge: DiagramEdge;
  readonly #start: MappedCRDTProp<DiagramEdgeCRDT, 'start', Endpoint>;
  readonly #end: MappedCRDTProp<DiagramEdgeCRDT, 'end', Endpoint>;
  readonly #attachedEdges: MappedCRDTMap<string[], AttachedEdgeCRDTEntry>;
  readonly #attachedEdgesMap: WatchableValue<CRDTMap<MappedCRDTMapMapType<AttachedEdgeCRDTEntry>>>;

  constructor(edge: DiagramEdge, edgeCrdt: WatchableValue<CRDTMap<DiagramEdgeCRDT>>) {
    this.#edge = edge;

    this.#start = new MappedCRDTProp<DiagramEdgeCRDT, 'start', Endpoint>(
      edgeCrdt,
      'start',
      makeEndpointMapper(edge),
      {
        onRemoteChange: () => getRemoteUnitOfWork(edge.diagram).updateElement(edge)
      }
    );

    this.#end = new MappedCRDTProp<DiagramEdgeCRDT, 'end', Endpoint>(
      edgeCrdt,
      'end',
      makeEndpointMapper(edge),
      {
        onRemoteChange: () => getRemoteUnitOfWork(edge.diagram).updateElement(edge)
      }
    );

    this.#attachedEdgesMap = WatchableValue.from(
      ([m]) => m.get().get('attachedEdges', () => edge.diagram.document.root.factory.makeMap())!,
      [edgeCrdt]
    );

    this.#attachedEdges = new MappedCRDTMap(this.#attachedEdgesMap, makeAttachedEdgesMapper(edge), {
      onRemoteChange: () => getRemoteUnitOfWork(edge.diagram).updateElement(edge),
      onRemoteAdd: () => getRemoteUnitOfWork(edge.diagram).updateElement(edge),
      onRemoteRemove: () => getRemoteUnitOfWork(edge.diagram).updateElement(edge)
    });
  }

  get releasables(): ReadonlyArray<Releasable> {
    return [this.#attachedEdges, this.#attachedEdgesMap, this.#start, this.#end];
  }

  /* Initial creation ******************************************************************************* */

  /** Used once by SimpleDiagramEdge._create to wire up the initial connections for a new edge. */
  static connectInitial(edge: DiagramEdge, start: Endpoint, end: Endpoint, uow: UnitOfWork) {
    if (isNodeConnectedEndpoint(start)) {
      start.node._addEdge(start instanceof AnchorEndpoint ? start.anchorId : undefined, edge, uow);
    }
    if (isEdgeConnectedEndpoint(start)) {
      start.edge._addAttachedEdge(edge, uow);
    }
    if (isNodeConnectedEndpoint(end)) {
      end.node._addEdge(end instanceof AnchorEndpoint ? end.anchorId : undefined, edge, uow);
    }
    if (isEdgeConnectedEndpoint(end)) {
      end.edge._addAttachedEdge(edge, uow);
    }
  }

  /* Start / end ************************************************************************************* */

  get start() {
    return this.#start.getNonNull();
  }

  get end() {
    return this.#end.getNonNull();
  }

  setStart(start: Endpoint, uow: UnitOfWork) {
    const edge = this.#edge;
    uow.executeUpdate(edge, () => {
      // Prevent edge-to-edge attachments from introducing dependency cycles.
      assert.true(!isEdgeConnectedEndpoint(start) || !start.edge?.isTransitivelyAttachedTo(edge));

      if (isNodeConnectedEndpoint(this.start)) {
        this.start.node._removeEdge(
          this.start instanceof AnchorEndpoint ? this.start.anchorId : undefined,
          edge,
          uow
        );
      }
      if (isEdgeConnectedEndpoint(this.start) && this.start.edge?._isAttached) {
        this.start.edge._removeAttachedEdge(edge, uow);
      }

      if (isNodeConnectedEndpoint(start)) {
        start.node._addEdge(
          start instanceof AnchorEndpoint ? start.anchorId : undefined,
          edge,
          uow
        );
      }
      if (isEdgeConnectedEndpoint(start) && start.edge?._isAttached) {
        start.edge._addAttachedEdge(edge, uow);
      }

      this.#start.set(start);
    });
  }

  setEnd(end: Endpoint, uow: UnitOfWork) {
    const edge = this.#edge;
    uow.executeUpdate(edge, () => {
      // Prevent edge-to-edge attachments from introducing dependency cycles.
      assert.true(!isEdgeConnectedEndpoint(end) || !end.edge?.isTransitivelyAttachedTo(edge));

      if (isNodeConnectedEndpoint(this.end)) {
        this.end.node._removeEdge(
          this.end instanceof AnchorEndpoint ? this.end.anchorId : undefined,
          edge,
          uow
        );
      }
      if (isEdgeConnectedEndpoint(this.end) && this.end.edge?._isAttached) {
        this.end.edge._removeAttachedEdge(edge, uow);
      }

      if (isNodeConnectedEndpoint(end)) {
        end.node._addEdge(end instanceof AnchorEndpoint ? end.anchorId : undefined, edge, uow);
      }
      if (isEdgeConnectedEndpoint(end) && end.edge?._isAttached) {
        end.edge._addAttachedEdge(edge, uow);
      }

      this.#end.set(end);
    });
  }

  /** Bypasses connection bookkeeping - used only for unconnected endpoints (e.g. by setBounds). */
  _setStart(endpoint: Endpoint) {
    this.#start.set(endpoint);
  }

  /** Bypasses connection bookkeeping - used only for unconnected endpoints (e.g. by setBounds). */
  _setEnd(endpoint: Endpoint) {
    this.#end.set(endpoint);
  }

  isConnected() {
    return isConnectedEndpoint(this.start) || isConnectedEndpoint(this.end);
  }

  flip(uow: UnitOfWork) {
    const start = this.#start.getNonNull();
    const end = this.#end.getNonNull();

    // Need to "zero" the end so that the setters logic should work correctly
    this.#end.set(new FreeEndpoint(Point.ORIGIN));

    this.setStart(end, uow);
    this.setEnd(start, uow);
  }

  /* Attached edges *********************************************************************************** */

  get attachedEdges(): ReadonlyArray<DiagramEdge> {
    return Array.from(this.#attachedEdges.values)
      .flat()
      .map(id => this.#edge.diagram.edgeLookup.get(id)!)
      .filter((edge): edge is DiagramEdge => edge !== undefined);
  }

  _addAttachedEdge(other: DiagramEdge, uow: UnitOfWork) {
    uow.executeUpdate(this.#edge, () => {
      const current = this.#attachedEdges.get('') ?? [];
      if (!current.includes(other.id)) {
        this.#attachedEdges.set('', [...current, other.id]);
      }
    });
  }

  _removeAttachedEdge(other: DiagramEdge, uow: UnitOfWork) {
    uow.executeUpdate(this.#edge, () => {
      this.#attachedEdges.set(
        '',
        (this.#attachedEdges.get('') ?? []).filter(id => id !== other.id)
      );
    });
  }

  isTransitivelyAttachedTo(edge: DiagramEdge, seen = new Set<string>()) {
    const self = this.#edge;
    if (self === edge) return true;
    if (seen.has(self.id)) return false;
    seen.add(self.id);

    for (const endpoint of [this.start, this.end]) {
      if (!isEdgeConnectedEndpoint(endpoint)) continue;
      if (endpoint.edge === edge || endpoint.edge.isTransitivelyAttachedTo(edge, seen)) return true;
    }

    return false;
  }

  /* Lifecycle ***************************************************************************************** */

  /**
   * After this edge is registered in the lookup, find any already-attached edges
   * that have a PointOnEdgeEndpoint referencing this edge and register them as
   * attached. This handles the undo case where a referencing edge was restored
   * before this one.
   */
  reattach(uow: UnitOfWork) {
    const self = this.#edge;
    for (const edge of self.diagram.edgeLookup.values()) {
      if (edge === self) continue;
      if (isEdgeConnectedEndpoint(edge.start) && edge.start.edge === self) {
        this._addAttachedEdge(edge, uow);
      }
      if (isEdgeConnectedEndpoint(edge.end) && edge.end.edge === self) {
        this._addAttachedEdge(edge, uow);
      }
    }
  }

  detach(uow: UnitOfWork) {
    const edge = this.#edge;
    if (isNodeConnectedEndpoint(this.start)) {
      this.start.node._removeEdge(
        this.start instanceof AnchorEndpoint ? this.start.anchorId : undefined,
        edge,
        uow
      );
    }
    if (isEdgeConnectedEndpoint(this.start) && this.start.edge?._isAttached) {
      this.start.edge._removeAttachedEdge(edge, uow);
    }
    if (isNodeConnectedEndpoint(this.end)) {
      this.end.node._removeEdge(
        this.end instanceof AnchorEndpoint ? this.end.anchorId : undefined,
        edge,
        uow
      );
    }
    if (isEdgeConnectedEndpoint(this.end) && this.end.edge?._isAttached) {
      this.end.edge._removeAttachedEdge(edge, uow);
    }
  }
}
