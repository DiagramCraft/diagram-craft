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
import type { CRDTMap, FlatCRDTMap } from './collaboration/crdt';
import { DiagramNodeSnapshot, getRemoteUnitOfWork, UnitOfWork } from './unitOfWork';
import { Box } from '@diagram-craft/geometry/box';
import type { NodeDefinition } from './elementDefinitionRegistry';
import { WatchableValue } from '@diagram-craft/utils/watchableValue';
import { CRDTObject } from './collaboration/datatypes/crdtObject';
import { deepMerge } from '@diagram-craft/utils/object';
import { PropPath, PropPathValue } from '@diagram-craft/utils/propertyPath';
import { Transform } from '@diagram-craft/geometry/transform';
import { DiagramElement, type DiagramElementCRDT } from './diagramElement';
import type { DiagramEdge, ResolvedLabelNode } from './diagramEdge';
import type { Point } from '@diagram-craft/geometry/point';
import type { Anchor } from './anchor';
import type { LabelNode } from './types';
import { MappedCRDTProp } from './collaboration/datatypes/mapped/mappedCrdtProp';
import { CRDTProp } from './collaboration/datatypes/crdtProp';
import type { PropertyInfo } from './property';

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
      this.invalidate(UnitOfWork.immediate(this.diagram));
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
      this.invalidate(UnitOfWork.immediate(this.diagram));
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
    this.updateProps(p => {
      p.hidden = false;
    }, UnitOfWork.immediate(this.diagram));

    if (opts?.metadata) this._metadata.set(opts?.metadata);
  }

  /* Props with merging ********************************************************************************** */

  get storedProps(): NodeProps {
    const delegateProps = this.delegate.storedProps;
    const overriddenProps = this.#localProps.get() ?? {};
    return deepMerge({}, delegateProps, overriddenProps) as NodeProps;
  }

  get storedPropsCloned(): NodeProps {
    return JSON.parse(JSON.stringify(this.storedProps));
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
    uow.snapshot(this);
    const props = this.#localProps.getClone() as NodeProps;
    callback(props);
    this.#localProps.set(props);
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

  _populatePropsCache(): void {
    this.delegate._populatePropsCache();
  }

  /* Bounds with override ************************************************************************************ */

  get bounds(): Box {
    const boundsOverridden = this.#hasLocalBounds.get();
    return !boundsOverridden ? this.delegate.bounds : this.#localBounds.getNonNull();
  }

  setBounds(bounds: Box, uow: UnitOfWork): void {
    uow.snapshot(this);
    this.#localBounds.set(bounds);
    this.#hasLocalBounds.set(true);
    uow.updateElement(this);
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
    uow.snapshot(this);
    const texts = this.#localTexts.getClone() as NodeTexts;
    const key = id ?? 'text';
    texts[key] = text;
    this.#localTexts.set(texts);
    uow.updateElement(this);
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
