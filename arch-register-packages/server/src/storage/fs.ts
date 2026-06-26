import { join, resolve, dirname, sep } from 'node:path';
import { mkdir, readFile, writeFile, unlink, rm } from 'node:fs/promises';
import type { StorageAdapter } from './storage.types';

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
    const fullPath = this.resolvePath(workspace, projectId, fileId);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content);
  }

  async delete(workspace: string, projectId: string, fileId: string): Promise<void> {
    await unlink(this.resolvePath(workspace, projectId, fileId));
  }

  async deleteAll(workspace: string, projectId: string): Promise<void> {
    await rm(join(this.baseDir, workspace, projectId), { recursive: true, force: true });
  }
}
