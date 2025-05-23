import { DiagramPalette } from './diagramPalette';
import { DiagramStyles } from './diagramStyles';
import { Diagram, diagramIterator, DiagramIteratorOpts } from './diagram';
import { AttachmentConsumer, AttachmentManager } from './attachment';
import { EventEmitter } from '@diagram-craft/utils/event';
import { EdgeDefinitionRegistry, NodeDefinitionRegistry } from './elementDefinitionRegistry';
import { precondition } from '@diagram-craft/utils/assert';
import { isNode } from './diagramElement';
import { UnitOfWork } from './unitOfWork';
import { DataProviderRegistry } from './dataProvider';
import { DefaultDataProvider, DefaultDataProviderId } from './dataProviderDefault';
import { UrlDataProvider, UrlDataProviderId } from './dataProviderUrl';
import { Generators } from '@diagram-craft/utils/generator';
import { SerializedElement } from './serialization/types';
import { DiagramDocumentData } from './diagramDocumentData';
import { Json } from '@diagram-craft/utils/types';
import { CRDT, CRDTRoot } from './collaboration/crdt';
import { CollaborationConfig } from './collaboration/collaborationConfig';
import { DocumentProps } from './documentProps';

export type DocumentEvents = {
  diagramchanged: { after: Diagram };
  diagramadded: { node: Diagram };
  diagramremoved: { node: Diagram };
};

export type DataTemplate = {
  id: string;
  schemaId: string;
  name: string;
  template: SerializedElement;
};

export class DiagramDocument extends EventEmitter<DocumentEvents> implements AttachmentConsumer {
  readonly root: CRDTRoot;

  attachments: AttachmentManager;
  styles: DiagramStyles;
  customPalette: DiagramPalette;

  props: DocumentProps;

  #diagrams: Diagram[] = [];

  // This allows any extra, application-specific, data to be stored transparently
  // By design; changing the extra data field, the document is not to be
  // considered dirty. This must be handled manually
  extra: Record<string, Json> = {};

  url: string | undefined;

  readonly data: DiagramDocumentData;

  constructor(
    public readonly nodeDefinitions: NodeDefinitionRegistry,
    public readonly edgeDefinitions: EdgeDefinitionRegistry,
    isStencil?: boolean,
    readonly crdtRoot?: CRDTRoot
  ) {
    super();
    this.root = crdtRoot ?? new CRDT.Root();
    this.data = new DiagramDocumentData(this);
    this.customPalette = new DiagramPalette(this.root, isStencil ? 0 : 14);
    this.styles = new DiagramStyles(this.root, this, !isStencil);
    this.attachments = new AttachmentManager(this.root, this);
    this.props = new DocumentProps(this.root, this);
  }

  transact(callback: () => void) {
    this.root.transact(callback);
  }

  activate() {
    if (!this.url) return;
    CollaborationConfig.Backend.connect(this.url, this.root);
  }

  deactivate() {
    CollaborationConfig.Backend.disconnect();
  }

  get topLevelDiagrams() {
    return this.#diagrams;
  }

  get definitions() {
    return {
      nodeDefinitions: this.nodeDefinitions,
      edgeDefinitions: this.edgeDefinitions
    };
  }

  *diagramIterator(opts: DiagramIteratorOpts = {}) {
    yield* diagramIterator(this.#diagrams, opts);
  }

  getById(id: string) {
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

    for (const d of startAt ? startAt.diagrams : this.#diagrams) {
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

  addDiagram(diagram: Diagram, parent?: Diagram) {
    precondition.is.false(!!this.getById(diagram.id));

    if (parent) {
      (parent.diagrams as Diagram[]).push(diagram);
    } else {
      this.#diagrams.push(diagram);
    }

    diagram.document = this;
    this.emit('diagramadded', { node: diagram });
  }

  removeDiagram(diagram: Diagram) {
    const path = this.getDiagramPath(diagram);

    const diagrams = path.length === 1 ? this.#diagrams : (path.at(-2)!.diagrams as Diagram[]);

    const idx = diagrams.indexOf(diagram);
    if (idx !== -1) {
      diagrams.splice(idx, 1);
      this.emit('diagramremoved', { node: diagram });
    }
  }

  changeDiagram(diagram: Diagram) {
    this.emit('diagramchanged', { after: diagram });
  }

  toJSON() {
    return {
      diagrams: this.#diagrams,
      styles: this.styles,
      props: this.props,
      customPalette: this.customPalette
    };
  }

  getAttachmentsInUse() {
    return [...this.diagramIterator({ nest: true }).flatMap(e => e.getAttachmentsInUse())];
  }

  // TODO: We should probably move this into the diagram loaders and/or deserialization
  //       This way, warnings as anchors are determined during deserialization are triggered
  async load() {
    const loadedTypes = new Set<string>();
    for (const diagram of this.diagramIterator({ nest: true })) {
      const uow = UnitOfWork.immediate(diagram);
      for (const element of diagram.allElements()) {
        if (isNode(element)) {
          const s = element.nodeType;
          if (!this.nodeDefinitions.hasRegistration(s)) {
            if (!(await this.nodeDefinitions.load(s))) {
              console.warn(`Node definition ${s} not loaded`);
            } else {
              element.invalidate(uow);
              loadedTypes.add(s);
            }
          } else if (loadedTypes.has(s)) {
            element.invalidate(uow);
          }
        }
      }
    }
  }
}

/*
 * Register default data providers
 */
DataProviderRegistry.register(DefaultDataProviderId, (s: string) => new DefaultDataProvider(s));
DataProviderRegistry.register(UrlDataProviderId, (s: string) => new UrlDataProvider(s));
