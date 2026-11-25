import { join, resolve, dirname, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, writeFile, unlink, rm, rename } from 'node:fs/promises';
import type {
  StagedStorageMutation,
  StorageAdapter,
  StorageReconciliationAction,
  StorageReconciliationOperation
} from './storage.types';

const ignoreMissing = async (operation: () => Promise<void>) => {
  try {
    await operation();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
};

export class FilesystemStorage implements StorageAdapter {
  private readonly resolvedBaseDir: string;
  private readonly resolvedFallbackBaseDirs: string[];

  constructor(
    private baseDir: string,
    fallbackBaseDirs: readonly string[] = []
  ) {
    this.resolvedBaseDir = resolve(baseDir);
    this.resolvedFallbackBaseDirs = fallbackBaseDirs.map(fallbackBaseDir =>
      resolve(fallbackBaseDir)
    );
  }

  private resolvePathFromBase(
    baseDir: string,
    resolvedBaseDir: string,
    workspace: string,
    scopeId: string,
    nodeId: string
  ): string {
    const fullPath = resolve(join(baseDir, workspace, scopeId, nodeId));
    if (!fullPath.startsWith(resolvedBaseDir + sep) && fullPath !== resolvedBaseDir) {
      throw new Error(`Path traversal detected: resolved path escapes base directory`);
    }
    return fullPath;
  }

  private resolvePath(workspace: string, scopeId: string, nodeId: string): string {
    return this.resolvePathFromBase(
      this.baseDir,
      this.resolvedBaseDir,
      workspace,
      scopeId,
      nodeId
    );
  }

  async exists(workspace: string, scopeId: string, nodeId: string): Promise<boolean> {
    const paths = [
      this.resolvePath(workspace, scopeId, nodeId),
      ...this.resolvedFallbackBaseDirs.map(fallbackBaseDir =>
        this.resolvePathFromBase(fallbackBaseDir, fallbackBaseDir, workspace, scopeId, nodeId)
      )
    ];
    for (const path of paths) {
      try {
        await access(path);
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    return false;
  }

  async read(workspace: string, scopeId: string, nodeId: string): Promise<Buffer> {
    const primaryPath = this.resolvePath(workspace, scopeId, nodeId);
    try {
      return await readFile(primaryPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;

      for (const fallbackBaseDir of this.resolvedFallbackBaseDirs) {
        const fallbackPath = this.resolvePathFromBase(
          fallbackBaseDir,
          fallbackBaseDir,
          workspace,
          scopeId,
          nodeId
        );
        try {
          return await readFile(fallbackPath);
        } catch (fallbackError) {
          if ((fallbackError as NodeJS.ErrnoException).code !== 'ENOENT') throw fallbackError;
        }
      }

      throw error;
    }
  }

  async write(
    workspace: string,
    scopeId: string,
    nodeId: string,
    content: Buffer
  ): Promise<void> {
    const staged = await this.stageWrite(workspace, scopeId, nodeId, content);
    await staged.commit();
    await staged.finalize();
  }

  async stageWrite(
    workspace: string,
    scopeId: string,
    nodeId: string,
    content: Buffer,
    operationId = randomUUID()
  ): Promise<StagedStorageMutation> {
    const target = this.resolvePath(workspace, scopeId, nodeId);
    const staged = `${target}.staged-${operationId}`;
    const backup = `${target}.backup-${operationId}`;
    const created = `${target}.created-${operationId}`;
    await mkdir(dirname(target), { recursive: true });
    await writeFile(staged, content);
    let committed = false;
    let hasBackup = false;

    return {
      commit: async () => {
        try {
          await rename(target, backup);
          hasBackup = true;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          // No previous file: leave a durable marker so recovery can remove the new file
          await writeFile(created, '');
        }
        try {
          await rename(staged, target);
          committed = true;
        } catch (error) {
          if (hasBackup) await rename(backup, target);
          else await ignoreMissing(() => unlink(created));
          throw error;
        }
      },
      rollback: async () => {
        await this.rollbackWrite(target, staged, backup, created, committed);
      },
      finalize: async () => {
        await this.finalizeWrite(staged, backup, created);
      }
    };
  }

  private async rollbackWrite(
    target: string,
    staged: string,
    backup: string,
    created: string,
    published: boolean
  ) {
    await ignoreMissing(() => unlink(staged));
    if (await this.pathExists(backup)) {
      await ignoreMissing(() => unlink(target));
      await rename(backup, target);
    } else if (published || (await this.pathExists(created))) {
      await ignoreMissing(() => unlink(target));
    }
    await ignoreMissing(() => unlink(created));
  }

  private async finalizeWrite(staged: string, backup: string, created: string) {
    await ignoreMissing(() => unlink(staged));
    await ignoreMissing(() => unlink(backup));
    await ignoreMissing(() => unlink(created));
  }

  private async pathExists(path: string) {
    try {
      await access(path);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  }

  async stageDelete(
    workspace: string,
    scopeId: string,
    nodeId: string,
    operationId = randomUUID()
  ): Promise<StagedStorageMutation> {
    const target = this.resolvePath(workspace, scopeId, nodeId);
    const quarantine = `${target}.deleted-${operationId}`;
    let committed = false;
    return {
      commit: async () => {
        try {
          await rename(target, quarantine);
          committed = true;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') committed = true;
          else throw error;
        }
      },
      rollback: async () => {
        if (committed) {
          try {
            await rename(quarantine, target);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          }
        }
      },
      finalize: async () => {
        await ignoreMissing(() => unlink(quarantine));
      }
    };
  }

  async delete(workspace: string, scopeId: string, nodeId: string): Promise<void> {
    await unlink(this.resolvePath(workspace, scopeId, nodeId));
  }

  async deleteAll(workspace: string, scopeId: string): Promise<void> {
    await rm(this.resolvePath(workspace, scopeId, ''), { recursive: true, force: true });
  }

  async reconcile(
    operation: StorageReconciliationOperation,
    action: StorageReconciliationAction
  ): Promise<void> {
    const target = this.resolvePath(operation.workspace, operation.scopeId, operation.nodeId);
    const staged = `${target}.staged-${operation.operationId}`;
    const backup = `${target}.backup-${operation.operationId}`;
    const created = `${target}.created-${operation.operationId}`;
    const quarantine = `${target}.deleted-${operation.operationId}`;

    if (operation.action === 'write') {
      if (action === 'rollback') {
        await this.rollbackWrite(target, staged, backup, created, false);
      } else {
        await this.finalizeWrite(staged, backup, created);
      }
      return;
    }

    if (action === 'rollback') {
      await ignoreMissing(() => rename(quarantine, target));
    } else {
      await ignoreMissing(() => unlink(quarantine));
    }
  }
}
