import { join, resolve, dirname, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink, rm, rename } from 'node:fs/promises';
import type { StagedStorageMutation, StorageAdapter } from './storage.types';

const ignoreMissing = async (operation: () => Promise<void>) => {
  try {
    await operation();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
};

export class FilesystemStorage implements StorageAdapter {
  private readonly resolvedBaseDir: string;

  constructor(private baseDir: string) {
    this.resolvedBaseDir = resolve(baseDir);
  }

  private resolvePath(workspace: string, projectId: string, fileId: string): string {
    const fullPath = resolve(join(this.baseDir, workspace, projectId, fileId));
    if (!fullPath.startsWith(this.resolvedBaseDir + sep) && fullPath !== this.resolvedBaseDir) {
      throw new Error(`Path traversal detected: resolved path escapes base directory`);
    }
    return fullPath;
  }

  async read(workspace: string, projectId: string, fileId: string): Promise<Buffer> {
    return readFile(this.resolvePath(workspace, projectId, fileId));
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
    content: Buffer
  ): Promise<StagedStorageMutation> {
    const target = this.resolvePath(workspace, projectId, fileId);
    const suffix = randomUUID();
    const staged = `${target}.staged-${suffix}`;
    const backup = `${target}.backup-${suffix}`;
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
    fileId: string
  ): Promise<StagedStorageMutation> {
    const target = this.resolvePath(workspace, projectId, fileId);
    const quarantine = `${target}.deleted-${randomUUID()}`;
    let committed = false;
    return {
      commit: async () => {
        await rename(target, quarantine);
        committed = true;
      },
      rollback: async () => {
        if (committed) await rename(quarantine, target);
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
    await rm(join(this.baseDir, workspace, projectId), { recursive: true, force: true });
  }
}
