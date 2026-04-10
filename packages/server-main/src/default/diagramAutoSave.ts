import * as Y from 'yjs';
import { debounce } from '@diagram-craft/utils/debounce';
import { YJSRoot } from '@diagram-craft/collaboration/yjs/yjsCrdt';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import {
  EdgeDefinitionRegistry,
  NodeDefinitionRegistry,
  type Registry
} from '@diagram-craft/model/elementDefinitionRegistry';
import { AbstractEdgeDefinition } from '@diagram-craft/model/edgeDefinition';
import { StencilRegistry } from '@diagram-craft/model/stencilRegistry';
import { RectNodeDefinition } from '@diagram-craft/canvas/node-types/Rect.nodeType';
import { serializeDiagramDocument } from '@diagram-craft/model/serialization/serialize';
import { createLogger } from '../logger';

const log = createLogger('DiagramAutoSave');

const DEBOUNCE_MS = 2000;

class ServerEdgeDefinition extends AbstractEdgeDefinition {
  constructor() {
    super('server-default', 'server-default');
  }
}

const makeServerRegistry = (): Registry => {
  const nodes = new NodeDefinitionRegistry();
  nodes.logMissingShapes = false;
  nodes.register(new RectNodeDefinition());
  return {
    nodes,
    edges: new EdgeDefinitionRegistry(new ServerEdgeDefinition()),
    stencils: new StencilRegistry()
  };
};

export type AutoSaveWriter = (relPath: string, content: string) => Promise<unknown>;

export class DiagramAutoSave {
  // DiagramDocument is created lazily on the first Y.Doc update to avoid making
  // local CRDT mutations (via getMap) before the client has synced its state.
  // Creating it immediately would write empty Y.Maps into the shared doc, which
  // would win the CRDT conflict and overwrite the client's diagram data.
  private document: DiagramDocument | undefined;
  private readonly handleUpdate: () => void;
  private disposed = false;
  private readonly tempRelPath: string;

  constructor(
    private readonly yDoc: Y.Doc,
    relPath: string,
    tempRelPath: string,
    private readonly writer: AutoSaveWriter
  ) {
    this.tempRelPath = tempRelPath;
    log.debug(`Setting up auto-save for ${relPath} → ${this.tempRelPath}`);

    const debouncedSave = debounce(() => {
      this.save().catch(err => log.error(`Failed to save ${this.tempRelPath}`, err));
    }, DEBOUNCE_MS);

    this.handleUpdate = () => {
      if (this.disposed) return;
      log.trace(`Update received for ${this.tempRelPath}, debouncing...`);
      debouncedSave();
    };

    yDoc.on('update', (_update, origin) => {
      log.trace(
        `RAW update event: origin=${origin}, disposed=${this.disposed}, hasDocument=${!!this.document}`
      );
    });
    yDoc.on('update', this.handleUpdate);
  }

  private async save() {
    if (this.disposed) return;
    if (!this.document) {
      // Bind lazily after the update burst has settled so we do not attach a
      // DiagramDocument while the initial Yjs sync transaction is still in flight.
      log.debug(`First debounced save for ${this.tempRelPath} — creating DiagramDocument`);
      this.document = new DiagramDocument(makeServerRegistry(), false, new YJSRoot(this.yDoc));
    }
    if (this.document.diagrams.length === 0) {
      log.warn(`Skipping save for ${this.tempRelPath}: document has no diagrams`);
      return;
    }

    log.debug(`Serializing ${this.tempRelPath}...`);
    const serialized = await serializeDiagramDocument(this.document);
    if (serialized.diagrams.length === 0) {
      log.warn(`Skipping save for ${this.tempRelPath}: serialized document has no diagrams`);
      return;
    }
    log.debug(`Serialized ${this.tempRelPath}: ${serialized.diagrams.length} diagram(s)`);
    await this.writer(this.tempRelPath, JSON.stringify(serialized, null, 2));
    log.info(`Saved ${this.tempRelPath}`);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    log.debug(`Disposing auto-save for ${this.tempRelPath}`);
    this.yDoc.off('update', this.handleUpdate);
    this.document?.release();
  }
}
