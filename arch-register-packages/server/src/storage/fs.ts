import { join, dirname } from 'node:path';
import { mkdir, readFile, writeFile, unlink, rm, access } from 'node:fs/promises';
import type { StorageAdapter } from './types.js';

export class FilesystemStorage implements StorageAdapter {
  constructor(private baseDir: string) {}

  private resolvePath(workspace: string, projectId: string, path: string): string {
    return join(this.baseDir, workspace, projectId, path);
  }

  async read(workspace: string, projectId: string, path: string): Promise<Buffer> {
    return readFile(this.resolvePath(workspace, projectId, path));
  }

  async write(workspace: string, projectId: string, path: string, content: Buffer): Promise<void> {
    const fullPath = this.resolvePath(workspace, projectId, path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content);
  }

  async delete(workspace: string, projectId: string, path: string): Promise<void> {
    await unlink(this.resolvePath(workspace, projectId, path));
  }

  async deleteAll(workspace: string, projectId: string): Promise<void> {
    await rm(join(this.baseDir, workspace, projectId), { recursive: true, force: true });
  }

  async exists(workspace: string, projectId: string, path: string): Promise<boolean> {
    try {
      await access(this.resolvePath(workspace, projectId, path));
      return true;
    } catch {
      return false;
    }
  }
}
