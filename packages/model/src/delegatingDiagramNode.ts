import { DelegatingDiagramElement } from './delegatingDiagramElement';
import type {
  DiagramNode,
  DuplicationContext,
  NodePropsForEditing,
  NodePropsForRendering,
  NodeTexts
} from './diagramNode';
import type { RegularLayer } from './diagramLayerRegular';
import type { ModificationLayer } from './diagramLayerModification';
import type { CRDTMap, FlatCRDTMap } from './collaboration/crdt';
import { DiagramNodeSnapshot, getRemoteUnitOfWork, UnitOfWork } from './unitOfWork';
import { Box } from '@diagram-craft/geometry/box';
import type { NodeDefinition } from './elementDefinitionRegistry';
import { WatchableValue } from '@diagram-craft/utils/watchableValue';
import { CRDTObject } from './collaboration/datatypes/crdtObject';
import { deepMerge } from '@diagram-craft/utils/object';
import { PropPath, PropPathValue } from '@diagram-craft/utils/propertyPath';
import { PropertyInfo } from '@diagram-craft/main/react-app/toolwindow/ObjectToolWindow/types';
import { Transform } from '@diagram-craft/geometry/transform';
import { DiagramElement, type DiagramElementCRDT } from './diagramElement';
import type { DiagramEdge, ResolvedLabelNode } from './diagramEdge';
import type { Point } from '@diagram-craft/geometry/point';
import type { Anchor } from './anchor';
import type { LabelNode } from './types';
import { MappedCRDTProp } from './collaboration/datatypes/mapped/mappedCrdtProp';

export type DelegatingDiagramNodeCRDT = DiagramElementCRDT & {
  bounds?: Box | undefined;
  text: FlatCRDTMap;
  props: FlatCRDTMap;
};

export class DelegatingDiagramNode extends DelegatingDiagramElement implements DiagramNode {
  declare protected readonly delegate: DiagramNode;

  private readonly _overriddenProps: CRDTObject<NodeProps>;
  private readonly _overriddenBounds: MappedCRDTProp<
    DelegatingDiagramNodeCRDT,
    'bounds',
    Box | undefined
  >;

  constructor(
    id: string,
    delegate: DiagramNode,
    layer: RegularLayer | ModificationLayer,
    crdt?: CRDTMap<DiagramElementCRDT>
  ) {
    super(id, delegate, layer, crdt);

    const nodeCrdt = this._crdt as unknown as WatchableValue<CRDTMap<DelegatingDiagramNodeCRDT>>;

    // Initialize override props
    const propsMap = WatchableValue.from(
      ([parent]) => parent.get().get('props', () => layer.crdt.factory.makeMap())!,
      [nodeCrdt] as const
    );

    this._overriddenProps = new CRDTObject<NodeProps>(propsMap, () => {
      this.invalidate(UnitOfWork.immediate(this.diagram));
      this.diagram.emit('elementChange', { element: this });
      this.clearCache();
    });

    this._overriddenBounds = new MappedCRDTProp<
      DelegatingDiagramNodeCRDT,
      'bounds',
      Box | undefined
    >(
      nodeCrdt,
      'bounds',
      {
        toCRDT: (b: Box | undefined) => b,
        fromCRDT: (b: Box | undefined) => b
      },
      {
        onRemoteChange: () => getRemoteUnitOfWork(this.diagram).updateElement(this)
      }
    );
  }

  /* Props with merging ********************************************************************************** */

  get storedProps(): NodeProps {
    const delegateProps = this.delegate.storedProps;
    const overriddenProps = this._overriddenProps.get() ?? {};
    return deepMerge({}, delegateProps, overriddenProps) as NodeProps;
  }

  get storedPropsCloned(): NodeProps {
    return JSON.parse(JSON.stringify(this.storedProps));
  }

  get editProps(): NodePropsForEditing {
    const delegateProps = this.delegate.editProps;
    const overriddenProps = this._overriddenProps.get() ?? {};
    return deepMerge({}, delegateProps, overriddenProps) as NodePropsForEditing;
  }

  get renderProps(): NodePropsForRendering {
    const delegateProps = this.delegate.renderProps;
    const overriddenProps = this._overriddenProps.get() ?? {};

    return deepMerge({}, delegateProps, overriddenProps) as NodePropsForRendering;
  }

  get props(): NodePropsForRendering {
    return this.renderProps;
  }

