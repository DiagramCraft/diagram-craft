import type {
  StagedStorageMutation,
  StorageAdapter,
  StorageReconciliationAction,
  StorageReconciliationOperation
} from './storage.types';

const notFound = (key: string) =>
  Object.assign(new Error(`ENOENT: no such file '${key}'`), { code: 'ENOENT' });

const keyOf = (workspace: string, projectId: string, fileId: string) =>
  `${workspace}/${projectId}/${fileId}`;

/**
 * In-memory StorageAdapter, for environments without a filesystem (e.g. the browser demo).
 * Content can be exported/imported so it can be included in snapshots.
 */
export class MemoryStorage implements StorageAdapter {
  private readonly files = new Map<string, Buffer>();

  async exists(workspace: string, projectId: string, fileId: string) {
    return this.files.has(keyOf(workspace, projectId, fileId));
  }

  async read(workspace: string, projectId: string, fileId: string) {
    const key = keyOf(workspace, projectId, fileId);
    const content = this.files.get(key);
    if (!content) throw notFound(key);
    return Buffer.from(content);
  }

  async write(workspace: string, projectId: string, fileId: string, content: Buffer) {
    this.files.set(keyOf(workspace, projectId, fileId), Buffer.from(content));
  }

  async delete(workspace: string, projectId: string, fileId: string) {
    const key = keyOf(workspace, projectId, fileId);
    if (!this.files.delete(key)) throw notFound(key);
  }

  async deleteAll(workspace: string, projectId: string) {
    const prefix = `${keyOf(workspace, projectId, '')}`;
    for (const key of [...this.files.keys()]) {
      if (key.startsWith(prefix)) this.files.delete(key);
    }
  }

  async stageWrite(
    workspace: string,
    projectId: string,
    fileId: string,
    content: Buffer
  ): Promise<StagedStorageMutation> {
    const key = keyOf(workspace, projectId, fileId);
    const staged = Buffer.from(content);
    let previous: Buffer | undefined;
    let committed = false;
    return {
      commit: async () => {
        previous = this.files.get(key);
        this.files.set(key, staged);
        committed = true;
      },
      rollback: async () => {
        if (!committed) return;
        if (previous) this.files.set(key, previous);
        else this.files.delete(key);
      },
      finalize: async () => {}
    };
  }

  async stageDelete(
    workspace: string,
    projectId: string,
    fileId: string
  ): Promise<StagedStorageMutation> {
    const key = keyOf(workspace, projectId, fileId);
    let previous: Buffer | undefined;
    let committed = false;
    return {
      commit: async () => {
        previous = this.files.get(key);
        this.files.delete(key);
        committed = true;
      },
      rollback: async () => {
        if (committed && previous) this.files.set(key, previous);
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
    for (const [key, content] of Object.entries(snapshot)) {
      this.files.set(key, Buffer.from(content));
    }
  }
}
