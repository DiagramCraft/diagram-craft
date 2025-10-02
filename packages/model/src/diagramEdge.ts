import { DiagramNode, DuplicationContext } from './diagramNode';
import { LabelNode, Waypoint } from './types';
import { Point } from '@diagram-craft/geometry/point';
import { Vector } from '@diagram-craft/geometry/vector';
import { Box } from '@diagram-craft/geometry/box';
import { PointOnPath, TimeOffsetOnPath } from '@diagram-craft/geometry/pathPosition';
import { CubicSegment, LineSegment } from '@diagram-craft/geometry/pathSegment';
import { Transform } from '@diagram-craft/geometry/transform';
import { DiagramElement, type DiagramElementCRDT, isEdge, isNode } from './diagramElement';
import { DiagramEdgeSnapshot, getRemoteUnitOfWork, UnitOfWork, UOWTrackable } from './unitOfWork';
import {
  AnchorEndpoint,
  ConnectedEndpoint,
  Endpoint,
  FreeEndpoint,
  PointInNodeEndpoint
} from './endpoint';
import { DefaultStyles, edgeDefaults } from './diagramDefaults';
import { buildEdgePath } from './edgePathBuilder';
import { isHorizontal, isParallel, isPerpendicular, isReadable, isVertical } from './labelNode';
import { DeepReadonly, DeepRequired } from '@diagram-craft/utils/types';
import { deepClone, deepMerge } from '@diagram-craft/utils/object';
import { newid } from '@diagram-craft/utils/id';
import { isDifferent } from '@diagram-craft/utils/math';
import { Direction } from '@diagram-craft/geometry/direction';
import { EdgeDefinition } from './elementDefinitionRegistry';
import { isEmptyString } from '@diagram-craft/utils/strings';
import { assert, is, mustExist } from '@diagram-craft/utils/assert';
import { DynamicAccessor, PropPath, PropPathValue } from '@diagram-craft/utils/propertyPath';
import { PropertyInfo } from '@diagram-craft/main/react-app/toolwindow/ObjectToolWindow/types';
import { getAdjustments } from './diagramLayerRuleTypes';
import type { RegularLayer } from './diagramLayerRegular';
import { assertRegularLayer } from './diagramLayerUtils';
import type { Reference, SerializedEndpoint } from './serialization/types';
import type { CRDTMap, FlatCRDTMap } from './collaboration/crdt';
import { WatchableValue } from '@diagram-craft/utils/watchableValue';
import {
  MappedCRDTOrderedMap,
  type MappedCRDTOrderedMapMapType
} from './collaboration/datatypes/mapped/mappedCrdtOrderedMap';
import { type CRDTMapper } from './collaboration/datatypes/mapped/types';
import { CRDTProp } from './collaboration/datatypes/crdtProp';
import { MappedCRDTProp } from './collaboration/datatypes/mapped/mappedCrdtProp';
import { CRDTObject } from './collaboration/datatypes/crdtObject';

const isConnected = (endpoint: Endpoint): endpoint is ConnectedEndpoint =>
  endpoint instanceof ConnectedEndpoint;

export type ResolvedLabelNode = LabelNode & {
  node: () => DiagramNode;
};

export type Intersection = {
  point: Point;
  type: 'above' | 'below';
};

const intersectionListIsSame = (a: Intersection[], b: Intersection[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!Point.isEqual(a[i]!.point, b[i]!.point)) return false;
    if (a[i]!.type !== b[i]!.type) return false;
  }
  return true;
};

export type EdgePropsForEditing = DeepReadonly<EdgeProps>;
export type EdgePropsForRendering = DeepReadonly<DeepRequired<EdgeProps>>;

declare global {
  interface AdditionalCRDTCompatibleInnerObjects {
    reference: Reference;
  }
}

type LabelNodeCRDTEntry = { node: LabelNode & { nodeId: string } };

export type DiagramEdgeCRDT = DiagramElementCRDT & {
  start: SerializedEndpoint;
  end: SerializedEndpoint;
  props: FlatCRDTMap;
  labelNodes: CRDTMap<MappedCRDTOrderedMapMapType<LabelNodeCRDTEntry>>;
  waypoints: ReadonlyArray<Waypoint>;
};

