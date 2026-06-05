import {
  defineHandler,
  H3,
  serveStatic
} from 'h3';
import { readFile } from 'node:fs/promises';
import type { FileSystemServer } from '../fileSystemServer';

// Constants
const API_FS_PATH = '/api/fs';
const API_FS_WILDCARD = '/api/fs/**';

export function createFilesystemRoutes(fileSystemServer: FileSystemServer) {
  const router = new H3();

  // Add filesystem API routes
  router.get(
    API_FS_PATH,
    defineHandler(async event => {
      const result = await fileSystemServer.get('');
      if (result.type === 'file') {
        event.res.headers.append('Content-Type', result.contentType);
        return serveStatic(event, {
          getContents: async () => {
            const buffer = await readFile(result.path);
            return new Uint8Array(buffer);
          },
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
    defineHandler(async event => {
      const result = await fileSystemServer.get(event.context.params!._!);
      if (result.type === 'file') {
        event.res.headers.append('Content-Type', result.contentType);
        return serveStatic(event, {
          getContents: async () => {
            const buffer = await readFile(result.path);
            return new Uint8Array(buffer);
          },
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
    defineHandler(async event => {
      const createDirectory = event.req.headers.get('x-diagram-craft-create-directory') === 'true';
      const contentTypeValue = event.req.headers.get('content-type') ?? undefined;
      const contentLength = parseInt(event.req.headers.get('content-length') ?? '0', 10);
      const body = createDirectory
        ? undefined
        : await event.req.arrayBuffer().catch(() => undefined);

      return fileSystemServer.put(event.context.params!._!, {
        contentType: contentTypeValue,
        contentLength,
        body: body ? Buffer.from(body) : undefined
      });
    })
  );

  return router;
}
