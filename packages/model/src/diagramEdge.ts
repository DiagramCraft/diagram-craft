import type { DiagramNode, DuplicationContext } from './diagramNode';
import { Point } from '@diagram-craft/geometry/point';
import { Vector } from '@diagram-craft/geometry/vector';
import { Box } from '@diagram-craft/geometry/box';
import { PointOnPath } from '@diagram-craft/geometry/pathPosition';
import { CubicSegment, LineSegment } from '@diagram-craft/geometry/pathSegment';
import { Transform } from '@diagram-craft/geometry/transform';
import {
  AbstractDiagramElement,
  DiagramElement,
  type DiagramElementCRDT,
  InvalidationScope,
  isEdge,
  isNode
} from './diagramElement';
import { getRemoteUnitOfWork, UnitOfWork, UOWTrackable } from './unitOfWork';
import {
  AnchorEndpoint,
  NodeConnectedEndpoint,
  Endpoint,
  FreeEndpoint,
  isConnectedEndpoint,
  PointOnEdgeEndpoint,
  PointInNodeEndpoint
} from './endpoint';
import { getCollapsedAncestor } from './collapsible';
import { DefaultStyles, edgeDefaults } from './diagramDefaults';
import { buildEdgePath } from './edgePathBuilder';
import { type LabelNode } from './labelNode';
import { DeepReadonly, DeepRequired } from '@diagram-craft/utils/types';
import { deepClone, deepMerge } from '@diagram-craft/utils/object';
import { newid } from '@diagram-craft/utils/id';
import { Direction } from '@diagram-craft/geometry/direction';
import { isEmptyString } from '@diagram-craft/utils/strings';
import { assert, is } from '@diagram-craft/utils/assert';
import { PropPath, PropPathValue } from '@diagram-craft/utils/propertyPath';
import type { RegularLayer } from './diagramLayerRegular';
import { assertRegularLayer, getAdjustments } from './diagramLayerUtils';
import type { Layer } from './diagramLayer';
import type { Reference, SerializedEndpoint } from './serialization/serializedTypes';
import { WatchableValue } from '@diagram-craft/utils/watchableValue';
import type { ModificationLayer } from './diagramLayerModification';
import type { Path } from '@diagram-craft/geometry/path';
import type { PropertyInfo } from './property';
import {
  resolveEditProps,
  resolvePropsInfo,
  resolveRenderProps,
  type PropertySource
} from './propertyResolver';
import type { EdgeDefinition } from './edgeDefinition';
import type { CRDTMap, FlatCRDTMap } from '@diagram-craft/collaboration/crdt';
import type { MappedCRDTOrderedMapMapType } from '@diagram-craft/collaboration/datatypes/mapped/mappedCrdtOrderedMap';
import type { MappedCRDTMapMapType } from '@diagram-craft/collaboration/datatypes/mapped/mappedCrdtMap';
import { CRDTProp } from '@diagram-craft/collaboration/datatypes/crdtProp';
import { CRDTObject } from '@diagram-craft/collaboration/datatypes/crdtObject';
import {
  ensureCustomProp,
  type CustomEdgeProps,
  type EdgeProps,
  type ElementMetadata
} from './diagramProps';
import type { FlatObject } from '@diagram-craft/utils/flatObject';
import { UOWRegistry } from '@diagram-craft/model/unitOfWork';
import {
  DiagramEdgeSnapshot,
  DiagramElementChildUOWAdapter,
  DiagramElementUOWAdapter
} from '@diagram-craft/model/diagramElement.uow';
import {
  intersectionListIsSame,
  recalculateIntersections,
  type Intersection
} from './edgeIntersections';
import { EdgeEndpoints, type AttachedEdgeCRDTEntry } from './edgeEndpoints';
import { EdgeLabels, type LabelNodeCRDTEntry } from './edgeLabels';

const isNodeConnectedEndpoint = (endpoint: Endpoint): endpoint is NodeConnectedEndpoint =>
  endpoint instanceof NodeConnectedEndpoint;

export type Waypoint = Readonly<{
  point: Point;
  controlPoints?: ControlPoints;
}>;

