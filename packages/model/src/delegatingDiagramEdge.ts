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
import type { CRDTMap } from './collaboration/crdt';
import { UnitOfWork } from './unitOfWork';
import type { Endpoint } from './endpoint';
import type { Waypoint } from './types';
import { Point } from '@diagram-craft/geometry/point';
import { Box } from '@diagram-craft/geometry/box';
import type { EdgeDefinition } from './elementDefinitionRegistry';
import { WatchableValue } from '@diagram-craft/utils/watchableValue';
import { CRDTObject } from './collaboration/datatypes/crdtObject';
import { deepMerge } from '@diagram-craft/utils/object';
import { PropPath, PropPathValue } from '@diagram-craft/utils/propertyPath';
import { PropertyInfo } from '@diagram-craft/main/react-app/toolwindow/ObjectToolWindow/types';
import type { Path } from '@diagram-craft/geometry/path';
import { Transform } from '@diagram-craft/geometry/transform';
import type { DuplicationContext } from './diagramNode';
import { DiagramElement } from './diagramElement';
import { SerializedEdge } from './serialization/types';

export type DiagramEdgeSnapshot = SerializedEdge & {
  _snapshotType: 'edge';
};

export class DelegatingDiagramEdge extends DelegatingDiagramElement implements DiagramEdge {
  declare protected readonly delegate: DiagramEdge;

  private readonly _overriddenProps: CRDTObject<EdgeProps>;

  constructor(
    id: string,
    delegate: DiagramEdge,
    layer: RegularLayer | ModificationLayer,
    crdt?: CRDTMap<DiagramEdgeCRDT>
  ) {
    super(id, delegate, layer, crdt);

    const edgeCrdt = this._crdt as unknown as WatchableValue<CRDTMap<DiagramEdgeCRDT>>;

    // Initialize override props
    const propsMap = WatchableValue.from(
      ([parent]) => parent.get().get('props', () => layer.crdt.factory.makeMap())!,
      [edgeCrdt] as const
    );

    this._overriddenProps = new CRDTObject<EdgeProps>(propsMap, () => {
      this.invalidate(UnitOfWork.immediate(this.diagram));
      this.diagram.emit('elementChange', { element: this });
      this.clearCache();
    });
  }

  /* Props with merging ********************************************************************************** */

  get storedProps(): EdgePropsForEditing {
    const delegateProps = this.delegate.storedProps;
    const overriddenProps = this._overriddenProps.get() ?? {};
    return deepMerge({}, delegateProps, overriddenProps) as EdgePropsForEditing;
  }

  get storedPropsCloned(): EdgePropsForEditing {
    return JSON.parse(JSON.stringify(this.storedProps));
  }

  get editProps(): EdgePropsForEditing {
    const delegateProps = this.delegate.editProps;
    const overriddenProps = this._overriddenProps.get() ?? {};
    return deepMerge({}, delegateProps, overriddenProps) as EdgePropsForEditing;
  }

  get renderProps(): EdgePropsForRendering {
    const delegateProps = this.delegate.renderProps;
    const overriddenProps = this._overriddenProps.get() ?? {};

    return deepMerge({}, delegateProps, overriddenProps) as EdgePropsForRendering;
  }

  updateProps(callback: (props: EdgeProps) => void, uow: UnitOfWork): void {
    uow.snapshot(this);
    const props = this._overriddenProps.getClone() as EdgeProps;
    callback(props);
    this._overriddenProps.set(props);
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

  setStart(start: Endpoint, uow: UnitOfWork): void {
    this.delegate.setStart(start, uow);
  }

  get start(): Endpoint {
    return this.delegate.start;
  }

  setEnd(end: Endpoint, uow: UnitOfWork): void {
    this.delegate.setEnd(end, uow);
  }

  get end(): Endpoint {
    return this.delegate.end;
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

  get waypoints(): ReadonlyArray<Waypoint> {
    return this.delegate.waypoints;
  }

  replaceWaypoint(i: number, wp: Waypoint, uow: UnitOfWork): void {
    this.delegate.replaceWaypoint(i, wp, uow);
  }

  addWaypoint(wp: Waypoint, uow: UnitOfWork): number {
    return this.delegate.addWaypoint(wp, uow);
  }

  removeWaypoint(waypoint: Waypoint, uow: UnitOfWork): void {
    this.delegate.removeWaypoint(waypoint, uow);
  }

  moveWaypoint(waypoint: Waypoint, point: Point, uow: UnitOfWork): void {
    this.delegate.moveWaypoint(waypoint, point, uow);
  }

  get midpoints(): ReadonlyArray<Point> {
    return this.delegate.midpoints;
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
