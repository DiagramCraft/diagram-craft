import { DiagramPalette } from './diagramPalette';
import { DiagramStyles } from './diagramStyles';
import { Diagram, DiagramCRDT, diagramIterator, DiagramIteratorOpts } from './diagram';
import { AttachmentConsumer, AttachmentManager } from './attachment';
import { EventEmitter } from '@diagram-craft/utils/event';
import { Registry } from './elementDefinitionRegistry';
import { getRemoteUnitOfWork } from './unitOfWork';
import { DataProviderRegistry } from './dataProvider';
import { DefaultDataProvider, DefaultDataProviderId } from './data-providers/dataProviderDefault';
import { UrlDataProvider, UrlDataProviderId } from './data-providers/dataProviderUrl';
import { RESTDataProvider, RestDataProviderId } from './data-providers/dataProviderRest';
import { Generators } from '@diagram-craft/utils/generator';
import { SerializedElement } from './serialization/serializedTypes';
import { DiagramDocumentData } from './diagramDocumentData';
import { DocumentProps } from './documentProps';
import { DocumentTags } from './documentTags';
import { DocumentStories } from './documentStories';
import { watch } from '@diagram-craft/utils/watchableValue';
import { precondition } from '@diagram-craft/utils/assert';
import type { EmptyObject } from '@diagram-craft/utils/types';
import type { ProgressCallback } from '@diagram-craft/utils/progress';
import { CRDT, type CRDTMap, type CRDTRoot } from '@diagram-craft/collaboration/crdt';
import { MappedCRDTOrderedMap } from '@diagram-craft/collaboration/datatypes/mapped/mappedCrdtOrderedMap';
import type { AwarenessUserState } from '@diagram-craft/collaboration/awareness';
import { CollaborationConfig } from '@diagram-craft/collaboration/collaborationConfig';
import type { CRDTMapper } from '@diagram-craft/collaboration/datatypes/mapped/types';
import { type Releasable, Releasables } from '@diagram-craft/utils/releasable';

const makeDiagramMapper = (doc: DiagramDocument): CRDTMapper<Diagram, CRDTMap<DiagramCRDT>> => {
  return {
    fromCRDT: (e: CRDTMap<DiagramCRDT>) => new Diagram(e.get('id')!, e.get('name')!, doc, e),
    toCRDT: (e: Diagram) => e.crdt
  };
};

export type DocumentEvents = {
  diagramChanged: { diagram: Diagram };
  diagramAdded: { diagram: Diagram };
  diagramRemoved: { diagram: Diagram };
  cleared: EmptyObject;
};

export type DataTemplate = {
  id: string;
  schemaId: string;
  name: string;
  template: SerializedElement;
};