export type ControlPoints = Readonly<{
  cp1: Point;
  cp2: Point;
}>;

export type ResolvedLabelNode = LabelNode & {
  node: () => DiagramNode;
};

export type EdgePropsForEditing = DeepReadonly<EdgeProps>;
export type EdgePropsForRendering = DeepReadonly<DeepRequired<EdgeProps>>;

declare global {
  namespace DiagramCraft {
    interface AdditionalCRDTCompatibleInnerObjects {
      reference: Reference;
    }
  }
}

export type DiagramEdgeCRDT = DiagramElementCRDT & {
  start: SerializedEndpoint;
  end: SerializedEndpoint;
  attachedEdges: CRDTMap<MappedCRDTMapMapType<AttachedEdgeCRDTEntry>>;
  props: FlatCRDTMap;
  labelNodes: CRDTMap<MappedCRDTOrderedMapMapType<LabelNodeCRDTEntry>>;
  waypoints: ReadonlyArray<Waypoint>;
};

export interface DiagramEdge extends DiagramElement {
  getDefinition(): EdgeDefinition;
  getPropsInfo<T extends PropPath<EdgeProps>>(path: T): PropertyInfo<PropPathValue<EdgeProps, T>>;

  readonly storedProps: DeepReadonly<EdgeProps>;
  readonly editProps: DeepReadonly<EdgePropsForEditing>;
  readonly renderProps: DeepReadonly<EdgePropsForRendering>;
  updateProps(callback: (props: EdgeProps) => void, uow: UnitOfWork): void;
  updateCustomProps<K extends keyof CustomEdgeProps>(
    key: K,
    callback: (props: NonNullable<CustomEdgeProps[K]>) => void,
    uow: UnitOfWork
  ): void;
  inferControlPoints(i: number): ControlPoints;

  readonly dataForTemplate: FlatObject;
  readonly name: string;

  setStart(start: Endpoint, uow: UnitOfWork): void;
  get start(): Endpoint;
  setEnd(end: Endpoint, uow: UnitOfWork): void;
  get end(): Endpoint;
  isConnected(): boolean;
  readonly attachedEdges: ReadonlyArray<DiagramEdge>;
  _addAttachedEdge(edge: DiagramEdge, uow: UnitOfWork): void;
  _removeAttachedEdge(edge: DiagramEdge, uow: UnitOfWork): void;
  isTransitivelyAttachedTo(edge: DiagramEdge, seen?: Set<string>): boolean;

  labelNodes: ReadonlyArray<ResolvedLabelNode>;
  addLabelNode(node: ResolvedLabelNode, uow: UnitOfWork): void;
  setLabelNodes(labelNodes: ReadonlyArray<ResolvedLabelNode> | undefined, uow: UnitOfWork): void;
  removeLabelNode(node: LabelNode, uow: UnitOfWork): void;

  readonly waypoints: ReadonlyArray<Waypoint>;
  replaceWaypoint(i: number, wp: Waypoint, uow: UnitOfWork): void;
  addWaypoint(wp: Waypoint, uow: UnitOfWork): number;
  removeWaypoint(waypoint: Waypoint, uow: UnitOfWork): void;
  moveWaypoint(waypoint: Waypoint, point: Point, uow: UnitOfWork): void;

  path(): Path;

  readonly intersections: Array<Intersection>;
  flip(uow: UnitOfWork): void;

  _recalculateIntersections(uow: UnitOfWork, propagate: boolean): void;

  _transformWaypoints(transforms: ReadonlyArray<Transform>): void;
}

export class SimpleDiagramEdge extends AbstractDiagramElement implements DiagramEdge, UOWTrackable {
  // Transient properties
  #intersections: Intersection[] = [];

  // Shared properties
  readonly #waypoints: CRDTProp<DiagramEdgeCRDT, 'waypoints'>;
  readonly #labels: EdgeLabels;
  readonly #endpoints: EdgeEndpoints;
  readonly #props: CRDTObject<EdgeProps>;

