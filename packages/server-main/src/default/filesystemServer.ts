import * as fs from 'node:fs';
import * as path from 'node:path';
import { createError } from 'h3';
import { newid } from '@diagram-craft/utils/id';
import type { CollaborationServer } from '../collaborationServer';
import { createLogger } from '../logger';
import type {
  FileSystemGetResult,
  FileSystemPutResult,
  FileSystemServer,
  FileSystemWriteRequest
} from '../fileSystemServer';

const log = createLogger('LocalFileSystemServer');

const MAX_REQUEST_SIZE = 500 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = ['application/json', 'text/plain', 'application/octet-stream'];

const SNAPSHOT_DIR = '.snapshot';
const SNAPSHOT_AGE_MS = 60 * 60 * 1000; // 1 hour
const MAX_SNAPSHOTS = 10;

const TEMP_DIR = '.temp';

export class LocalFileSystemServer implements FileSystemServer {
  private readonly resolvedRootPath: string;

  constructor(
    private readonly rootPath: string,
    private readonly collaborationServer?: CollaborationServer
  ) {
    this.resolvedRootPath = path.resolve(rootPath);
    log.debug(`Created: rootPath=${rootPath} hasCollaborationServer=${!!collaborationServer}`);
  }

  async get(relPath: string): Promise<FileSystemGetResult> {
    const fullPath = this.getFullPath(relPath);
    const stat = fs.statSync(fullPath);

    if (stat.isFile()) {
      log.debug(`get: relPath=${relPath} hasCollaborationServer=${!!this.collaborationServer}`);
      this.collaborationServer?.ensureRoom(this.getRoomName(relPath));

      return {
        type: 'file',
        path: fullPath,
        size: stat.size,
        modifiedAt: stat.mtimeMs,
        contentType: fullPath.endsWith('.json') ? 'application/json' : 'application/octet-stream'
      };
    }

    return {
      type: 'directory',
      entries: fs
        .readdirSync(fullPath)
        .filter(entry => !entry.startsWith('.'))
        .map(entry => {
          const entryStats = fs.statSync(path.join(fullPath, entry));
          return {
            name: entry,
            isDirectory: entryStats.isDirectory()
          };
        })
    };
  }

  async put(relPath: string, request: FileSystemWriteRequest): Promise<FileSystemPutResult> {
    const fullPath = this.getFullPath(relPath);

    if (relPath !== '') {
      const parentPath = path.dirname(fullPath);
      if (!fs.existsSync(parentPath)) {
        throw this.badRequest('Parent directory does not exist');
      }

      if (fs.statSync(parentPath).isFile()) {
        throw this.badRequest('Parent path is a file');
      }
    }

    if (
      request.contentType &&
      !ALLOWED_CONTENT_TYPES.some(allowedType => request.contentType?.startsWith(allowedType))
    ) {
      throw this.badRequest('Unsupported content type');
    }

    if ((request.contentLength ?? 0) > MAX_REQUEST_SIZE) {
      throw createError({
        status: 413,
        statusMessage: 'Payload Too Large',
        data: { message: `Request size exceeds limit of ${MAX_REQUEST_SIZE} bytes` }
      });
    }

    if (request.body === undefined) {
      if (fs.existsSync(fullPath)) {
        throw this.badRequest('Directory already exists');
      }

      fs.mkdirSync(fullPath);
      return { status: 'ok' };
    }

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      throw this.badRequest('Path is a directory');
    }

    this.maybeSnapshot(relPath, fullPath);

    fs.writeFileSync(fullPath, request.body);
    return { status: 'ok' };
  }

  getTempPath(name: string): string {
    const tempDir = path.join(this.resolvedRootPath, TEMP_DIR);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const ext = path.extname(name);
    const base = path.basename(name, ext);
    const uniqueId = newid();
    return `${TEMP_DIR}/${base}-${uniqueId}${ext}`;
  }

  private maybeSnapshot(relPath: string, fullPath: string) {
    if (!fs.existsSync(fullPath)) return;

    const stat = fs.statSync(fullPath);
    if (Date.now() - stat.mtimeMs < SNAPSHOT_AGE_MS) return;

    const snapshotDir = path.join(
      this.resolvedRootPath,
      SNAPSHOT_DIR,
      path.dirname(relPath) === '.' ? '' : path.dirname(relPath)
    );

    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }

    const basename = path.basename(relPath);
    const timestamp = new Date(stat.mtimeMs).toISOString().replace(/[:.]/g, '-');
    const snapshotPath = path.join(snapshotDir, `${basename}.${timestamp}`);

    fs.copyFileSync(fullPath, snapshotPath);
    log.debug(`Snapshot created: ${snapshotPath}`);

    // Prune old snapshots, keeping only MAX_SNAPSHOTS most recent
    const entries = fs
      .readdirSync(snapshotDir)
      .filter(e => e.startsWith(`${basename}.`))
      .sort();

    if (entries.length > MAX_SNAPSHOTS) {
      for (const old of entries.slice(0, entries.length - MAX_SNAPSHOTS)) {
        fs.rmSync(path.join(snapshotDir, old));
        log.debug(`Snapshot pruned: ${old}`);
      }
    }
  }

  private badRequest(message: string) {
    return createError({
      status: 400,
      statusMessage: 'Bad Request',
      data: { message }
    });
  }

  private getFullPath(relPath: string) {
    if (relPath !== '' && (!/^[a-zA-Z0-9._/-]+$/.test(relPath) || relPath.includes('..'))) {
      throw this.badRequest('Invalid path');
    }

    const normalizedPath = path.normalize(relPath);
    const fullPath = path.resolve(
      relPath === '' ? this.rootPath : path.join(this.rootPath, normalizedPath)
    );

    if (!fullPath.startsWith(this.resolvedRootPath)) {
      throw this.badRequest('Invalid path');
    }

    return fullPath;
  }

  private getRoomName(relPath: string) {
    return relPath;
  }
}
