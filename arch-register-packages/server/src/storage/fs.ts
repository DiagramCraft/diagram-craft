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
    projectId: string,
    fileId: string
  ): string {
    const fullPath = resolve(join(baseDir, workspace, projectId, fileId));
    if (!fullPath.startsWith(resolvedBaseDir + sep) && fullPath !== resolvedBaseDir) {
      throw new Error(`Path traversal detected: resolved path escapes base directory`);
    }
    return fullPath;
  }

  private resolvePath(workspace: string, projectId: string, fileId: string): string {
    return this.resolvePathFromBase(
      this.baseDir,
      this.resolvedBaseDir,
      workspace,
      projectId,
      fileId
    );
  }

  async read(workspace: string, projectId: string, fileId: string): Promise<Buffer> {
    const primaryPath = this.resolvePath(workspace, projectId, fileId);
    try {
      return await readFile(primaryPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;

      for (const fallbackBaseDir of this.resolvedFallbackBaseDirs) {
        const fallbackPath = this.resolvePathFromBase(
          fallbackBaseDir,
          fallbackBaseDir,
          workspace,
          projectId,
          fileId
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
    projectId: string,
    fileId: string,
    content: Buffer
  ): Promise<void> {
    const staged = await this.stageWrite(workspace, projectId, fileId, content);
    await staged.commit();
    await staged.finalize();
  }

  async stageWrite(
    workspace: string,
    projectId: string,
    fileId: string,
    content: Buffer,
    operationId = randomUUID()
  ): Promise<StagedStorageMutation> {
    const target = this.resolvePath(workspace, projectId, fileId);
    const staged = `${target}.staged-${operationId}`;
    const backup = `${target}.backup-${operationId}`;
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
        }
        try {
          await rename(staged, target);
          committed = true;
        } catch (error) {
          if (hasBackup) await rename(backup, target);
          throw error;
        }
      },
      rollback: async () => {
        if (committed) await ignoreMissing(() => unlink(target));
        else await ignoreMissing(() => unlink(staged));
        if (hasBackup) await rename(backup, target);
      },
      finalize: async () => {
        await ignoreMissing(() => unlink(staged));
        if (hasBackup) await ignoreMissing(() => unlink(backup));
      }
    };
  }

  async stageDelete(
    workspace: string,
    projectId: string,
    fileId: string,
    operationId = randomUUID()
  ): Promise<StagedStorageMutation> {
    const target = this.resolvePath(workspace, projectId, fileId);
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

  async delete(workspace: string, projectId: string, fileId: string): Promise<void> {
    await unlink(this.resolvePath(workspace, projectId, fileId));
  }

  async deleteAll(workspace: string, projectId: string): Promise<void> {
    await rm(this.resolvePath(workspace, projectId, ''), { recursive: true, force: true });
  }

  async reconcile(
    operation: StorageReconciliationOperation,
    action: StorageReconciliationAction
  ): Promise<void> {
    const target = this.resolvePath(operation.workspace, operation.projectId, operation.fileId);
    const staged = `${target}.staged-${operation.operationId}`;
    const backup = `${target}.backup-${operation.operationId}`;
    const quarantine = `${target}.deleted-${operation.operationId}`;

    if (operation.action === 'write') {
      if (action === 'commit') {
        try {
          await rename(target, backup);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        try {
          await rename(staged, target);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        return;
      }
      if (action === 'rollback') {
        let hasBackup = true;
        try {
          await access(backup);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') hasBackup = false;
          else throw error;
        }
        await ignoreMissing(() => unlink(staged));
        if (hasBackup) await ignoreMissing(() => unlink(target));
        try {
          if (hasBackup) await rename(backup, target);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        return;
      }
      await ignoreMissing(() => unlink(staged));
      await ignoreMissing(() => unlink(backup));
      return;
    }

    if (action === 'commit') {
      try {
        await rename(target, quarantine);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    } else if (action === 'rollback') {
      try {
        await rename(quarantine, target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    } else {
      await ignoreMissing(() => unlink(quarantine));
    }
  }
}