  protected constructor(
    id: string,
    layer: RegularLayer | ModificationLayer,
    crdt?: CRDTMap<DiagramElementCRDT>
  ) {
    super('edge', id, layer, crdt);

    const edgeCrdt = this._crdt as unknown as WatchableValue<CRDTMap<DiagramEdgeCRDT>>;

    this.#waypoints = new CRDTProp(edgeCrdt, 'waypoints', {
      onRemoteChange: () => getRemoteUnitOfWork(this.diagram).updateElement(this),
      initialValue: []
    });
    this._releasables.add(this.#waypoints);

    this.#labels = new EdgeLabels(this, edgeCrdt);
    for (const releasable of this.#labels.releasables) {
      this._releasables.add(releasable);
    }

    this.#endpoints = new EdgeEndpoints(this, edgeCrdt);
    for (const releasable of this.#endpoints.releasables) {
      this._releasables.add(releasable);
    }

    const propsMap = WatchableValue.from(
      ([parent]) => parent.get().get('props', () => layer.crdt.factory.makeMap())!,
      [edgeCrdt] as const
    );

    this.#props = new CRDTObject<EdgeProps>(propsMap, () => {
      getRemoteUnitOfWork(this.diagram).updateElement(this);
      this.clearCache();
    });
    this._releasables.add(this.#props);
    this._releasables.add(propsMap);
  }

  /* Factory ************************************************************************************************* */

  static _createEmpty(
    id: string,
    layer: RegularLayer | ModificationLayer,
    crdt?: CRDTMap<DiagramElementCRDT>
  ): DiagramEdge {
    return new SimpleDiagramEdge(id, layer, crdt);
  }

  static _create(
    id: string,
    start: Endpoint,
    end: Endpoint,
    props: EdgePropsForEditing,
    metadata: ElementMetadata,
    midpoints: ReadonlyArray<Waypoint>,
    layer: RegularLayer | ModificationLayer
  ) {
    const edge = new SimpleDiagramEdge(id, layer);

    edge.#endpoints._setStart(start);
    edge.#endpoints._setEnd(end);
    edge.#props.set(props as EdgeProps);
    if (midpoints.length > 0) edge.#waypoints.set(midpoints);

    metadata.style ??= DefaultStyles.edge.default;
    edge._metadata.set(metadata);

    UnitOfWork.executeSilently(layer.diagram, uow => {
      EdgeEndpoints.connectInitial(edge, start, end, uow);
    });

    return edge;
  }

  getDefinition(): EdgeDefinition {
    return this.diagram.document.registry.edges.get(this.renderProps.shape);
  }

  /* Props *************************************************************************************************** */

  getPropsInfo<T extends PropPath<EdgeProps>>(path: T): PropertyInfo<PropPathValue<EdgeProps, T>> {
    return resolvePropsInfo(this.getPropsSources(), edgeDefaults, path);
  }

  private getPropsSources(): ReadonlyArray<PropertySource<EdgeProps>> {
    const styleProps = this.diagram.document.styles.getEdgeStyle(this.metadata.style)?.props;

    const adjustments = getAdjustments(this._activeDiagram, this.id);
    const ruleProps = adjustments.map(([id, adjustment]) => ({
      id,
      props: adjustment.props as EdgeProps
    }));

    const ruleElementStyle = adjustments
      .map(([, v]) => v.elementStyle)
      .filter(e => !!e)
      .at(-1);
    const ruleStyleProps = this.diagram.document.styles.getEdgeStyle(ruleElementStyle)?.props;

    const sources: PropertySource<EdgeProps>[] = [{ type: 'default', mode: 'info-only' }];

    if (styleProps) {
      sources.push({
        type: 'style',
        props: styleProps,
        id: this.metadata.style,
        mode: 'editing-and-rendering'
      });
    }

    if (ruleStyleProps) {
      sources.push({
        type: 'ruleStyle',
        props: ruleStyleProps,
        mode: 'editing-and-rendering'
      });
    }

    sources.push({
      type: 'stored',
      props: this.#props.get(),
      mode: 'editing-and-rendering'
    });

    for (const { id, props } of ruleProps) {
      sources.push({
        type: 'rule',
        props,
        id,
        mode: 'rendering'
      });
    }

    return sources;
  }

  private populatePropsCache() {
    const sources = this.getPropsSources();
    const propsForEditing = resolveEditProps(sources) as DeepRequired<EdgeProps>;
    const propsForRendering = resolveRenderProps(sources, edgeDefaults);

    this.cache.set('props.forEditing', propsForEditing);
    this.cache.set('props.forRendering', propsForRendering);

    return {
      forEditing: propsForEditing,
      forRendering: propsForRendering
    };
  }

  get storedProps() {
    return this.#props.get();
  }

  get editProps(): EdgePropsForEditing {
    return (this.cache.get('props.forEditing') ??
      this.populatePropsCache().forEditing) as EdgePropsForEditing;
  }

  get renderProps(): EdgePropsForRendering {
    return (this.cache.get('props.forRendering') ??
      this.populatePropsCache().forRendering) as EdgePropsForRendering;
  }

  updateProps(callback: (props: EdgeProps) => void, uow: UnitOfWork) {
    uow.executeUpdate(this, () => {
      const oldType = this.#props.get().type;
      this.#props.update(callback);

      if (this.#props.get().type === 'bezier' && oldType !== 'bezier') {
        for (let i = 0; i < this.waypoints.length; i++) {
          const wp = this.waypoints[i]!;
          if (!wp.controlPoints) {
            this.replaceWaypoint(
              i,
              {
                ...wp,
                controlPoints: this.inferControlPoints(i)
              },
              uow
            );
          }
        }
      }
    });

    this.clearCache();
  }

  updateCustomProps<K extends keyof CustomEdgeProps>(
    key: K,
    callback: (props: NonNullable<CustomEdgeProps[K]>) => void,
    uow: UnitOfWork
  ) {
    this.updateProps(p => {
      p.custom ??= {};
      callback(ensureCustomProp(p.custom, key));
    }, uow);
  }

  inferControlPoints(i: number) {
    const before = i === 0 ? this.start.position : this.waypoints[i - 1]!.point;
    const after =
      i === this.waypoints.length - 1 ? this.end.position : this.waypoints[i + 1]!.point;

    return {
      cp1: Vector.scale(Vector.from(after, before), 0.2),
      cp2: Vector.scale(Vector.from(before, after), 0.2)
    };
  }

  isHidden() {
    return this.renderProps.hidden;
  }

  /* Name **************************************************************************************************** */

  get dataForTemplate() {
    return deepMerge(
      {
        name: this.metadata.name
      },
      this.metadata.data?.customData ?? {},
      ...(this.metadata.data?.data?.map(d => d.data) ?? [])
    );
  }

  get name() {
    // First we use any label nodes
    if (is.arrayNotEmpty(this.#labels.labelNodes)) {
      return this.#labels.labelNodes[0].node().name;
    }

    if (!isEmptyString(this.metadata.name)) {
      this.cache.set('name', this.metadata.name!);
      return this.cache.get('name') as string;
    }

    // ... otherwise we form the name based on connected nodes
    if (isConnectedEndpoint(this.start) || isConnectedEndpoint(this.end)) {
      let s = '';
      if (isConnectedEndpoint(this.start)) {
        s = isNodeConnectedEndpoint(this.start)
          ? this.start.node.name
          : (this.start.edge?.name ?? '');
      }
      s += ' - ';
      if (isConnectedEndpoint(this.end)) {
        s += isNodeConnectedEndpoint(this.end) ? this.end.node.name : (this.end.edge?.name ?? '');
      }
      return s;
    }

    // ... finally we use the id
    return this.id;
  }

  /* Bounds ************************************************************************************************* */

  // TODO: This is probably not a sufficient way to calculate the bounding box
  //       Maybe we should include the extent of labels as well as the curve itself - i.e
  //       all points
  get bounds() {
    return Box.fromCorners(this.#endpoints.start.position, this.#endpoints.end.position);
  }

  setBounds(b: Box, uow: UnitOfWork) {
    uow.executeUpdate(this, () => {
      const delta = Point.subtract(b, this.bounds);

      if (delta.x !== 0 || delta.y !== 0) {
        if (!isConnectedEndpoint(this.start)) {
          this.#endpoints._setStart(new FreeEndpoint(Point.add(this.start.position, delta)));
        }
        if (!isConnectedEndpoint(this.end)) {
          this.#endpoints._setEnd(new FreeEndpoint(Point.add(this.end.position, delta)));
        }
      }
    });
  }

  /* Endpoints ********************************************************************************************** */

  setStart(start: Endpoint, uow: UnitOfWork) {
    this.#endpoints.setStart(start, uow);
  }

  get start() {
    return this.#endpoints.start;
  }

  setEnd(end: Endpoint, uow: UnitOfWork) {
    this.#endpoints.setEnd(end, uow);
  }

  get end() {
    return this.#endpoints.end;
  }

  isConnected() {
    return this.#endpoints.isConnected();
  }

  get attachedEdges(): ReadonlyArray<DiagramEdge> {
    return this.#endpoints.attachedEdges;
  }

  _addAttachedEdge(edge: DiagramEdge, uow: UnitOfWork) {
    this.#endpoints._addAttachedEdge(edge, uow);
  }

  _removeAttachedEdge(edge: DiagramEdge, uow: UnitOfWork) {
    this.#endpoints._removeAttachedEdge(edge, uow);
  }

  isTransitivelyAttachedTo(edge: DiagramEdge, seen = new Set<string>()) {
    return this.#endpoints.isTransitivelyAttachedTo(edge, seen);
  }

  /* Label Nodes ******************************************************************************************** */

  get labelNodes() {
    return this.#labels.labelNodes;
  }

  removeChild(child: DiagramElement, uow: UnitOfWork) {
    if (isNode(child)) {
      child._disconnectAttachedEdges(uow);
    }

    super.removeChild(child, uow);
    this.syncLabelNodesBasedOnChildren(uow);
  }

  addChild(child: DiagramElement, uow: UnitOfWork, position?: number) {
    // Note: we don't support edges to be children of edges
    assert.true(isNode(child));

    super.addChild(child, uow, position);
    this.syncLabelNodesBasedOnChildren(uow);
  }

  setChildren(children: ReadonlyArray<DiagramElement>, uow: UnitOfWork) {
    // Note: we don't support edges to be children of edges
    assert.true(children.every(isNode));

    super.setChildren(children, uow);
    this.syncLabelNodesBasedOnChildren(uow);
  }

  private syncLabelNodesBasedOnChildren(uow: UnitOfWork) {
    uow.executeUpdate(this, () => {
      // Find all children with corresponding label node
      const existingLabelNodes = this.#labels.labelNodes.filter(ln =>
        this.children.find(c => c.id === ln.node().id)
      );

      const newLabelNodes: ResolvedLabelNode[] = [];
      for (const c of this.children) {
        assert.node(c);

        if (!existingLabelNodes.find(ln => ln.node() === c)) {
          newLabelNodes.push({
            id: c.id,
            node: () => c,
            type: 'perpendicular',
            offset: {
              x: 0,
              y: 0
            },
            offsetType: 'absolute',
            timeOffset: 0
          });
        }
      }

      this.#labels.set([...existingLabelNodes, ...newLabelNodes]);
    });

    this.#labels.consistencyInvariant(this.children);
  }

  private syncChildrenBasedOnLabelNodes(uow: UnitOfWork) {
    uow.executeUpdate(this, () => {
      this.#labels.labelNodes.forEach(ln => {
        const node = ln.node();
        const layer = node.layer;
        if (layer.type === 'regular') {
          assertRegularLayer(layer);
          const inLayerElements = layer.elements.find(e => e === node);
          if (inLayerElements) {
            layer.removeElement(node, uow);
          }

          if (!this.children.find(c => c.id === node.id)) {
            super.addChild(node, uow);
          }

          assert.true(node.parent === this);

          layer.diagram.register(node);
        } else {
          assert.fail('Label nodes should be part of regular layer');
        }
      });

      for (const c of this.children) {
        if (!this.#labels.labelNodes.find(ln => ln.node() === c)) {
          this.removeChild(c, uow);
        }
      }
    });

    this.#labels.consistencyInvariant(this.children);
  }

  setLabelNodes(labelNodes: ReadonlyArray<ResolvedLabelNode> | undefined, uow: UnitOfWork) {
    this.#labels.set(labelNodes);
    this.syncChildrenBasedOnLabelNodes(uow);
  }

  addLabelNode(labelNode: ResolvedLabelNode, uow: UnitOfWork) {
    this.setLabelNodes([...this.labelNodes, labelNode], uow);
  }

  removeLabelNode(labelNode: ResolvedLabelNode, uow: UnitOfWork) {
    assert.true(!!this.labelNodes.find(n => labelNode.id === n.id));

    this.setLabelNodes(
      this.labelNodes.filter(ln => ln.id !== labelNode.id),
      uow
    );
  }

  /* Waypoints ********************************************************************************************** */

  get waypoints(): ReadonlyArray<Waypoint> {
    return this.#waypoints.get() ?? [];
  }

  addWaypoint(waypoint: Waypoint, uow: UnitOfWork) {
    return uow.executeUpdate(this, () => {
      const path = this.path();
      const projection = path.projectPoint(waypoint.point);

      if (this.#props.get().type === 'bezier' && !waypoint.controlPoints) {
        const offset = PointOnPath.toTimeOffset({ point: waypoint.point }, path);
        const [p1, p2] = path.split(offset);

        const segments: CubicSegment[] = [];
        for (const s of [...p1.segments, ...p2.segments]) {
          if (s instanceof CubicSegment) {
            segments.push(s);
          } else if (s instanceof LineSegment) {
            segments.push(CubicSegment.fromLine(s));
          }
        }
        const newWaypoints: Waypoint[] = [];

        for (let i = 0; i < segments.length - 1; i++) {
          const segment = segments[i]!;
          newWaypoints.push({
            point: segment.end,
            controlPoints: {
              cp1: Point.subtract(segment.p2, segment.end),
              cp2: Point.subtract(segments[i + 1]!.p1, segment.end)
            }
          });
        }

        this.#waypoints.set(newWaypoints);

        return offset.segment;
      } else {
        const wpDistances = this.waypoints.map(p => {
          return {
            pathD: PointOnPath.toTimeOffset({ point: p.point }, path).pathD,
            ...p
          };
        });

        const newWaypoint = { ...waypoint, pathD: projection.pathD };
        this.#waypoints.set(
          [...wpDistances, newWaypoint].sort((a, b) => a.pathD - b.pathD) as Array<Waypoint>
        );

        return this.waypoints.indexOf(newWaypoint);
      }
    });
  }

  removeWaypoint(waypoint: Waypoint, uow: UnitOfWork) {
    uow.executeUpdate(this, () => {
      this.#waypoints.set(this.waypoints.filter(w => w !== waypoint));
    });
  }

  moveWaypoint(waypoint: Waypoint, point: Point, uow: UnitOfWork) {
    uow.executeUpdate(this, () => {
      this.#waypoints.set(this.waypoints.map(w => (w === waypoint ? { ...w, point } : w)));
    });
  }

  replaceWaypoint(idx: number, waypoint: Waypoint, uow: UnitOfWork) {
    uow.executeUpdate(this, () => {
      this.#waypoints.set(this.waypoints.map((w, i) => (i === idx ? waypoint : w)));
    });
  }

  /* Snapshot ************************************************************************************************ */

  snapshot(): DiagramEdgeSnapshot {
    return {
      _snapshotType: 'edge',
      id: this.id,
      type: 'edge',
      props: this.#props.getClone(),
      metadata: this._metadata.getClone() as ElementMetadata,
      start: this.start.serialize(),
      end: this.end.serialize(),
      waypoints: deepClone(this.waypoints),
      labelNodes: this.labelNodes.map(ln => ({
        id: ln.id,
        type: ln.type,
        offset: ln.offset,
        offsetType: ln.offsetType ?? 'absolute',
        timeOffset: ln.timeOffset
      })),
      tags: [...this.tags]
    };
  }

  // TODO: Add assertions for lookups
  restore(snapshot: DiagramEdgeSnapshot, uow: UnitOfWork) {
    this.#props.set(snapshot.props as EdgeProps);
    this.setStart(
      Endpoint.deserialize(snapshot.start, this.diagram.nodeLookup, this.diagram.edgeLookup, true),
      uow
    );
    this.setEnd(
      Endpoint.deserialize(snapshot.end, this.diagram.nodeLookup, this.diagram.edgeLookup, true),
      uow
    );
    this.#waypoints.set((snapshot.waypoints ?? []) as Array<Waypoint>);

    this.#labels.set(
      snapshot.labelNodes?.map(ln => ({
        ...ln,
        node: () => this.diagram.nodeLookup.get(ln.id)!
      })) ?? []
    );

    this.syncChildrenBasedOnLabelNodes(uow);

    this.setTags(snapshot.tags ?? [], uow);

    uow.updateElement(this);
    this.clearCache();
  }

  duplicate(ctx?: DuplicationContext, id?: string) {
    assert.false(this.id === id);

    return UnitOfWork.executeSilently(this.diagram, uow => {
      const edge = SimpleDiagramEdge._create(
        id ?? newid(),
        this.start,
        this.end,
        this.#props.getClone() as EdgeProps,
        deepClone(this.metadata),
        deepClone(this.waypoints) as Array<Waypoint>,
        this.layer
      );

      ctx?.targetElementsInGroup.set(this.id, edge);

      // Clone any label nodes
      const newLabelNodes: ResolvedLabelNode[] = [];
      for (let i = 0; i < this.labelNodes.length; i++) {
        const l = this.labelNodes[i]!;

        const newNode = l.node().duplicate(ctx, id ? `${id}-${i}` : undefined);
        newLabelNodes.push({
          ...l,
          id: newNode.id,
          node: () => newNode
        });
      }
      edge.setLabelNodes(newLabelNodes, uow);

      return edge;
    });
  }

  /* ***** ***** ******************************************************************************************** */

  isLocked() {
    return this.layer.isLocked();
  }

  // TODO: Should this really be in DiagramEdge??
  path(): Path {
    // TODO: We should be able to cache this, and then invalidate it when the edge changes (see invalidate())

    const startDirection = this._getNormalDirection(this.start);
    const endDirection = this._getNormalDirection(this.end);

    return buildEdgePath(
      this,
      startDirection,
      endDirection ? Direction.opposite(endDirection) : undefined
    );
  }

  /**
   * In case the endpoint is connected, there are two options; either
   * the anchor has a normal (and we will use it) - or we need to calculate
   * the normal based on the point and the boundary path
   *
   * In case the endpoint is not connected, there's no inherent direction to use
   *
   * Note that this gives you the direction of the endpoint as the node
   * is rotated - i.e. rotating the node will have an effect on which direction
   * this method returns
   *
   * TODO: Could we move this to the endpoint?
   */
  private _getNormalDirection(endpoint: Endpoint) {
    if (endpoint instanceof PointOnEdgeEndpoint) {
      const path = endpoint.edge.path();
      const length = path.length();
      if (length === 0 || Number.isNaN(length)) return undefined;

      return Direction.fromVector(
        path.tangentAt({ pathD: length * endpoint.normalizedPathPosition })
      );
    } else if (isNodeConnectedEndpoint(endpoint)) {
      // Check if the node is inside a collapsed container
      const collapsedAncestor = getCollapsedAncestor(endpoint.node);

      if (collapsedAncestor) {
        // When collapsed, calculate normal based on the collapsed container's boundary
        const boundingPath = collapsedAncestor.getDefinition().getBoundingPath(collapsedAncestor);

        const paths = boundingPath.all();

        const t = boundingPath.projectPoint(endpoint.position);
        const tangent = paths[t.pathIdx]!.tangentAt(t.offset);

        return Direction.fromVector(Vector.tangentToNormal(tangent));
      }

      if (endpoint instanceof AnchorEndpoint && endpoint.getAnchor().normal !== undefined) {
        return Direction.fromAngle(endpoint.getAnchor().normal! + endpoint.node.bounds.r, true);
      }

      const startNode = endpoint.node;
      const boundingPath = startNode.getDefinition().getBoundingPath(startNode);
      const paths = boundingPath.all();

      if (endpoint instanceof PointInNodeEndpoint && (endpoint.isMidpoint() || endpoint.isCorner()))
        return undefined;

      // ... else, we calculate the normal assuming the closest point to the
      // endpoint on the boundary path
      const t = boundingPath.projectPoint(endpoint.position);

      const tangent = paths[t.pathIdx]!.tangentAt(t.offset);

      // TODO: We need to check this is going in the right direction (i.e. outwards)
      //       probably need to pick up some code from ShapeNodeDefinition.getAnchors

      return Direction.fromVector(Vector.tangentToNormal(tangent));
    }
    return undefined;
  }

  transform(transforms: ReadonlyArray<Transform>, uow: UnitOfWork): void {
    uow.executeUpdate(this, () => {
      this.setBounds(Transform.box(this.bounds, ...transforms), uow);
      this._transformWaypoints(transforms);
    });
  }

  _transformWaypoints(transforms: ReadonlyArray<Transform>) {
    this.#waypoints.set(
      this.waypoints.map(w => {
        const absoluteControlPoints = Object.values(w.controlPoints ?? {}).map(cp =>
          Point.add(w.point, cp)
        );
        const transformedControlPoints = absoluteControlPoints.map(cp =>
          Transform.point(cp, ...transforms)
        );
        const transformedPoint = Transform.point(w.point, ...transforms);
        const relativeControlPoints = transformedControlPoints.map(cp =>
          Point.subtract(cp, transformedPoint)
        );

        return {
          point: transformedPoint,
          controlPoints: w.controlPoints
            ? {
                cp1: relativeControlPoints[0]!,
                cp2: relativeControlPoints[1]!
              }
            : undefined
        };
      })
    );
  }

  get intersections() {
    return this.#intersections;
  }

  flip(uow: UnitOfWork) {
    this.#endpoints.flip(uow);
  }

  /**
   * Called in case the edge has been changed and needs to be recalculated
   *
   *  edge -> label nodes -> ...
   *       -> intersecting edges
   *
   * Note, that whilst an edge can be part of a group, a change to the edge will not
   * impact the state and/or bounds of the parent group/container
   */
  invalidate(scope: InvalidationScope, uow: UnitOfWork) {
    // Ensure we don't get into an infinite loop
    uow.metadata.invalidated ??= new Set();
    if (uow.metadata.invalidated.has(this)) return;
    uow.metadata.invalidated.add(this);

    this.#labels.adjustPositions(this.path(), uow);
    for (const edge of this.attachedEdges) {
      if (!edge._isAttached) continue;
      uow.updateElement(edge, edge.snapshot());
      edge.invalidate(scope, uow);
    }
    if (scope === 'full') {
      this._recalculateIntersections(uow, true);
    }
  }

  _attach(parent: DiagramElement | Layer, uow: UnitOfWork): void {
    super._attach(parent, uow);

    // After this edge is registered in the lookup, find any already-attached edges
    // that have a PointOnEdgeEndpoint referencing this edge and register them as
    // attached. This handles the undo case where a referencing edge was restored
    // before this one.
    this.#endpoints.reattach(uow);
  }

  _onDetach(uow: UnitOfWork) {
    // All label nodes must be detached
    for (const l of this.labelNodes) {
      l.node()._onDetach(uow);
    }

    this.#endpoints.detach(uow);
  }

  _recalculateIntersections(uow: UnitOfWork, propagate = false) {
    if (!this.diagram.hasEdgesWithLineHops) return;

    const next = recalculateIntersections(this, this.diagram);
    if (!intersectionListIsSame(next, this.#intersections)) {
      this.#intersections = next;
      uow.updateElement(this);
    }

    if (propagate) {
      for (const edge of this.diagram.visibleElements()) {
        if (!isEdge(edge) || edge === this) continue;
        edge._recalculateIntersections(uow, false);
      }
    }
  }

  getAttachmentsInUse(): Array<string> {
    return [];
  }
}

UOWRegistry.adapters['element'] = new DiagramElementUOWAdapter();
UOWRegistry.childAdapters['element-element'] = new DiagramElementChildUOWAdapter();
