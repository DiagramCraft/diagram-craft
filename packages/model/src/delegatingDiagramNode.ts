import { DelegatingDiagramElement } from './delegatingDiagramElement';
import {
  applyNodeTransform,
  type DiagramNode,
  type DuplicationContext,
  type NodePropsForEditing,
  type NodePropsForRendering,
  type NodeTexts
} from './diagramNode';
import type { RegularLayer } from './diagramLayerRegular';
import type { ModificationLayer } from './diagramLayerModification';
import { getRemoteUnitOfWork, UnitOfWork } from './unitOfWork';
import { Box } from '@diagram-craft/geometry/box';
import type { NodeDefinition } from './elementDefinitionRegistry';
import { WatchableValue } from '@diagram-craft/utils/watchableValue';
import { deepMerge } from '@diagram-craft/utils/object';
import { PropPath, PropPathValue } from '@diagram-craft/utils/propertyPath';
import { Transform } from '@diagram-craft/geometry/transform';
import { DiagramElement, type DiagramElementCRDT } from './diagramElement';
import type { DiagramEdge, ResolvedLabelNode } from './diagramEdge';
import type { Point } from '@diagram-craft/geometry/point';
import type { Anchor } from './anchor';
import type { PropertyInfo } from './property';
import { CRDTObject } from '@diagram-craft/collaboration/datatypes/crdtObject';
import { MappedCRDTProp } from '@diagram-craft/collaboration/datatypes/mapped/mappedCrdtProp';
import { CRDTProp } from '@diagram-craft/collaboration/datatypes/crdtProp';
import type { CRDTMap, FlatCRDTMap } from '@diagram-craft/collaboration/crdt';
import type { LabelNode } from './labelNode';
import type { CustomNodeProps, ElementMetadata, NodeProps } from './diagramProps';
import { DiagramNodeSnapshot } from '@diagram-craft/model/diagramElement.uow';

export type DelegatingDiagramNodeCRDT = DiagramElementCRDT & {
  bounds: Box;
  text: FlatCRDTMap;
  props: FlatCRDTMap;
  hasLocalBounds: boolean;
};

export class DelegatingDiagramNode extends DelegatingDiagramElement implements DiagramNode {
  declare protected readonly delegate: DiagramNode;

  readonly #localProps: CRDTObject<NodeProps>;
  readonly #localTexts: CRDTObject<NodeTexts>;

  readonly #localBounds: MappedCRDTProp<DelegatingDiagramNodeCRDT, 'bounds', Box>;
  readonly #hasLocalBounds: CRDTProp<DelegatingDiagramNodeCRDT, 'hasLocalBounds'>;