const makeLabelNodeMapper = (
  edge: DiagramEdge
): CRDTMapper<ResolvedLabelNode, CRDTMap<LabelNodeCRDTEntry>> => {
  return {
    fromCRDT(e: CRDTMap<LabelNodeCRDTEntry>): ResolvedLabelNode {
      const node = e.get('node')!;
      return {
        ...node,
        node: () => mustExist(edge.diagram.nodeLookup.get(node.nodeId))
      };
    },

    toCRDT(e: ResolvedLabelNode): CRDTMap<LabelNodeCRDTEntry> {
      const m = edge.crdt.get().factory.makeMap<LabelNodeCRDTEntry>();
      m.set('node', {
        id: e.id,
        nodeId: e.node().id,
        offset: e.offset,
        type: e.type,
        timeOffset: e.timeOffset
      });
      return m;
    }
  };
};

const makeEndpointMapper = (edge: DiagramEdge): CRDTMapper<Endpoint, SerializedEndpoint> => ({
  fromCRDT: (e: SerializedEndpoint) => Endpoint.deserialize(e, edge.diagram.nodeLookup, true),
  toCRDT: (e: Endpoint) => e.serialize()
});

export class DiagramEdge extends DiagramElement implements UOWTrackable<DiagramEdgeSnapshot> {
  // Transient properties
  #intersections: Intersection[] = [];

  // Shared properties
  readonly #waypoints: CRDTProp<DiagramEdgeCRDT, 'waypoints'>;
  readonly #labelNodes: MappedCRDTOrderedMap<ResolvedLabelNode, LabelNodeCRDTEntry>;
  readonly #start: MappedCRDTProp<DiagramEdgeCRDT, 'start', Endpoint>;
  readonly #end: MappedCRDTProp<DiagramEdgeCRDT, 'end', Endpoint>;
  readonly #props: CRDTObject<EdgeProps>;

