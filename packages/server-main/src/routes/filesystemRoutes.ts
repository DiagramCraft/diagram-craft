import {
  appendResponseHeader,
  createRouter,
  defineEventHandler,
  readRawBody,
  serveStatic
} from 'h3';
import { readFile } from 'node:fs/promises';
import type { FileSystemServer } from './fileSystemServer';

// Constants
const API_FS_PATH = '/api/fs';
const API_FS_WILDCARD = '/api/fs/**';

export function createFilesystemRoutes(fileSystemServer: FileSystemServer) {
  const router = createRouter();

  // Add filesystem API routes
  router.get(
    API_FS_PATH,
    defineEventHandler(async event => {
      const result = await fileSystemServer.get('');
      if (result.type === 'file') {
        appendResponseHeader(event, 'Content-Type', result.contentType);
        return serveStatic(event, {
          getContents: () => readFile(result.path),
          getMeta: () => ({
            size: result.size,
            mtime: result.modifiedAt
          })
        });
      }

      return { entries: result.entries };
    })
  );
  router.get(
    API_FS_WILDCARD,
    defineEventHandler(async event => {
      const result = await fileSystemServer.get(event.context.params!._!);
      if (result.type === 'file') {
        appendResponseHeader(event, 'Content-Type', result.contentType);
        return serveStatic(event, {
          getContents: () => readFile(result.path),
          getMeta: () => ({
            size: result.size,
            mtime: result.modifiedAt
          })
        });
      }

      return { entries: result.entries };
    })
  );

  router.put(
    API_FS_WILDCARD,
    defineEventHandler(async event => {
      const contentType = event.node.req.headers['content-type'];
      const contentTypeValue = Array.isArray(contentType) ? contentType[0] : contentType;
      const contentLength = parseInt(event.node.req.headers['content-length'] ?? '0', 10);
      const body = await readRawBody(event, false);

      return fileSystemServer.put(event.context.params!._!, {
        contentType: contentTypeValue,
        contentLength,
        body
      });
    })
  );

  return router;
}
