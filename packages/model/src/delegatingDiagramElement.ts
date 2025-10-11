import { DiagramElement, type DiagramElementCRDT } from './diagramElement';
import { type RegularLayer } from './diagramLayerRegular';
import { type ModificationLayer } from './diagramLayerModification';
import type { CRDTMap } from './collaboration/crdt';
import { watch, WatchableValue } from '@diagram-craft/utils/watchableValue';
import { CRDTObject } from './collaboration/datatypes/crdtObject';
import { UnitOfWork } from './unitOfWork';
import { type Diagram } from './diagram';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';

export abstract class DelegatingDiagramElement extends DiagramElement {
  protected readonly delegate: DiagramElement;

  private _overriddenMetadata: CRDTObject<ElementMetadata>;
  private readonly _overriddenCrdt: WatchableValue<CRDTMap<DiagramElementCRDT>>;
  private _overriddenLayer: RegularLayer | ModificationLayer;

  protected constructor(
    id: string,
    delegate: DiagramElement,
    layer: RegularLayer | ModificationLayer,
    crdt?: CRDTMap<DiagramElementCRDT>
  ) {
    super(delegate.type, delegate.id, delegate.layer, delegate.crdt.get());

    this.delegate = delegate;

    this._overriddenCrdt = watch(crdt ?? layer.crdt.factory.makeMap());
    this._overriddenCrdt.get().set('id', id);
    this._overriddenLayer = layer;

    // Override metadata to merge with delegate
    const metadataMap = WatchableValue.from(
      ([parent]) => parent.get().get('metadata', () => layer.crdt.factory.makeMap())!,
      [this._overriddenCrdt] as const
    );

    this._overriddenMetadata = new CRDTObject<ElementMetadata>(metadataMap, () => {
      this.invalidate(UnitOfWork.immediate(this.diagram));
      this.diagram.emit('elementChange', { element: this });
      this.clearCache();
    });
  }

  get id() {
    return this._overriddenCrdt.get().get('id')!;
  }

  get layer() {
    return this._overriddenLayer;
  }

  /* Metadata with merging ****************************************************************************** */

  get metadata(): ElementMetadata {
    const delegateMetadata = this.delegate.metadata;
    const localMetadata = this._overriddenMetadata.get() ?? {};

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

  get metadataCloned(): ElementMetadata {
    const merged = this.metadata;
    return JSON.parse(JSON.stringify(merged));
  }

  updateMetadata(callback: (props: ElementMetadata) => void, uow: UnitOfWork) {
    uow.snapshot(this);
    const metadata = this._overriddenMetadata.getClone() as ElementMetadata;
    callback(metadata);
    this._overriddenMetadata.set(metadata);
    uow.updateElement(this);
    this.clearCache();
  }

  _setLayer(layer: RegularLayer | ModificationLayer, diagram: Diagram) {
    this._overriddenLayer = layer;
    this._diagram = diagram;
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
}
