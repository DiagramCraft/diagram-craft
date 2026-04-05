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
import { serializeDiagramDocument } from '@diagram-craft/model/serialization/serialize';

const DEBOUNCE_MS = 2000;

class ServerEdgeDefinition extends AbstractEdgeDefinition {
  constructor() {
    super('server-default', 'server-default');
  }
}

const makeServerRegistry = (): Registry => ({
  nodes: new NodeDefinitionRegistry(),
  edges: new EdgeDefinitionRegistry(new ServerEdgeDefinition()),
  stencils: new StencilRegistry()
});

export type AutoSaveWriter = (relPath: string, content: string) => Promise<unknown>;

export class DiagramAutoSave {
  private readonly yjsRoot: YJSRoot;
  private readonly document: DiagramDocument;
  private readonly handleUpdate: () => void;
  private disposed = false;
  private readonly tempRelPath: string;

  constructor(
    private readonly yDoc: Y.Doc,
    relPath: string,
    private readonly writer: AutoSaveWriter
  ) {
    this.tempRelPath = relPath.replace(/\.json$/, '.temp.json');
    this.yjsRoot = new YJSRoot(yDoc);
    this.document = new DiagramDocument(makeServerRegistry(), false, this.yjsRoot);

    const debouncedSave = debounce(() => {
      this.save().catch(err =>
        console.error(`[DiagramAutoSave] Failed to save ${this.tempRelPath}:`, err)
      );
    }, DEBOUNCE_MS);

    this.handleUpdate = () => {
      if (this.disposed) return;
      debouncedSave();
    };

    yDoc.on('update', this.handleUpdate);
  }

  private async save() {
    if (this.disposed) return;
    const serialized = await serializeDiagramDocument(this.document);
    await this.writer(this.tempRelPath, JSON.stringify(serialized, null, 2));
    console.log(`[DiagramAutoSave] Saved ${this.tempRelPath}`);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.yDoc.off('update', this.handleUpdate);
    this.document.release();
  }
}
