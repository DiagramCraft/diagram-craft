import { createRouter, getQuery, getRouterParam, readBody, assertBodySize, HTTPError } from 'h3';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { API_PREFIXES } from '../../constants';
import {
  uploadContentFile,
  downloadProjectFile,
  downloadEntityFile,
  downloadWorkspaceFile
} from './fileTransferOperations';
import { PROJECT_SCOPE, ENTITY_SCOPE, WORKSPACE_SCOPE } from './contentScope';
import {
  uploadMarkdownAttachment,
  createMarkdownDiagramAttachment
} from './markdownAttachmentOperations';

const MAX_SIZE_BYTES = parseInt(process.env['UPLOAD_MAX_SIZE_MB'] ?? '50', 10) * 1024 * 1024;
const MAX_REQUEST_SIZE_BYTES = MAX_SIZE_BYTES + 1024 * 1024;

const readUpload = async (
  event: AuthenticatedEvent
): Promise<{ buffer: Buffer; mimeType: string; originalFilename: string }> => {
  await assertBodySize(event, MAX_REQUEST_SIZE_BYTES);
  // h3's body-size limiter exposes a proxied formData() that does not preserve
  // the request headers when it creates the limited stream. Rebuild the request
  // so the multipart boundary remains available to the native parser.
  const request = new Request(event.req.url, {
    method: event.req.method,
    headers: event.req.headers,
    body: event.req.body,
    duplex: 'half'
  } as RequestInit & { duplex: 'half' });
  const formData = await request.formData();
  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    throw new HTTPError({ status: 400, message: 'Missing file field in multipart body' });
  }
  const data = new Uint8Array(await file.arrayBuffer());
  if (data.byteLength > MAX_SIZE_BYTES) {
    throw new HTTPError({
      status: 413,
      message: `File exceeds the maximum allowed size of ${MAX_SIZE_BYTES / 1024 / 1024} MB`
    });
  }
  return {
    buffer: Buffer.from(data),
    mimeType: file.type ?? 'application/octet-stream',
    originalFilename: file.name ?? 'upload'
  };
};

export const createProjectFileRoutesHandler = (db: DatabaseAdapter, storage: StorageAdapter) => {
  const router = createRouter();

  const registerRoutes = (prefix: string) => {
    // ── Project-scoped ─────────────────────────────────────────

    router.post(`${prefix}/:workspace/markdown/:nodeId/attachments/upload`, async event => {
      const workspace = getRouterParam(event, 'workspace')!;
      const nodeId = getRouterParam(event, 'nodeId')!;
      const { path } = getQuery(event) as { path: string };
      const { buffer, mimeType, originalFilename } = await readUpload(event as AuthenticatedEvent);
      return uploadMarkdownAttachment(
        db,
        storage,
        workspace,
        nodeId,
        path,
        buffer,
        mimeType,
        originalFilename,
        event as AuthenticatedEvent
      );
    });

    router.post(`${prefix}/:workspace/markdown/:nodeId/attachments/diagram`, async event => {
      const workspace = getRouterParam(event, 'workspace')!;
      const nodeId = getRouterParam(event, 'nodeId')!;
      const body = (await readBody(event)) as { name: string; content: Record<string, unknown> };
      return createMarkdownDiagramAttachment(
        db,
        storage,
        workspace,
        nodeId,
        body.name,
        body.content,
        event as AuthenticatedEvent
      );
    });

    router.post(`${prefix}/:workspace/projects/:id/files/upload`, async event => {
      const workspace = getRouterParam(event, 'workspace')!;
      const id = getRouterParam(event, 'id')!;
      const { path } = getQuery(event) as { path: string };
      const { buffer, mimeType, originalFilename } = await readUpload(event as AuthenticatedEvent);
      return uploadContentFile(
        PROJECT_SCOPE,
        db,
        storage,
        workspace,
        id,
        path,
        buffer,
        mimeType,
        originalFilename,
        event as AuthenticatedEvent
      );
    });

    router.get(`${prefix}/:workspace/projects/:id/files/download`, async event => {
      const workspace = getRouterParam(event, 'workspace')!;
      const id = getRouterParam(event, 'id')!;
      const { path } = getQuery(event) as { path: string };
      const result = await downloadProjectFile(
        db,
        storage,
        workspace,
        id,
        path,
        event as AuthenticatedEvent
      );
      return new Response(new Uint8Array(result.buffer), {
        headers: {
          'Content-Type': result.mimeType ?? 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(result.originalFilename ?? 'download')}"`
        }
      });
    });

    // ── Entity-scoped ───────────────────────────────────────────

    router.post(`${prefix}/:workspace/entities/:entityId/content/files/upload`, async event => {
      const workspace = getRouterParam(event, 'workspace')!;
      const entityId = getRouterParam(event, 'entityId')!;
      const { path } = getQuery(event) as { path: string };
      const { buffer, mimeType, originalFilename } = await readUpload(event as AuthenticatedEvent);
      return uploadContentFile(
        ENTITY_SCOPE,
        db,
        storage,
        workspace,
        entityId,
        path,
        buffer,
        mimeType,
        originalFilename,
        event as AuthenticatedEvent
      );
    });

    router.get(`${prefix}/:workspace/entities/:entityId/content/files/download`, async event => {
      const workspace = getRouterParam(event, 'workspace')!;
      const entityId = getRouterParam(event, 'entityId')!;
      const { path } = getQuery(event) as { path: string };
      const result = await downloadEntityFile(
        db,
        storage,
        workspace,
        entityId,
        path,
        event as AuthenticatedEvent
      );
      return new Response(new Uint8Array(result.buffer), {
        headers: {
          'Content-Type': result.mimeType ?? 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(result.originalFilename ?? 'download')}"`
        }
      });
    });

    // ── Workspace-scoped ────────────────────────────────────────

    router.post(`${prefix}/:workspace/content/files/upload`, async event => {
      const workspace = getRouterParam(event, 'workspace')!;
      const { path } = getQuery(event) as { path: string };
      const { buffer, mimeType, originalFilename } = await readUpload(event as AuthenticatedEvent);
      return uploadContentFile(
        WORKSPACE_SCOPE,
        db,
        storage,
        workspace,
        undefined,
        path,
        buffer,
        mimeType,
        originalFilename,
        event as AuthenticatedEvent
      );
    });

    router.get(`${prefix}/:workspace/content/files/download`, async event => {
      const workspace = getRouterParam(event, 'workspace')!;
      const { path } = getQuery(event) as { path: string };
      const result = await downloadWorkspaceFile(
        db,
        storage,
        workspace,
        path,
        event as AuthenticatedEvent
      );
      return new Response(new Uint8Array(result.buffer), {
        headers: {
          'Content-Type': result.mimeType ?? 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(result.originalFilename ?? 'download')}"`
        }
      });
    });
  };

  registerRoutes(API_PREFIXES.application);

  return router;
};
