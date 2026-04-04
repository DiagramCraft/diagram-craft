import * as fs from 'node:fs';
import * as path from 'node:path';
import { createError } from 'h3';
import type {
  FileSystemGetResult,
  FileSystemPutResult,
  FileSystemServer,
  FileSystemWriteRequest
} from '../fileSystemServer';

const MAX_REQUEST_SIZE = 500 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = ['application/json', 'text/plain', 'application/octet-stream'];

export class LocalFileSystemServer implements FileSystemServer {
  private readonly resolvedRootPath: string;

  constructor(private readonly rootPath: string) {
    this.resolvedRootPath = path.resolve(rootPath);
  }

  async get(relPath: string): Promise<FileSystemGetResult> {
    const fullPath = this.getFullPath(relPath);
    const stat = fs.statSync(fullPath);

    if (stat.isFile()) {
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

    fs.writeFileSync(fullPath, request.body);
    return { status: 'ok' };
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
}
