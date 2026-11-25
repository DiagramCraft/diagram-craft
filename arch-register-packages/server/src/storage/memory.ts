import type {
  StagedStorageMutation,
  StorageAdapter,
  StorageReconciliationAction,
  StorageReconciliationOperation
} from './storage.types';

const notFound = (key: string) =>
  Object.assign(new Error(`ENOENT: no such file '${key}'`), { code: 'ENOENT' });

const keyOf = (workspace: string, scopeId: string, nodeId: string) =>
  `${workspace}/${scopeId}/${nodeId}`;

/**
 * In-memory StorageAdapter, for environments without a filesystem (e.g. the browser demo).
 * Content can be exported/imported so it can be included in snapshots.
 */
export class MemoryStorage implements StorageAdapter {
  private readonly files = new Map<string, Buffer>();
  private version = 0;

  /** Increases on every mutation; lets the browser demo detect when a snapshot is stale. */
  changeCount() {
    return this.version;
  }

  async exists(workspace: string, scopeId: string, nodeId: string) {
    return this.files.has(keyOf(workspace, scopeId, nodeId));
  }

  async read(workspace: string, scopeId: string, nodeId: string) {
    const key = keyOf(workspace, scopeId, nodeId);
    const content = this.files.get(key);
    if (!content) throw notFound(key);
    return Buffer.from(content);
  }

  async write(workspace: string, scopeId: string, nodeId: string, content: Buffer) {
    this.files.set(keyOf(workspace, scopeId, nodeId), Buffer.from(content));
    this.version++;
  }

  async delete(workspace: string, scopeId: string, nodeId: string) {
    const key = keyOf(workspace, scopeId, nodeId);
    if (!this.files.delete(key)) throw notFound(key);
    this.version++;
  }

  async deleteAll(workspace: string, scopeId: string) {
    const prefix = `${keyOf(workspace, scopeId, '')}`;
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) {
        this.files.delete(key);
        this.version++;
      }
    }
  }

  async stageWrite(
    workspace: string,
    scopeId: string,
    nodeId: string,
    content: Buffer
  ): Promise<StagedStorageMutation> {
    const key = keyOf(workspace, scopeId, nodeId);
    const staged = Buffer.from(content);
    let previous: Buffer | undefined;
    let committed = false;
    return {
      commit: async () => {
        previous = this.files.get(key);
        this.files.set(key, staged);
        this.version++;
        committed = true;
      },
      rollback: async () => {
        if (!committed) return;
        if (previous) this.files.set(key, previous);
        else this.files.delete(key);
        this.version++;
      },
      finalize: async () => {}
    };
  }

  async stageDelete(
    workspace: string,
    scopeId: string,
    nodeId: string
  ): Promise<StagedStorageMutation> {
    const key = keyOf(workspace, scopeId, nodeId);
    let previous: Buffer | undefined;
    let committed = false;
    return {
      commit: async () => {
        previous = this.files.get(key);
        this.files.delete(key);
        this.version++;
        committed = true;
      },
      rollback: async () => {
        if (committed && previous) {
          this.files.set(key, previous);
          this.version++;
        }
      },
      finalize: async () => {}
    };
  }

  // Nothing is staged durably, so there is nothing to reconcile after a crash.
  async reconcile(
    _operation: StorageReconciliationOperation,
    _action: StorageReconciliationAction
  ) {}

  exportSnapshot(): Record<string, Uint8Array> {
    return Object.fromEntries(
      [...this.files].map(([key, content]) => [key, new Uint8Array(content)])
    );
  }

  importSnapshot(snapshot: Record<string, Uint8Array>) {
    this.files.clear();
    this.version++;
    for (const [key, content] of Object.entries(snapshot)) {
      this.files.set(key, Buffer.from(content));
    }
  }
}