  updateProps(callback: (props: NodeProps) => void, uow: UnitOfWork): void {
    uow.snapshot(this);
    const props = this._overriddenProps.getClone() as NodeProps;
    callback(props);
    this._overriddenProps.set(props);
    uow.updateElement(this);
    this.clearCache();
  }

  updateCustomProps<K extends keyof CustomNodeProps>(
    key: K,
    callback: (props: NonNullable<CustomNodeProps[K]>) => void,
    uow: UnitOfWork
  ): void {
    this.updateProps(p => {
      p.custom ??= {};
      p.custom[key] ??= {};
      callback(p.custom[key]!);
    }, uow);
  }

  getPropsInfo<T extends PropPath<NodeProps>>(
    path: T,
    defaultValue?: PropPathValue<NodeProps, T>
  ): PropertyInfo<PropPathValue<NodeProps, T>> {
    return this.delegate.getPropsInfo(path, defaultValue);
  }

  // TODO: Implement this properly
  _populatePropsCache(): void {
    this.delegate._populatePropsCache();
  }

  /* Bounds with override ************************************************************************************ */

  get bounds(): Box {
    return this._overriddenBounds.get() ?? this.delegate.bounds;
  }

  setBounds(bounds: Box, uow: UnitOfWork): void {
    uow.snapshot(this);
    this._overriddenBounds.set(bounds);
    uow.updateElement(this);
  }

  /* Delegated methods *************************************************************************************** */

  getDefinition(): NodeDefinition {
    return this.delegate.getDefinition();
  }

  get nodeType(): string {
    return this.delegate.nodeType;
  }

  changeNodeType(nodeType: string, uow: UnitOfWork): void {
    this.delegate.changeNodeType(nodeType, uow);
  }

  getText(id?: string): string {
    return this.delegate.getText(id);
  }

  setText(text: string, uow: UnitOfWork, id?: string): void {
    this.delegate.setText(text, uow, id);
  }

  get texts(): NodeTexts {
    return this.delegate.texts;
  }

  get textsCloned(): NodeTexts {
    return this.delegate.textsCloned;
  }

  get dataForTemplate() {
    return this.delegate.dataForTemplate;
  }

  get name() {
    return this.delegate.name;
  }

  convertToPath(uow: UnitOfWork): void {
    this.delegate.convertToPath(uow);
  }

  _removeEdge(anchor: string | undefined, edge: DiagramEdge): void {
    this.delegate._removeEdge(anchor, edge);
  }

  _addEdge(anchor: string | undefined, edge: DiagramEdge): void {
    this.delegate._addEdge(anchor, edge);
  }

  _getAnchorPosition(anchor: string): Point {
    return this.delegate._getAnchorPosition(anchor);
  }

  _getPositionInBounds(p: Point, respectRotation?: boolean): Point {
    return this.delegate._getPositionInBounds(p, respectRotation);
  }

  get edges(): ReadonlyArray<DiagramEdge> {
    return this.delegate.edges;
  }

  isLabelNode(): boolean {
    return this.delegate.isLabelNode();
  }

  labelNode(): ResolvedLabelNode | undefined {
    return this.delegate.labelNode();
  }

  labelEdge(): DiagramEdge | undefined {
    return this.delegate.labelEdge();
  }

  updateLabelNode(labelNode: Partial<LabelNode>, uow: UnitOfWork): void {
    this.delegate.updateLabelNode(labelNode, uow);
  }

  invalidateAnchors(uow: UnitOfWork): void {
    this.delegate.invalidateAnchors(uow);
  }

  get anchors(): ReadonlyArray<Anchor> {
    return this.delegate.anchors;
  }

  getAnchor(anchor: string): Anchor {
    return this.delegate.getAnchor(anchor);
  }

  duplicate(ctx?: DuplicationContext, id?: string): DiagramNode {
    return this.delegate.duplicate(ctx, id);
  }

  _getNestedElements(): DiagramElement[] {
    return this.delegate._getNestedElements();
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

  transform(transforms: ReadonlyArray<Transform>, uow: UnitOfWork, isChild?: boolean): void {
    this.delegate.transform(transforms, uow, isChild);
  }

  snapshot() {
    return this.delegate.snapshot();
  }

  restore(snapshot: DiagramNodeSnapshot, uow: UnitOfWork): void {
    this.delegate.restore(snapshot, uow);
  }
}
