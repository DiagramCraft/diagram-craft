import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { runAuthorizedOperation } from '../operation';
import { writeAudit, extractEntityFields, computeChanges } from '../audit/db/auditLogging';
import { toApiProjectFile } from './projectHelpers';
import type { ContentNodeDbResult } from './db/projectDatabase';
import { httpAssert } from '../../utils/httpAssert';
import {
  contentNodeScopeFields,
  contentParentId,
  ENTITY_SCOPE,
  PROJECT_SCOPE,
  WORKSPACE_SCOPE,
  type ContentScopeResolver
} from './contentScope';
import { coordinateContentWrite } from './contentWriteCoordinator';
import type { ProjectFile } from '@arch-register/api-types/projectContentContract';
import {
  projectDbErrorMessages,
  requireNonProjectContentAccess,
  assertContentPathWritable
} from './projectOperationHelpers';

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
): Promise<ProjectFile> =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    fallback: 'Failed to upload file',
    dbErrorMessages: projectDbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      const resolved = await scope.resolve(db, ws, identifier, authCtx, 'edit');
      const nodes = await resolved.listNodes(db, ws);
      assertContentPathWritable(nodes, filePath);
      const existingFile = nodes.find(node => node.path === filePath && node.type === 'file');
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
            ...contentNodeScopeFields(resolved),
            parent_id: contentParentId(nodes, filePath),
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
            run: tx =>
              writeAudit(tx, {
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
    }
  });

export const downloadContentFile = async (
  scope: ContentScopeResolver,
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  identifier: string | undefined,
  filePath: string,
  event: AuthenticatedEvent,
  fallback: string
): Promise<{ buffer: Buffer; mimeType: string | null; originalFilename: string | null }> =>
  runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: fallback,
    dbErrorMessages: projectDbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      if (scope.kind !== 'project') requireNonProjectContentAccess(authCtx, 'read');
      const resolved = await scope.resolve(
        db,
        ws,
        identifier,
        authCtx,
        'read',
        scope.kind === 'project'
      );
      const file = await resolved.findNodeByPath(db, ws, filePath);
      httpAssert.present(file, { status: 404, message: `File '${filePath}' not found` });
      httpAssert.true(file.type === 'file', { status: 400, message: 'Node is not a binary file' });

      const buffer = await storage.read(ws, resolved.storageId, file.id);
      return { buffer, mimeType: file.mime_type, originalFilename: file.original_filename };
    }
  });

export const downloadProjectFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  id: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<{ buffer: Buffer; mimeType: string | null; originalFilename: string | null }> => {
  return downloadContentFile(
    PROJECT_SCOPE,
    db,
    storage,
    workspace,
    id,
    filePath,
    event,
    'Failed to download file'
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
  return downloadContentFile(
    ENTITY_SCOPE,
    db,
    storage,
    workspace,
    entityId,
    filePath,
    event,
    'Failed to download entity file'
  );
};

export const downloadWorkspaceFile = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  filePath: string,
  event: AuthenticatedEvent
): Promise<{ buffer: Buffer; mimeType: string | null; originalFilename: string | null }> => {
  return downloadContentFile(
    WORKSPACE_SCOPE,
    db,
    storage,
    workspace,
    undefined,
    filePath,
    event,
    'Failed to download workspace file'
  );
};
