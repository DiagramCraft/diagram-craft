import { DelegatingDiagramElement } from './delegatingDiagramElement';
import type {
  DiagramEdge,
  DiagramEdgeCRDT,
  EdgePropsForEditing,
  EdgePropsForRendering,
  ResolvedLabelNode
} from './diagramEdge';
import type { RegularLayer } from './diagramLayerRegular';
import type { ModificationLayer } from './diagramLayerModification';
import { getRemoteUnitOfWork, UnitOfWork } from './unitOfWork';
import { Endpoint } from './endpoint';
import type { Waypoint } from './types';
import { Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import { WatchableValue } from '@diagram-craft/utils/watchableValue';
import { deepMerge } from '@diagram-craft/utils/object';
import { PropPath, PropPathValue } from '@diagram-craft/utils/propertyPath';
import type { Path } from '@diagram-craft/geometry/path';
import { Transform } from '@diagram-craft/geometry/transform';
import type { DuplicationContext } from './diagramNode';
import { DiagramElement } from './diagramElement';
import { SerializedEdge, SerializedEndpoint } from './serialization/types';
import type { PropertyInfo } from './property';
import type { EdgeDefinition } from './edgeDefinition';
import { CRDTObject } from '@diagram-craft/collaboration/datatypes/crdtObject';
import { MappedCRDTProp } from '@diagram-craft/collaboration/datatypes/mapped/mappedCrdtProp';
import { CRDTProp } from '@diagram-craft/collaboration/datatypes/crdtProp';
import type { CRDTMap } from '@diagram-craft/collaboration/crdt';

export type DiagramEdgeSnapshot = SerializedEdge & {
  _snapshotType: 'edge';
};

type DelegatingDiagramEdgeCRDT = DiagramEdgeCRDT & {
  hasLocalWaypoints: boolean;
  hasLocalStart: boolean;
  hasLocalEnd: boolean;
};

export class DelegatingDiagramEdge extends DelegatingDiagramElement implements DiagramEdge {
  declare protected readonly delegate: DiagramEdge;

  readonly #localProps: CRDTObject<EdgeProps>;

  readonly #localWaypoints: MappedCRDTProp<DelegatingDiagramEdgeCRDT, 'waypoints'>;
  readonly #hasLocalWaypoints: CRDTProp<DelegatingDiagramEdgeCRDT, 'hasLocalWaypoints'>;

  readonly #localStart: MappedCRDTProp<DelegatingDiagramEdgeCRDT, 'start', Endpoint>;
  readonly #hasLocalStart: CRDTProp<DelegatingDiagramEdgeCRDT, 'hasLocalStart'>;

  readonly #localEnd: MappedCRDTProp<DelegatingDiagramEdgeCRDT, 'end', Endpoint>;
  readonly #hasLocalEnd: CRDTProp<DelegatingDiagramEdgeCRDT, 'hasLocalEnd'>;

  constructor(
    id: string,
    delegate: DiagramEdge,
    layer: RegularLayer | ModificationLayer,
    opts?: {
      crdt?: CRDTMap<DiagramEdgeCRDT>;
      props?: EdgeProps;
      start?: Endpoint;
      end?: Endpoint;
      waypoints?: ReadonlyArray<Waypoint>;
      metadata?: ElementMetadata;
    }
  ) {
    super(id, 'delegating-edge', delegate, layer, opts?.crdt);

    const edgeCrdt = this._crdt as unknown as WatchableValue<CRDTMap<DelegatingDiagramEdgeCRDT>>;

    // Initialize override props
    const propsMap = WatchableValue.from(
      ([parent]) => parent.get().get('props', () => layer.crdt.factory.makeMap())!,
      [edgeCrdt] as const
    );

    this.#localProps = new CRDTObject<EdgeProps>(propsMap, () => {
      this.invalidate(UnitOfWork.immediate(this.diagram));
      this.diagram.emit('elementChange', { element: this });
      this.clearCache();
    });

    // Initialize override waypoints
    this.#localWaypoints = new MappedCRDTProp<DelegatingDiagramEdgeCRDT, 'waypoints'>(
      edgeCrdt,
      'waypoints',
      {
        toCRDT: (waypoints: ReadonlyArray<Waypoint>) => waypoints,
        fromCRDT: (waypoints: ReadonlyArray<Waypoint>) => waypoints
      },
      {
        onRemoteChange: () => getRemoteUnitOfWork(this.diagram).updateElement(this)
      }
    );
    this.#localWaypoints.init([]);

    this.#hasLocalWaypoints = new CRDTProp(edgeCrdt, 'hasLocalWaypoints');

    // Initialize override endpoints
    const makeEndpointMapper = () => ({
      fromCRDT: (e: SerializedEndpoint) => Endpoint.deserialize(e, this.diagram.nodeLookup, true),
      toCRDT: (e: Endpoint) => e.serialize()
    });

    this.#localStart = new MappedCRDTProp<DelegatingDiagramEdgeCRDT, 'start', Endpoint>(
      edgeCrdt,
      'start',
      makeEndpointMapper(),
      {
        onRemoteChange: () => getRemoteUnitOfWork(this.diagram).updateElement(this)
      }
    );
    this.#localStart.init(delegate.start);

    this.#localEnd = new MappedCRDTProp<DelegatingDiagramEdgeCRDT, 'end', Endpoint>(
      edgeCrdt,
      'end',
      makeEndpointMapper(),
      {
        onRemoteChange: () => getRemoteUnitOfWork(this.diagram).updateElement(this)
      }
    );
    this.#localEnd.init(delegate.end);

    this.#hasLocalStart = new CRDTProp(edgeCrdt, 'hasLocalStart');
    this.#hasLocalEnd = new CRDTProp(edgeCrdt, 'hasLocalEnd');

    if (opts?.props) this.#localProps.set(opts.props);
    if (opts?.start) {
      this.#localStart.set(opts.start);
      this.#hasLocalStart.set(true);
    }
    if (opts?.end) {
      this.#localEnd.set(opts.end);
      this.#hasLocalEnd.set(true);
    }
    if (opts?.waypoints) {
      this.#localWaypoints.set(opts.waypoints);
      this.#hasLocalWaypoints.set(true);
    }
    if (opts?.metadata) this._metadata.set(opts.metadata);
  }

  /* Props with merging ********************************************************************************** */

  get storedProps(): EdgePropsForEditing {
    const delegateProps = this.delegate.storedProps;
    const overriddenProps = this.#localProps.get() ?? {};
    return deepMerge({}, delegateProps, overriddenProps) as EdgePropsForEditing;
  }

  get storedPropsCloned(): EdgePropsForEditing {
    return JSON.parse(JSON.stringify(this.storedProps));
  }

  get editProps(): EdgePropsForEditing {
    const delegateProps = this.delegate.editProps;
    const overriddenProps = this.#localProps.get() ?? {};
    return deepMerge({}, delegateProps, overriddenProps) as EdgePropsForEditing;
  }

  get renderProps(): EdgePropsForRendering {
    const delegateProps = this.delegate.renderProps;
    const overriddenProps = this.#localProps.get() ?? {};

    return deepMerge({}, delegateProps, overriddenProps) as EdgePropsForRendering;
  }

  updateProps(callback: (props: EdgeProps) => void, uow: UnitOfWork): void {
    uow.snapshot(this);
    const props = this.#localProps.getClone() as EdgeProps;
    callback(props);
    this.#localProps.set(props);
    uow.updateElement(this);
    this.clearCache();
  }

  updateCustomProps<K extends keyof CustomEdgeProps>(
    key: K,
    callback: (props: NonNullable<CustomEdgeProps[K]>) => void,
    uow: UnitOfWork
  ): void {
    this.updateProps(p => {
      p.custom ??= {};
      p.custom[key] ??= {};
      callback(p.custom[key]!);
    }, uow);
  }

  getPropsInfo<T extends PropPath<EdgeProps>>(path: T): PropertyInfo<PropPathValue<EdgeProps, T>> {
    return this.delegate.getPropsInfo(path);
  }

  /* Bounds with override ************************************************************************************ */

  get bounds(): Box {
    return this.delegate.bounds;
  }

  setBounds(bounds: Box, uow: UnitOfWork): void {
    this.delegate.setBounds(bounds, uow);
  }

  /* Delegated methods *************************************************************************************** */

  getDefinition(): EdgeDefinition {
    return this.delegate.getDefinition();
  }

  inferControlPoints(i: number) {
    return this.delegate.inferControlPoints(i);
  }

  get dataForTemplate() {
    return this.delegate.dataForTemplate;
  }

  get name() {
    return this.delegate.name;
  }

  /* Start/End with override ********************************************************************************* */

  get start(): Endpoint {
    const isOverridden = this.#hasLocalStart.get();
    if (isOverridden) {
      return this.#localStart.getNonNull();
    }
    return this.delegate.start;
  }

  setStart(start: Endpoint, uow: UnitOfWork): void {
    uow.snapshot(this);
    this.#localStart.set(start);
    this.#hasLocalStart.set(true);
    uow.updateElement(this);
    this.clearCache();
  }

  get end(): Endpoint {
    const isOverridden = this.#hasLocalEnd.get();
    if (isOverridden) {
      return this.#localEnd.getNonNull();
    }
    return this.delegate.end;
  }

  setEnd(end: Endpoint, uow: UnitOfWork): void {
    uow.snapshot(this);
    this.#localEnd.set(end);
    this.#hasLocalEnd.set(true);
    uow.updateElement(this);
    this.clearCache();
  }

  isConnected(): boolean {
    return this.delegate.isConnected();
  }

  get labelNodes(): ReadonlyArray<ResolvedLabelNode> {
    return this.delegate.labelNodes;
  }

  addLabelNode(node: ResolvedLabelNode, uow: UnitOfWork): void {
    this.delegate.addLabelNode(node, uow);
  }

  setLabelNodes(labelNodes: ReadonlyArray<ResolvedLabelNode> | undefined, uow: UnitOfWork): void {
    this.delegate.setLabelNodes(labelNodes, uow);
  }

  removeLabelNode(node: ResolvedLabelNode, uow: UnitOfWork): void {
    this.delegate.removeLabelNode(node, uow);
  }

  /* Waypoints with override ********************************************************************************* */

  get waypoints(): ReadonlyArray<Waypoint> {
    const isOverridden = this.#hasLocalWaypoints.get();

    const overriddenWaypoints = this.#localWaypoints.getNonNull();
    if (isOverridden) {
      return overriddenWaypoints;
    }

    return this.delegate.waypoints;
  }

  replaceWaypoint(i: number, wp: Waypoint, uow: UnitOfWork): void {
    uow.snapshot(this);
    const currentWaypoints = [...this.waypoints];
    currentWaypoints[i] = wp;
    this.#localWaypoints.set(currentWaypoints);
    this.#hasLocalWaypoints.set(true);

    uow.updateElement(this);
    this.clearCache();
  }

  addWaypoint(wp: Waypoint, uow: UnitOfWork): number {
    uow.snapshot(this);
    const currentWaypoints = [...this.waypoints];
    currentWaypoints.push(wp);
    this.#localWaypoints.set(currentWaypoints);
    this.#hasLocalWaypoints.set(true);

    uow.updateElement(this);
    this.clearCache();
    return currentWaypoints.length - 1;
  }

  removeWaypoint(waypoint: Waypoint, uow: UnitOfWork): void {
    uow.snapshot(this);
    const currentWaypoints = this.waypoints.filter(wp => wp !== waypoint);
    this.#localWaypoints.set(currentWaypoints);
    this.#hasLocalWaypoints.set(true);

    uow.updateElement(this);
    this.clearCache();
  }

  moveWaypoint(waypoint: Waypoint, point: Point, uow: UnitOfWork): void {
    uow.snapshot(this);
    const currentWaypoints = this.waypoints.map(wp => (wp === waypoint ? { ...wp, point } : wp));
    this.#localWaypoints.set(currentWaypoints);
    this.#hasLocalWaypoints.set(true);

    uow.updateElement(this);
    this.clearCache();
  }

  path(): Path {
    return this.delegate.path();
  }

  get intersections() {
    return this.delegate.intersections;
  }

  flip(uow: UnitOfWork): void {
    this.delegate.flip(uow);
  }

  _recalculateIntersections(uow: UnitOfWork, propagate: boolean): void {
    this.delegate._recalculateIntersections(uow, propagate);
  }

  getAttachmentsInUse(): Array<string> {
    return this.delegate.getAttachmentsInUse();
  }

  invalidate(uow: UnitOfWork): void {
    this.delegate.invalidate(uow);
  }

  detach(uow: UnitOfWork): void {
    this.delegate.detach(uow);
  }

  duplicate(ctx?: DuplicationContext, id?: string): DiagramElement {
    return this.delegate.duplicate(ctx, id);
  }

  transform(transforms: ReadonlyArray<Transform>, uow: UnitOfWork, isChild?: boolean): void {
    this.delegate.transform(transforms, uow, isChild);
  }

  snapshot() {
    return this.delegate.snapshot();
  }

  restore(snapshot: DiagramEdgeSnapshot, uow: UnitOfWork): void {
    this.delegate.restore(snapshot, uow);
  }
}
