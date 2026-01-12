import {
  DiagramElement,
  type DiagramElementCRDT,
  type ElementPropsForEditing,
  type ElementPropsForRendering,
  type ElementType
} from './diagramElement';
import { type RegularLayer } from './diagramLayerRegular';
import type { ModificationLayer } from './diagramLayerModification';
import { watch, WatchableValue } from '@diagram-craft/utils/watchableValue';
import { UnitOfWork } from './unitOfWork';
import type { Diagram } from './diagram';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { Transform } from '@diagram-craft/geometry/transform';
import type { Box } from '@diagram-craft/geometry/box';
import type { DuplicationContext } from './diagramNode';
import { PropPath, PropPathValue } from '@diagram-craft/utils/propertyPath';
import { FlatObject } from '@diagram-craft/utils/flatObject';
import type { PropertyInfo } from './property';
import type { CRDTMap } from '@diagram-craft/collaboration/crdt';
import { CRDTObject } from '@diagram-craft/collaboration/datatypes/crdtObject';
import type { EdgeProps, ElementMetadata, ElementProps, NodeProps } from './diagramProps';

// biome-ignore lint/suspicious/noExplicitAny: false positive
type Snapshot = any;

export abstract class DelegatingDiagramElement implements DiagramElement {
  readonly _trackableType = 'element';

  protected readonly delegate: DiagramElement;

  protected _metadata: CRDTObject<ElementMetadata>;
  protected readonly _crdt: WatchableValue<CRDTMap<DiagramElementCRDT>>;
  private _layer: RegularLayer | ModificationLayer;
  private _diagram: Diagram;

  protected constructor(
    id: string,
    type: ElementType,
    delegate: DiagramElement,
    layer: RegularLayer | ModificationLayer,
    crdt?: CRDTMap<DiagramElementCRDT>
  ) {
    this.delegate = delegate;

    this._crdt = watch(crdt ?? layer.crdt.factory.makeMap());
    this._crdt.get().set('id', id);
    this._crdt.get().set('type', type);
    this._layer = layer;
    this._diagram = layer.diagram;

    // Override metadata to merge with delegate
    const metadataMap = WatchableValue.from(
      ([parent]) => parent.get().get('metadata', () => layer.crdt.factory.makeMap())!,
      [this._crdt] as const
    );

    this._metadata = new CRDTObject<ElementMetadata>(metadataMap, () => {
      UnitOfWork.executeSilently(this.diagram, uow => this.invalidate(uow));
      this.diagram.emit('elementChange', { element: this });
      this.clearCache();
    });
  }

  get id() {
    return this._crdt.get().get('id')!;
  }

  get type() {
    return this._crdt.get().get('type')! as ElementType;
  }

  get layer() {
    return this._layer;
  }

  get diagram() {
    return this._diagram;
  }

  /* Metadata with merging ****************************************************************************** */

  get metadata(): ElementMetadata {
    const delegateMetadata = this.delegate.metadata;
    const localMetadata = this._metadata.get() ?? {};

    // Merge delegate metadata with local overrides
    return {
      ...delegateMetadata,
      ...localMetadata,
      data: {
        ...delegateMetadata.data,
        ...localMetadata.data,
        customData: {
          ...delegateMetadata.data?.customData,
          ...localMetadata.data?.customData
        },
        data: [...(delegateMetadata.data?.data ?? []), ...(localMetadata.data?.data ?? [])]
      }
    };
  }

  updateMetadata(callback: (props: ElementMetadata) => void, uow: UnitOfWork) {
    uow.executeUpdate(this, () => {
      const metadata = this._metadata.getClone() as ElementMetadata;
      callback(metadata);
      this._metadata.set(metadata);
    });
    this.clearCache();
  }

  _setLayer(layer: RegularLayer | ModificationLayer, diagram: Diagram) {
    this._layer = layer;
    this._diagram = diagram;
  }

  _onAttach(
    layer: RegularLayer | ModificationLayer,
    parent: DiagramElement | RegularLayer | ModificationLayer
  ) {
    this.delegate._onAttach(layer, parent);
  }

  get crdt() {
    return this._crdt;
  }

  _setParent() {
    VERIFY_NOT_REACHED();
  }

  setTags() {
    VERIFY_NOT_REACHED();
  }

  setChildren() {
    VERIFY_NOT_REACHED();
  }

  addChild() {
    VERIFY_NOT_REACHED();
  }

  removeChild() {
    VERIFY_NOT_REACHED();
  }

  abstract getAttachmentsInUse(): Array<string>;

  abstract invalidate(uow: UnitOfWork): void;
  abstract _onDetach(uow: UnitOfWork): void;
  abstract _detachAndRemove(uow: UnitOfWork, callback: () => void): void;
  abstract duplicate(ctx?: DuplicationContext, id?: string): DiagramElement;
  abstract transform(
    transforms: ReadonlyArray<Transform>,
    uow: UnitOfWork,
    isChild?: boolean
  ): void;

  abstract readonly bounds: Box;
  abstract setBounds(bounds: Box, uow: UnitOfWork): void;

  abstract readonly name: string;
  abstract readonly dataForTemplate: FlatObject;
  abstract editProps: ElementPropsForEditing;
  abstract renderProps: ElementPropsForRendering;
  abstract storedProps: ElementProps;

  abstract getPropsInfo<T extends PropPath<ElementProps>>(
    path: T
  ): PropertyInfo<PropPathValue<ElementProps, T>>;

  abstract updateProps(callback: (props: NodeProps | EdgeProps) => void, uow: UnitOfWork): void;

  abstract snapshot(): Snapshot;
  abstract restore(snapshot: Snapshot, uow: UnitOfWork): void;

  /* Delegated methods ********************************************************************************** */

  isLocked() {
    return this.delegate.isLocked();
  }

  isHidden() {
    return this.delegate.isHidden();
  }

  get activeDiagram() {
    return this.delegate.activeDiagram;
  }

  set activeDiagram(diagram: Diagram) {
    this.delegate.activeDiagram = diagram;
  }

  get parent() {
    return this.delegate.parent;
  }

  get tags() {
    return this.delegate.tags;
  }

  get cache() {
    return this.delegate.cache;
  }

  clearCache() {
    return this.delegate.clearCache();
  }

  get children() {
    return this.delegate.children;
  }

  get comments() {
    return this.delegate.comments;
  }
}