  constructor(
    id: string,
    delegate: DiagramNode,
    layer: RegularLayer | ModificationLayer,
    opts?: {
      crdt?: CRDTMap<DiagramElementCRDT>;
      bounds?: Box | undefined;
      props?: NodePropsForEditing;
      metadata?: ElementMetadata;
      texts?: NodeTexts;
    }
  ) {
    super(id, 'delegating-node', delegate, layer, opts?.crdt);

    const nodeCrdt = this._crdt as unknown as WatchableValue<CRDTMap<DelegatingDiagramNodeCRDT>>;

    // Initialize override props
    const propsMap = WatchableValue.from(
      ([parent]) => parent.get().get('props', () => layer.crdt.factory.makeMap())!,
      [nodeCrdt] as const
    );

    this.#localProps = new CRDTObject<NodeProps>(propsMap, () => {
      UnitOfWork.executeSilently(this.diagram, uow => this.invalidate(uow));
      this.diagram.emit('elementChange', { element: this });
      this.clearCache();
    });

    this.#localBounds = new MappedCRDTProp<DelegatingDiagramNodeCRDT, 'bounds', Box>(
      nodeCrdt,
      'bounds',
      {
        toCRDT: (b: Box) => b,
        fromCRDT: (b: Box) => b
      },
      {
        onRemoteChange: () => getRemoteUnitOfWork(this.diagram).updateElement(this)
      }
    );
    this.#localBounds.init({ x: 0, y: 0, w: 0, h: 0, r: 0 });

    this.#hasLocalBounds = new CRDTProp(nodeCrdt, 'hasLocalBounds');

    // Initialize override texts
    const textsMap = WatchableValue.from(
      ([parent]) => parent.get().get('text', () => layer.crdt.factory.makeMap())!,
      [nodeCrdt] as const
    );

    this.#localTexts = new CRDTObject<NodeTexts>(textsMap, () => {
      UnitOfWork.executeSilently(this.diagram, uow => this.invalidate(uow));
      this.diagram.emit('elementChange', { element: this });
      this.clearCache();
    });

    if (opts?.bounds) {
      this.#localBounds.set(opts?.bounds);
      this.#hasLocalBounds.set(true);
    }

    if (opts?.texts) this.#localTexts.set(opts?.texts);

    if (opts?.props) this.#localProps.set(opts?.props as NodeProps);
    // TODO: Fix this
    UnitOfWork.executeSilently(this.diagram, uow =>
      this.updateProps(p => {
        p.hidden = false;
      }, uow)
    );

    if (opts?.metadata) this._metadata.set(opts?.metadata);
  }

  /* Props with merging ********************************************************************************** */

  get storedProps(): NodeProps {
    const delegateProps = this.delegate.storedProps;
    const overriddenProps = this.#localProps.get() ?? {};
    return deepMerge({}, delegateProps, overriddenProps) as NodeProps;
  }

  get editProps(): NodePropsForEditing {
    const delegateProps = this.delegate.editProps;
    const overriddenProps = this.#localProps.get() ?? {};
    return deepMerge({}, delegateProps, overriddenProps) as NodePropsForEditing;
  }

  get renderProps(): NodePropsForRendering {
    const delegateProps = this.delegate.renderProps;
    const overriddenProps = this.#localProps.get() ?? {};

    return deepMerge({}, delegateProps, overriddenProps) as NodePropsForRendering;
  }

  get props(): NodePropsForRendering {
    return this.renderProps;
  }

  updateProps(callback: (props: NodeProps) => void, uow: UnitOfWork): void {
    uow.executeUpdate(this, () => {
      const props = this.#localProps.getClone() as NodeProps;
      callback(props);
      this.#localProps.set(props);
    });
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

  _populatePropsCache(): void {
    this.delegate._populatePropsCache();
  }

  /* Bounds with override ************************************************************************************ */

  get bounds(): Box {
    const boundsOverridden = this.#hasLocalBounds.get();
    return !boundsOverridden ? this.delegate.bounds : this.#localBounds.getNonNull();
  }

  setBounds(bounds: Box, uow: UnitOfWork): void {
    uow.executeUpdate(this, () => {
      this.#localBounds.set(bounds);
      this.#hasLocalBounds.set(true);
    });
  }

  /* Text with override *************************************************************************************** */

  getText(id?: string): string {
    const overriddenTexts = this.#localTexts.get();
    const key = id ?? 'text';

    // Check if we have an override for this specific text id
    if (overriddenTexts && overriddenTexts[key] !== undefined) {
      return overriddenTexts[key];
    }

    // Fall back to delegate
    return this.delegate.getText(id);
  }

  setText(text: string, uow: UnitOfWork, id?: string): void {
    uow.executeUpdate(this, () => {
      const texts = this.#localTexts.getClone() as NodeTexts;
      const key = id ?? 'text';
      texts[key] = text;
      this.#localTexts.set(texts);
    });
    this.clearCache();
  }

  get texts(): NodeTexts {
    const delegateTexts = this.delegate.texts;
    const overriddenTexts = this.#localTexts.get() ?? {};
    return { ...delegateTexts, ...overriddenTexts };
  }

  get textsCloned(): NodeTexts {
    return JSON.parse(JSON.stringify(this.texts));
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

  get dataForTemplate() {
    return this.delegate.dataForTemplate;
  }

  get name() {
    return this.delegate.name;
  }

  convertToPath(uow: UnitOfWork): void {
    this.delegate.convertToPath(uow);
  }

  _removeEdge(anchor: string | undefined, edge: DiagramEdge, uow: UnitOfWork): void {
    this.delegate._removeEdge(anchor, edge, uow);
  }

  _addEdge(anchor: string | undefined, edge: DiagramEdge, uow: UnitOfWork): void {
    this.delegate._addEdge(anchor, edge, uow);
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

  _onRemove(uow: UnitOfWork): void {
    this.delegate._onRemove(uow);
  }

  _detachAndRemove(uow: UnitOfWork, callback: () => void) {
    this.delegate._detachAndRemove(uow, callback);
  }

  transform(transforms: ReadonlyArray<Transform>, uow: UnitOfWork, isChild = false): void {
    applyNodeTransform(this, transforms, uow, isChild);
  }

  snapshot() {
    return this.delegate.snapshot();
  }

  restore(snapshot: DiagramNodeSnapshot, uow: UnitOfWork): void {
    this.delegate.restore(snapshot, uow);
  }
}
