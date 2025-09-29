import {
  appendResponseHeader,
  createError,
  createRouter,
  defineEventHandler,
  H3Event,
  readRawBody,
  serveStatic
} from 'h3';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { readFile } from 'node:fs/promises';

// Constants
const OK = { status: 'ok' };
const MAX_REQUEST_SIZE = 500 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = ['application/json', 'text/plain', 'application/octet-stream'];
const API_FS_PATH = '/api/fs';
const API_FS_WILDCARD = '/api/fs/**';

export function createFilesystemRoutes(rootPath: string) {
  const router = createRouter();
  const ROOT_RESOLVED = path.resolve(rootPath);

  const badRequest = (message: string) => {
    return createError({
      status: 400,
      statusMessage: 'Bad Request',
      data: { message }
    });
  };

  const getFullPath = (relPath: string) => {
    // More restrictive path validation: only allow alphanumeric, dots, slashes, hyphens, underscores
    if (relPath !== '' && (!/^[a-zA-Z0-9._/-]+$/.test(relPath) || relPath.includes('..'))) {
      throw badRequest('Invalid path');
    }

    const normalizedPath = path.normalize(relPath);
    const fullPath = path.resolve(relPath === '' ? rootPath : path.join(rootPath, normalizedPath));

    if (!fullPath.startsWith(ROOT_RESOLVED)) {
      throw badRequest('Invalid path');
    }

    return fullPath;
  };

  const get = async (relPath: string, event: H3Event) => {
    const p = getFullPath(relPath);

    const stat = fs.statSync(p);
    if (stat.isFile()) {
      if (p.endsWith('.json')) {
        appendResponseHeader(event, 'Content-Type', 'application/json');
      } else {
        appendResponseHeader(event, 'Content-Type', 'application/octet-stream');
      }
      return serveStatic(event, {
        getContents: () => readFile(p),
        getMeta: () => {
          return {
            size: stat.size,
            mtime: stat.mtimeMs
          };
        }
      });
    }

    return {
      entries: fs
        .readdirSync(p)
        .filter(f => !f.startsWith('.'))
        .map(f => {
          const stats = fs.statSync(path.join(p, f));
          return {
            name: f,
            isDirectory: stats.isDirectory()
          };
        })
    };
  };

  const put = async (relPath: string, event: H3Event) => {
    const p = getFullPath(relPath);

    if (relPath !== '') {
      const parent = path.dirname(p);
      if (!fs.existsSync(parent)) {
        throw badRequest('Parent directory does not exist');
      }

      if (fs.statSync(parent).isFile()) {
        throw badRequest('Parent path is a file');
      }
    }

    // Validate content type for file uploads
    const contentType = event.node.req.headers['content-type'];
    if (contentType && !ALLOWED_CONTENT_TYPES.some(allowed => contentType.startsWith(allowed))) {
      throw badRequest('Unsupported content type');
    }

    // Check content length to prevent large uploads
    const contentLength = parseInt(event.node.req.headers['content-length'] ?? '0', 10);
    if (contentLength > MAX_REQUEST_SIZE) {
      throw createError({
        status: 413,
        statusMessage: 'Payload Too Large',
        data: { message: `Request size exceeds limit of ${MAX_REQUEST_SIZE} bytes` }
      });
    }

    const body = await readRawBody(event, false);

    if (body === undefined) {
      // Create directory
      if (fs.existsSync(p)) {
        throw badRequest('Directory already exists');
      }

      fs.mkdirSync(p);
      return OK;
    } else {
      // Write file
      if (fs.existsSync(p)) {
        if (fs.statSync(p).isDirectory()) {
          throw badRequest('Path is a directory');
        }

        if (fs.statSync(p).isFile()) {
          fs.writeFileSync(p, body);
        }
      } else {
        fs.writeFileSync(p, body);
      }

      return OK;
    }
  };

  // Add filesystem API routes
  router.get(
    API_FS_PATH,
    defineEventHandler(event => get('', event))
  );
  router.get(
    API_FS_WILDCARD,
    defineEventHandler(event => get(event.context.params!._!, event))
  );

  router.put(
    API_FS_WILDCARD,
    defineEventHandler(event => put(event.context.params!._!, event))
  );

  return router;
}
