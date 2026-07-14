import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { defineOperation } from '../operation';
import { buildApiAuthCtx, requireProjectAccess } from '../auth/authorization';
import { writeAudit, extractEntityFields, computeChanges } from '../audit/db/auditLogging';
import { folderFromPath } from './contentFileHelpers';
import { toApiProjectFile } from './projectHelpers';
import type { ContentNodeDbResult } from './db/projectDatabase';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { httpAssert } from '../../utils/httpAssert';
import type { ContentScopeResolver } from './contentScope';
import { coordinateContentWrite } from './contentWriteCoordinator';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import { projectDbErrorMessages, requireNonProjectContentAccess, assertContentPathWritable } from './projectOperationHelpers';

export const uploadContentFile = async (
  scope: ContentScopeResolver,
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  identifier: string | undefined,
  filePath: string,
  buffer: Buffer,
  mimeType: string,
  originalFilename: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  const ws = await resolveWorkspace(db.catalog, workspace);
  const authCtx = await buildApiAuthCtx(db, ws, event);
  const resolved = await scope.resolve(db, ws, identifier, authCtx, 'edit');
  const nodes = await resolved.listNodes(db, ws);
  assertContentPathWritable(nodes, filePath);
  const existingFile = nodes.find(node => node.path === filePath && node.type === 'file');
  const folderPath = folderFromPath(filePath);
  const parentId = folderPath
    ? (nodes.find(node => node.path === folderPath && node.type === 'folder')?.id ?? null)
    : null;
  const timestamp = new Date();
  const nodeId = existingFile?.id ?? randomUUID();
  let row!: ContentNodeDbResult;

  await coordinateContentWrite({
    db,
    storage,
    operation: existingFile ? 'update-upload' : 'create-upload',
    scope: resolved.kind,
    nodeIds: [nodeId],
    storageChanges: [
      {
        type: 'write',
        workspace: ws,
        storageId: resolved.storageId,
        nodeId,
        content: buffer
      }
    ],
    writeDatabase: async tx => {
      row = await tx.project.upsertContentNode({
        id: nodeId,
        workspace: ws,
        project_id: resolved.projectId,
        entity_id: resolved.entityId,
        parent_id: parentId,
        path: filePath,
        name: originalFilename,
        type: 'file',
        size_bytes: buffer.length,
        comment_count: 0,
        unresolved_comment_count: 0,
        created_atIfNew: existingFile?.created_at ?? timestamp,
        updated_at: timestamp,
        created_byIfNew: existingFile?.created_by ?? authCtx.userId,
        updated_by: authCtx.userId,
        mime_type: mimeType,
        original_filename: originalFilename
      });
    },
    afterCommit: [
      {
        name: 'audit',
        run: () =>
          writeAudit(db, {
            userId: authCtx.userId,
            workspace: ws,
            operation: existingFile ? 'update' : 'create',
            entityType: 'content_node',
            entityId: row.id,
            entityName: row.name,
            changes: existingFile
              ? computeChanges(extractEntityFields(existingFile), extractEntityFields(row))
              : { new: extractEntityFields(row) },
            metadata: { ...resolved.auditMetadata, path: filePath }
          })
      }
    ]
  });
  return toApiProjectFile(row);
};

export const downloadProjectFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  id: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<{ buffer: Buffer; mimeType: string | null; originalFilename: string | null }> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to download file',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
      const project = await db.project.getProject(ws, id);
      httpAssert.present(project, { status: 404, message: `Project '${id}' not found` });
      requireProjectAccess(authCtx, project.owner);
      const projectUuid = project.id;

      const file = await db.project.getContentNodeByPath(ws, projectUuid, filePath);
      httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });
      httpAssert.true(file.type === 'file', { status: 400, message: 'Node is not a binary file' });

      const buffer = await storage.read(ws, projectUuid, file.id);
      return { buffer, mimeType: file.mime_type, originalFilename: file.original_filename };
    }
  );
};

export const downloadEntityFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  entityId: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<{ buffer: Buffer; mimeType: string | null; originalFilename: string | null }> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to download entity file',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
      requireNonProjectContentAccess(authCtx, 'read');
      const entity = await db.catalog.getEntity(ws, entityId);
      httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
      const entityUuid = entity.id;

      const entityNodes = await db.project.listEntityContentNodes(ws, entityUuid);
      const file = entityNodes.find(n => n.path === filePath) ?? null;
      httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });
      httpAssert.true(file.type === 'file', { status: 400, message: 'Node is not a binary file' });

      const buffer = await storage.read(ws, entityUuid, file.id);
      return { buffer, mimeType: file.mime_type, originalFilename: file.original_filename };
    }
  );
};

export const downloadWorkspaceFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<{ buffer: Buffer; mimeType: string | null; originalFilename: string | null }> => {
  return defineOperation(
    db,
    workspace,
    event,
    {
      fallback: 'Failed to download workspace file',
      dbErrorMessages: projectDbErrorMessages
    },
    async ({ ws, authCtx }) => {
      requireNonProjectContentAccess(authCtx, 'read');
      const wsNodes = await db.project.listWorkspaceContentNodes(ws);
      const file = wsNodes.find(n => n.path === filePath) ?? null;
      httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });
      httpAssert.true(file.type === 'file', { status: 400, message: 'Node is not a binary file' });

      const buffer = await storage.read(ws, ws, file.id);
      return { buffer, mimeType: file.mime_type, originalFilename: file.original_filename };
    }
  );
};