  constructor(id: string, layer: RegularLayer, crdt?: CRDTMap<DiagramElementCRDT>) {
    super('edge', id, layer, crdt);

    const edgeCrdt = this._crdt as unknown as WatchableValue<CRDTMap<DiagramEdgeCRDT>>;

    this.#waypoints = new CRDTProp(edgeCrdt, 'waypoints', {
      onRemoteChange: () => getRemoteUnitOfWork(this.diagram).updateElement(this),
      initialValue: []
    });

    this.#labelNodes = new MappedCRDTOrderedMap<ResolvedLabelNode, LabelNodeCRDTEntry>(
      WatchableValue.from(
        ([m]) => m.get().get('labelNodes', () => layer.diagram.document.root.factory.makeMap())!,
        [edgeCrdt]
      ),
      makeLabelNodeMapper(this)
    );

    this.#start = new MappedCRDTProp<DiagramEdgeCRDT, 'start', Endpoint>(
      edgeCrdt,
      'start',
      makeEndpointMapper(this),
      {
        onRemoteChange: () => getRemoteUnitOfWork(this.diagram).updateElement(this)
      }
    );

    this.#end = new MappedCRDTProp<DiagramEdgeCRDT, 'end', Endpoint>(
      edgeCrdt,
      'end',
      makeEndpointMapper(this),
      {
        onRemoteChange: () => getRemoteUnitOfWork(this.diagram).updateElement(this)
      }
    );

    const propsMap = WatchableValue.from(
      ([parent]) => parent.get().get('props', () => layer.crdt.factory.makeMap())!,
      [edgeCrdt] as const
    );

    this.#props = new CRDTObject<EdgeProps>(propsMap, () => {
      getRemoteUnitOfWork(this.diagram).updateElement(this);
      this._cache?.clear();
    });
  }

  /* Factory ************************************************************************************************* */

  static create(
    id: string,
    start: Endpoint,
    end: Endpoint,
    props: EdgePropsForEditing,
    metadata: ElementMetadata,
    midpoints: ReadonlyArray<Waypoint>,
    layer: RegularLayer
  ) {
    const edge = new DiagramEdge(id, layer);

    edge.#start.set(start);
    edge.#end.set(end);
    edge.#props.set(props as EdgeProps);
    if (midpoints.length > 0) edge.#waypoints.set(midpoints);

    metadata.style ??= DefaultStyles.edge.default;
    edge._metadata.set(metadata);

    if (start instanceof ConnectedEndpoint)
      start.node._addEdge(start instanceof AnchorEndpoint ? start.anchorId : undefined, edge);
    if (end instanceof ConnectedEndpoint)
      end.node._addEdge(end instanceof AnchorEndpoint ? end.anchorId : undefined, edge);

    return edge;
  }

  getDefinition(): EdgeDefinition {
    return this.diagram.document.edgeDefinitions.get(this.renderProps.shape);
  }

  /* Props *************************************************************************************************** */

  getPropsInfo<T extends PropPath<EdgeProps>>(path: T): PropertyInfo<PropPathValue<EdgeProps, T>> {
    const { styleProps, ruleProps, ruleStyleProps } = this.getPropsSources();

    const accessor = new DynamicAccessor<EdgeProps>();

    const dest: PropertyInfo<PropPathValue<EdgeProps, T>> = [];

    dest.push({
      val: edgeDefaults.get(path) as PropPathValue<EdgeProps, T>,
      type: 'default'
    });

    if (styleProps) {
      dest.push({
        val: accessor.get(styleProps, path) as PropPathValue<EdgeProps, T>,
        type: 'style',
        id: this.metadata.style
      });
    }

    if (ruleStyleProps) {
      dest.push({
        val: accessor.get(ruleStyleProps, path) as PropPathValue<EdgeProps, T>,
        type: 'ruleStyle'
      });
    }

    dest.push({
      val: accessor.get(this.#props.get(), path) as PropPathValue<EdgeProps, T>,
      type: 'stored'
    });

    for (const rp of ruleProps) {
      dest.push({
        val: accessor.get(rp[1], path) as PropPathValue<EdgeProps, T>,
        type: 'rule',
        id: rp[0]
      });
    }

    return dest.filter(e => e.val !== undefined);
  }

  private getPropsSources() {
    const styleProps = this.diagram.document.styles.getEdgeStyle(this.metadata.style)?.props;

    const adjustments = getAdjustments(this._activeDiagram, this.id);
    const ruleProps = adjustments.map(([k, v]) => [k, v.props]);

    const ruleElementStyle = adjustments
      .map(([, v]) => v.elementStyle)
      .filter(e => !!e)
      .at(-1);
    const ruleStyleProps = this.diagram.document.styles.getEdgeStyle(ruleElementStyle)?.props;

    return { styleProps, ruleProps: ruleProps as [string, EdgeProps][], ruleStyleProps };
  }

  private populatePropsCache() {
    const { styleProps, ruleProps, ruleStyleProps } = this.getPropsSources();

    const consolidatedRulesProps = ruleProps.reduce(
      (p, c) => deepMerge<EdgeProps>({}, p, c[1]),
      {}
    );

    const propsForEditing = deepMerge(
      {},
      styleProps ?? {},
      ruleStyleProps ?? {},
      this.#props.get()
    ) as DeepRequired<EdgeProps>;

    const propsForRendering = edgeDefaults.applyDefaults(
      deepMerge({}, propsForEditing, consolidatedRulesProps)
    );

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

  get storedPropsCloned() {
    return this.#props.getClone();
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
    uow.snapshot(this);

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

    uow.updateElement(this);

    this._cache?.clear();
  }

  updateCustomProps<K extends keyof CustomEdgeProps>(
    key: K,
    callback: (props: NonNullable<CustomEdgeProps[K]>) => void,
    uow: UnitOfWork
  ) {
    this.updateProps(p => {
      p.custom ??= {};
      p.custom[key] ??= {};
      callback(p.custom[key]!);
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
    if (is.arrayNotEmpty(this.#labelNodes.values)) {
      return this.#labelNodes.values[0].node().name;
    }

    if (!isEmptyString(this.metadata.name)) {
      this.cache.set('name', this.metadata.name!);
      return this.cache.get('name') as string;
    }

    // ... otherwise we form the name based on connected nodes
    if (isConnected(this.start) || isConnected(this.end)) {
      let s = '';
      if (isConnected(this.start)) {
        s = this.start.node.name;
      }
      s += ' - ';
      if (isConnected(this.end)) {
        s += this.end.node.name;
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
    return Box.fromCorners(this.#start.getNonNull().position, this.#end.getNonNull().position);
  }

  setBounds(b: Box, uow: UnitOfWork) {
    uow.snapshot(this);

    const delta = Point.subtract(b, this.bounds);

    if (!isConnected(this.start)) {
      this.#start.set(
        new FreeEndpoint({
          x: this.start.position.x + delta.x,
          y: this.start.position.y + delta.y
        })
      );
      uow.updateElement(this);
    }
    if (!isConnected(this.end)) {
      this.#end.set(
        new FreeEndpoint({
          x: this.end.position.x + delta.x,
          y: this.end.position.y + delta.y
        })
      );
      uow.updateElement(this);
    }
  }

  /* Endpoints ********************************************************************************************** */

  setStart(start: Endpoint, uow: UnitOfWork) {
    uow.snapshot(this);

    if (isConnected(this.start)) {
      uow.snapshot(this.start.node);

      this.start.node._removeEdge(
        this.start instanceof AnchorEndpoint ? this.start.anchorId : undefined,
        this
      );
      uow.updateElement(this.start.node);
    }

    if (isConnected(start)) {
      uow.snapshot(start.node);

      start.node._addEdge(start instanceof AnchorEndpoint ? start.anchorId : undefined, this);
      uow.updateElement(start.node);
    }

    this.#start.set(start);

    uow.updateElement(this);
  }

  get start() {
    return this.#start.getNonNull();
  }

  setEnd(end: Endpoint, uow: UnitOfWork) {
    uow.snapshot(this);

    if (isConnected(this.end)) {
      uow.snapshot(this.end.node);

      this.end.node._removeEdge(
        this.end instanceof AnchorEndpoint ? this.end.anchorId : undefined,
        this
      );
      uow.updateElement(this.end.node);
    }

    if (isConnected(end)) {
      uow.snapshot(end.node);

      end.node._addEdge(end instanceof AnchorEndpoint ? end.anchorId : undefined, this);
      uow.updateElement(end.node);
    }

    this.#end.set(end);

    uow.updateElement(this);
  }

  get end() {
    return this.#end.getNonNull();
  }

  isConnected() {
    return isConnected(this.start) || isConnected(this.end);
  }

  /* Label Nodes ******************************************************************************************** */

  get labelNodes() {
    return this.#labelNodes.values;
  }

  removeChild(child: DiagramElement, uow: UnitOfWork) {
    super.removeChild(child, uow);
    this.syncLabelNodesBasedOnChildren(uow);
  }

  addChild(child: DiagramElement, uow: UnitOfWork) {
    // Note: we don't support edges to be children of edges
    assert.true(isNode(child));

    super.addChild(child, uow);
    this.syncLabelNodesBasedOnChildren(uow);
  }

  setChildren(children: ReadonlyArray<DiagramElement>, uow: UnitOfWork) {
    // Note: we don't support edges to be children of edges
    assert.true(children.every(isNode));

    super.setChildren(children, uow);
    this.syncLabelNodesBasedOnChildren(uow);
  }

  private syncLabelNodesBasedOnChildren(uow: UnitOfWork) {
    uow.snapshot(this);

    // Find all children with corresponding label node
    const existingLabelNodes = this.#labelNodes.values.filter(ln =>
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
          timeOffset: 0
        });
      }
    }

    this.#labelNodes.set([...existingLabelNodes, ...newLabelNodes].map(n => [n.id, n]));
    uow.updateElement(this);

    this.labelNodeConsistencyInvariant();
  }

  private syncChildrenBasedOnLabelNodes(uow: UnitOfWork) {
    uow.snapshot(this);

    this.#labelNodes.values.forEach(ln => {
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

        const inDiagram =
          layer.diagram.nodeLookup.has(node.id) || layer.diagram.edgeLookup.has(node.id);
        if (!inDiagram) {
          layer.addElement(node, uow);
        }
      } else {
        assert.fail('Label nodes should be part of regular layer');
      }

      uow.snapshot(node);
      uow.updateElement(node);
    });

    for (const c of this.children) {
      if (!this.#labelNodes.values.find(ln => ln.node() === c)) {
        this.removeChild(c, uow);
      }
    }

    uow.updateElement(this);

    this.labelNodeConsistencyInvariant();
  }

  setLabelNodes(labelNodes: ReadonlyArray<ResolvedLabelNode> | undefined, uow: UnitOfWork) {
    this.#labelNodes.set(labelNodes?.map(n => [n.id, n]) ?? []);
    this.syncChildrenBasedOnLabelNodes(uow);
  }

  addLabelNode(labelNode: ResolvedLabelNode, uow: UnitOfWork) {
    uow.snapshot(this);

    this.setLabelNodes([...this.labelNodes, labelNode], uow);
  }

  removeLabelNode(labelNode: ResolvedLabelNode, uow: UnitOfWork) {
    assert.true(!!this.labelNodes.find(n => labelNode.id === n.id));

    uow.snapshot(this);

    this.setLabelNodes(
      this.labelNodes.filter(ln => ln.id !== labelNode.id),
      uow
    );
  }

  private labelNodeConsistencyInvariant() {
    DEBUG: {
      // Check that labelNodes and children have the same length
      assert.true(
        this.#labelNodes.size === this.children.length,
        `Label nodes don't match children - different length; ${this.children.length} != ${this.#labelNodes.size}`
      );

      // Check that labelNodes and children have the same nodes
      for (const ln of this.#labelNodes.values) {
        assert.true(
          !!this.children.find(c => c.id === ln.node().id),
          `Label node doesn't match children - different ids; ${this.children.map(c => c.id).join(', ')} != ${this.#labelNodes.values.map(ln => ln.node().id).join(', ')}`
        );
      }

      // Check that no children are elements of the layer
      for (const c of this.children) {
        assert.false(
          c.layer.type === 'regular' && !!c.layer.elements.find(e => e === c),
          "Label node doesn't match children - element"
        );
      }

      // Check that all children are part of the element mapping of the diagram
      for (const c of this.children) {
        assert.true(
          c.diagram.nodeLookup.has(c.id) || c.diagram.edgeLookup.has(c.id),
          "Label node doesn't match children - diagram"
        );
      }
    }
  }

  /* Waypoints ********************************************************************************************** */

  get waypoints(): ReadonlyArray<Waypoint> {
    return this.#waypoints.get() ?? [];
  }

  addWaypoint(waypoint: Waypoint, uow: UnitOfWork) {
    uow.snapshot(this);

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

      uow.updateElement(this);

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

      uow.updateElement(this);

      return this.waypoints.indexOf(newWaypoint);
    }
  }

  removeWaypoint(waypoint: Waypoint, uow: UnitOfWork) {
    uow.snapshot(this);
    this.#waypoints.set(this.waypoints.filter(w => w !== waypoint));
    uow.updateElement(this);
  }

  moveWaypoint(waypoint: Waypoint, point: Point, uow: UnitOfWork) {
    uow.snapshot(this);
    this.#waypoints.set(this.waypoints.map(w => (w === waypoint ? { ...w, point } : w)));
    uow.updateElement(this);
  }

  replaceWaypoint(idx: number, waypoint: Waypoint, uow: UnitOfWork) {
    uow.snapshot(this);
    this.#waypoints.set(this.waypoints.map((w, i) => (i === idx ? waypoint : w)));
    uow.updateElement(this);
  }

  /* Midpoints *********************************************************************************************** */

  // TODO: Can we move this to Path?
  get midpoints() {
    const path = this.path();
    return path.segments.map(s => {
      return s.point(0.5);
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
        timeOffset: ln.timeOffset
      }))
    };
  }

  // TODO: Add assertions for lookups
  restore(snapshot: DiagramEdgeSnapshot, uow: UnitOfWork) {
    this.#props.set(snapshot.props as EdgeProps);
    this.setStart(Endpoint.deserialize(snapshot.start, this.diagram.nodeLookup), uow);
    this.setEnd(Endpoint.deserialize(snapshot.end, this.diagram.nodeLookup), uow);
    this.#waypoints.set((snapshot.waypoints ?? []) as Array<Waypoint>);

    this.#labelNodes.set(
      snapshot.labelNodes?.map(ln => [
        ln.id,
        {
          ...ln,
          node: () => this.diagram.nodeLookup.get(ln.id)!
        }
      ]) ?? []
    );

    this.syncChildrenBasedOnLabelNodes(uow);

    uow.updateElement(this);
    this._cache?.clear();
  }

  duplicate(ctx?: DuplicationContext, id?: string) {
    const uow = new UnitOfWork(this.diagram);

    const edge = DiagramEdge.create(
      id ?? newid(),
      this.start,
      this.end,
      deepClone(this.#props) as EdgeProps,
      deepClone(this.metadata),
      deepClone(this.waypoints) as Array<Waypoint>,
      this.layer
    );

    ctx?.targetElementsInGroup.set(this.id, edge);

    // Clone any label nodes
    const newLabelNodes: ResolvedLabelNode[] = [];
    for (let i = 0; i < edge.labelNodes.length; i++) {
      const l = edge.labelNodes[i]!;

      const newNode = l.node().duplicate(ctx, id ? `${id}-${i}` : undefined);
      newLabelNodes.push({
        ...l,
        node: () => newNode
      });
    }
    edge.setLabelNodes(newLabelNodes, uow);

    uow.abort();

    return edge;
  }

  /* ***** ***** ******************************************************************************************** */

  isLocked() {
    return this.layer.isLocked();
  }

  path() {
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
    if (isConnected(endpoint)) {
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

  transform(transforms: ReadonlyArray<Transform>, uow: UnitOfWork) {
    uow.snapshot(this);

    this.setBounds(Transform.box(this.bounds, ...transforms), uow);

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

    uow.updateElement(this);
  }

  get intersections() {
    return this.#intersections;
  }

  flip(uow: UnitOfWork) {
    uow.snapshot(this);

    const start = this.#start.getNonNull();
    const end = this.#end.getNonNull();

    // Need to "zero" the end so that the setters logic should work correctly
    this.#end.set(new FreeEndpoint(Point.ORIGIN));

    this.setStart(end, uow);
    this.setEnd(start, uow);
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
  invalidate(uow: UnitOfWork) {
    uow.snapshot(this);

    // Ensure we don't get into an infinite loop
    if (uow.hasBeenInvalidated(this)) return;
    uow.beginInvalidation(this);

    this.adjustLabelNodePosition(uow);
    this.recalculateIntersections(uow, true);
  }

  detach(uow: UnitOfWork) {
    // Update any parent
    if (this.parent) {
      this.parent.removeChild(this, uow);
    }

    // All label nodes must be detached
    for (const l of this.labelNodes) {
      l.node().detach(uow);
    }

    if (isConnected(this.start)) {
      this.start.node._removeEdge(
        this.start instanceof AnchorEndpoint ? this.start.anchorId : undefined,
        this
      );
    }
    if (isConnected(this.end)) {
      this.end.node._removeEdge(
        this.end instanceof AnchorEndpoint ? this.end.anchorId : undefined,
        this
      );
    }

    this.diagram.edgeLookup.delete(this.id);

    // Note, need to check if the element is still in the layer to avoid infinite recursion
    assert.true(this.layer.type === 'regular');
    if (this.layer.elements.includes(this)) {
      this.layer.removeElement(this, uow);
    }
  }

  private recalculateIntersections(uow: UnitOfWork, propagate = false) {
    if (!this.diagram.hasEdgesWithLineHops) return;

    let currentEdgeHasBeenSeen = false;
    const path = this.path();
    const intersections: Intersection[] = [];
    for (const edge of this.diagram.visibleElements()) {
      if (!isEdge(edge)) continue;

      uow.snapshot(edge);

      if (edge === this) {
        currentEdgeHasBeenSeen = true;
        continue;
      }

      // TODO: There's opportunity to optimize this by using the bounding box, but
      //       this requires the bounds() method to be more accurate

      const otherPath = edge.path();
      const intersectionsWithOther = path.intersections(otherPath);
      intersections.push(
        ...intersectionsWithOther.map(e => ({
          point: e.point,
          type: currentEdgeHasBeenSeen ? ('below' as const) : ('above' as const)
        }))
      );
      if (propagate) {
        edge.recalculateIntersections(uow, false);
      }
    }

    if (!intersectionListIsSame(intersections, this.#intersections)) {
      this.#intersections = intersections;
      uow.updateElement(this);
    }
  }

  private adjustLabelNodePosition(uow: UnitOfWork) {
    if (this.labelNodes.length === 0) return;

    const path = this.path();

    for (const labelNode of this.labelNodes) {
      const pathD = TimeOffsetOnPath.toLengthOffsetOnPath({ pathT: labelNode.timeOffset }, path);
      const attachmentPoint = path.pointAt(pathD);
      const labelNodeNode = labelNode.node();

      let newReferencePoint = Point.add(attachmentPoint, labelNode.offset);
      let newRotation = labelNodeNode.bounds.r;
      if (isParallel(labelNode.type) || isPerpendicular(labelNode.type)) {
        const tangent = path.tangentAt(pathD);

        if (isParallel(labelNode.type)) {
          newRotation = Vector.angle(tangent);
        } else {
          newRotation = Vector.angle(tangent) + Math.PI / 2;
        }

        if (isReadable(labelNode.type)) {
          if (newRotation > Math.PI / 2) newRotation -= Math.PI;
          if (newRotation < -Math.PI / 2) newRotation += Math.PI;
        }

        newReferencePoint = Point.add(
          attachmentPoint,
          Point.rotate({ x: -labelNode.offset.x, y: 0 }, Vector.angle(tangent) + Math.PI / 2)
        );
      } else if (isHorizontal(labelNode.type)) {
        newRotation = 0;
      } else if (isVertical(labelNode.type)) {
        newRotation = Math.PI / 2;
      }

      const referenceOffsetFromMidpoint = Point.of(0, 0);
      if (labelNodeNode.renderProps.text.align === 'left') {
        referenceOffsetFromMidpoint.x = labelNodeNode.bounds.w / 2;
      } else if (labelNodeNode.renderProps.text.align === 'right') {
        referenceOffsetFromMidpoint.x = -labelNodeNode.bounds.w / 2;
      }

      if (labelNodeNode.renderProps.text.valign === 'top') {
        referenceOffsetFromMidpoint.y = labelNodeNode.bounds.h / 2 + 6;
      } else if (labelNodeNode.renderProps.text.valign === 'bottom') {
        referenceOffsetFromMidpoint.y = -labelNodeNode.bounds.h / 2 - 1;
      }

      // Note, using rounding here to avoid infinite recursion
      newReferencePoint = Point.add(newReferencePoint, referenceOffsetFromMidpoint);
      const currentReferencePoint = Point.add(
        Box.center(labelNodeNode.bounds),
        referenceOffsetFromMidpoint
      );
      const hasChanged =
        isDifferent(newReferencePoint.x, currentReferencePoint.x) ||
        isDifferent(newReferencePoint.y, currentReferencePoint.y) ||
        isDifferent(newRotation, labelNodeNode.bounds.r);

      if (hasChanged) {
        labelNodeNode.setBounds(
          {
            ...labelNodeNode.bounds,
            r: newRotation,
            x: newReferencePoint.x - labelNodeNode.bounds.w / 2,
            y: newReferencePoint.y - labelNodeNode.bounds.h / 2
          },
          uow
        );
      }
    }
  }

  getAttachmentsInUse(): Array<string> {
    return [];
  }

  /* Query Support ***************************************************************************************** */

  toJSON() {
    return {
      id: this.id,
      parent: this.parent,
      type: 'edge',
      bounds: this.bounds,
      props: this.renderProps,
      children: this.children
    };
  }

  get props() {
    return this.renderProps;
  }
}