export class DiagramDocument
  extends EventEmitter<DocumentEvents>
  implements AttachmentConsumer, Releasable
{
  readonly root: CRDTRoot;

  readonly attachments: AttachmentManager;
  readonly styles: DiagramStyles;
  readonly customPalette: DiagramPalette;
  readonly props: DocumentProps;
  readonly data: DiagramDocumentData;
  readonly tags: DocumentTags;
  readonly stories: DocumentStories;

  // Shared properties
  readonly #diagrams: MappedCRDTOrderedMap<Diagram, DiagramCRDT>;

  // Transient properties
  url: string | undefined;
  hash: string | undefined;
  readonly #releasables = new Releasables();
  activeDiagramId: string | undefined;

  constructor(
    readonly registry: Registry,
    isStencil?: boolean,
    crdtRoot?: CRDTRoot
  ) {
    super();

    this.root = crdtRoot ?? CRDT.makeRoot();
    this.data = new DiagramDocumentData(this.root, this);
    this.customPalette = new DiagramPalette(this.root, isStencil ? 0 : 14);
    this.styles = new DiagramStyles(this.root, this, !isStencil);
    this.attachments = new AttachmentManager(this.root, this);
    this.props = new DocumentProps(this.root, this);
    this.tags = new DocumentTags(this.root);
    this.stories = new DocumentStories(this.root, this);

    this.#diagrams = new MappedCRDTOrderedMap(
      watch(this.root.getMap('diagrams')),
      makeDiagramMapper(this),
      {
        onRemoteAdd: e =>
          this.root.on('remoteAfterTransaction', () => getRemoteUnitOfWork(e).commit(), {
            id: e.id
          }),
        onRemoteRemove: e => this.root.off('remoteAfterTransaction', e.id),
        onInit: e =>
          this.root.on('remoteAfterTransaction', () => getRemoteUnitOfWork(e).commit(), {
            id: e.id
          })
      }
    );

    this.#releasables.add(this.root.on('remoteClear', () => this.emit('cleared')));
  }

  release() {
    this.#releasables.release();
    this.data.release();
    this.customPalette.release();
    this.styles.release();
    this.attachments.release();
    this.props.release();
    this.tags.release();
    this.stories.release();
  }

  activate(userState: AwarenessUserState, callback: ProgressCallback) {
    if (!this.url) return;

    CollaborationConfig.Backend.connect(this.url, this.root, userState, callback);

    // TODO: Move this to the caller
    window.onbeforeunload = () => this.deactivate(() => {});
  }

  deactivate(callback: ProgressCallback) {
    CollaborationConfig.Backend.disconnect(callback);
  }

  // Exposed for query purposes
  get elements() {
    return this.diagrams.flatMap(d => d.elements);
  }

  get diagrams() {
    return this.#diagrams.values.filter(d => !d.parent);
  }

  *diagramIterator(opts: DiagramIteratorOpts = {}) {
    yield* diagramIterator(this.#diagrams.values, opts);
  }

  byId(id: string) {
    return Generators.first(
      this.diagramIterator({
        nest: true,
        filter: (d: Diagram) => d.id === id,
        earlyExit: true
      })
    );
  }

  getDiagramPath(diagram: Diagram, startAt?: Diagram): Diagram[] {
    const dest: Diagram[] = [];

    for (const d of startAt ? startAt.diagrams : this.diagrams) {
      if (d === diagram) {
        dest.push(d);
      } else {
        const p = this.getDiagramPath(diagram, d);
        if (p.length > 0) {
          dest.push(d);
          dest.push(...p);
        }
      }
    }

    return dest;
  }

  insertDiagram(diagram: Diagram, position: number, parent?: Diagram) {
    precondition.is.false(!!this.byId(diagram.id));

    diagram._parent = parent?.id;
    diagram._document = this;

    this.#diagrams.insert(diagram.id, diagram, position);

    this.root.on('remoteAfterTransaction', () => getRemoteUnitOfWork(diagram).commit(), {
      id: diagram.id
    });

    this.emit('diagramAdded', { diagram: diagram });
  }

  addDiagram(diagram: Diagram, parent?: Diagram) {
    this.insertDiagram(diagram, this.#diagrams.size, parent);
  }

  removeDiagram(diagram: Diagram) {
    this.#diagrams.remove(diagram.id);

    this.root.off('remoteAfterTransaction', diagram.id);

    this.emit('diagramRemoved', { diagram: diagram });
  }

  changeDiagram(diagram: Diagram) {
    this.emit('diagramChanged', { diagram: diagram });
  }

  moveDiagram(diagram: Diagram, ref: { diagram: Diagram; relation: 'before' | 'after' }) {
    // Get all diagrams with the same parent as the reference
    const parentId = ref.diagram.parent;
    const diagramsInParent = this.#diagrams.values.filter(d => d.parent === parentId);

    // Remove diagram being moved from its current position
    const list = diagramsInParent.filter(d => d.id !== diagram.id);

    // Find the reference diagram's position in the remaining diagrams
    const idx = list.indexOf(ref.diagram);

    // Calculate insertion point
    const insertIndex = ref.relation === 'before' ? idx : idx + 1;

    // Build new order for this parent level
    const newOrderForParent = [...list.slice(0, insertIndex), diagram, ...list.slice(insertIndex)];

    // Build complete new order by combining diagrams from other parents
    const otherDiagrams = this.#diagrams.values.filter(d => d.parent !== parentId);
    const completeNewOrder = [...otherDiagrams, ...newOrderForParent];

    // Apply the new order
    this.#diagrams.setOrder(completeNewOrder.map(d => d.id));

    // Emit change event for moved diagram
    this.emit('diagramChanged', { diagram });
  }

  getAttachmentsInUse() {
    return [...this.diagramIterator({ nest: true }).flatMap(e => e.getAttachmentsInUse())];
  }

  // TODO: We should probably move this into the diagram loaders and/or deserialization
  //       This way, warnings as anchors are determined during deserialization are triggered
  async load() {
    return;
    /*    const loadedTypes = new Set<string>();
    for (const diagram of this.diagramIterator({ nest: true })) {
      await UnitOfWork.executeAsync(diagram, async uow => {
        for (const element of diagram.allElements()) {
          if (isNode(element)) {
            const s = element.nodeType;
            if (!this.registry.nodes.hasRegistration(s)) {
              const existingNodeDefinitions = new Set([...this.registry.nodes.list()]);

              if (!(await this.registry.nodes.load(s))) {
                console.warn(`Node definition ${s} not loaded`);
              } else {
                for (const nd of this.registry.nodes.list()) {
                  if (!existingNodeDefinitions.has(nd)) {
                    console.log('Loaded', nd);
                    loadedTypes.add(nd);
                  }
                }

                element.invalidate(uow);
                element.invalidateAnchors(uow);
              }
            } else if (loadedTypes.has(s)) {
              element.invalidate(uow);
              element.invalidateAnchors(uow);
            }
          }
        }
      });
    }*/
  }
}

/*
 * Register default data providers
 */
DataProviderRegistry.register(DefaultDataProviderId, (s: string) => new DefaultDataProvider(s));
DataProviderRegistry.register(UrlDataProviderId, (s: string) => new UrlDataProvider(s));
DataProviderRegistry.register(RestDataProviderId, (s: string) => new RESTDataProvider(s));
