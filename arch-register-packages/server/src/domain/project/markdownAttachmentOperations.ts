import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { runAuthorizedOperation } from '../operation';

import { writeAudit, extractEntityFields, computeChanges } from '../audit/db/auditLogging';
import { fileNameFromPath } from './contentFileHelpers';
import { getMarkdownAttachmentNodes } from './contentNodeRoleUtils';
import { toApiProjectFile } from './projectHelpers';
import type { ContentNodeDbResult } from './db/projectDatabase';

import { httpAssert } from '../../utils/httpAssert';

import type { ProjectFile } from '@arch-register/api-types/projectContract';

import { coordinateContentWrite } from './contentWriteCoordinator';

import { projectDbErrorMessages } from './projectOperationHelpers';

import {
  ensureMarkdownAttachmentContainer,
  resolveMarkdownNodeScope,
  isMarkdownNode
} from './markdownOperationHelpers';
import { contentNodeScopeFields } from './contentScope';
export const uploadMarkdownAttachment = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  nodeId: string,
  filePath: string,
  buffer: Buffer,
  mimeType: string,
  originalFilename: string,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to upload markdown attachment',
    dbErrorMessages: projectDbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      const fileName = fileNameFromPath(filePath) ?? originalFilename;
      const markdownNode = await db.project.getAnyContentNodeById(ws, nodeId);
      httpAssert.present(markdownNode, {
        status: 404,
        message: `Markdown document '${nodeId}' not found`
      });
      httpAssert.true(isMarkdownNode(markdownNode), {
        status: 400,
        message: 'Node is not a markdown document'
      });
      const resolved = await resolveMarkdownNodeScope(db, ws, authCtx, markdownNode, 'edit');

      const timestamp = new Date();
      const container = await ensureMarkdownAttachmentContainer(
        db,
        ws,
        markdownNode,
        authCtx,
        timestamp,
        resolved
      );
      const attachmentPath = `${container.path}/${fileName}`;
      const siblingNodes = await resolved.listNodes(db, ws);
      const existingFile =
        getMarkdownAttachmentNodes(siblingNodes, markdownNode.id).find(
          node => node.path === attachmentPath && node.type === 'file'
        ) ?? null;
      const isUpdate = existingFile !== null;

      const attachmentId = existingFile?.id ?? randomUUID();
      let row!: ContentNodeDbResult;
      await coordinateContentWrite({
        db,
        storage,
        operation: isUpdate ? 'update-attachment' : 'create-attachment',
        scope: markdownNode.project_id
          ? 'project'
          : markdownNode.entity_id
            ? 'entity'
            : 'workspace',
        nodeIds: [attachmentId],
        storageChanges: [
          {
            type: 'write',
            workspace: ws,
            storageId: resolved.storageId,
            nodeId: attachmentId,
            content: buffer
          }
        ],
        writeDatabase: async tx => {
          row = await tx.project.upsertContentNode({
            id: attachmentId,
            workspace: ws,
            ...contentNodeScopeFields(resolved),
            parent_id: container.id,
            path: attachmentPath,
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
                operation: isUpdate ? 'update' : 'create',
                entityType: 'content_node',
                entityId: attachmentId,
                entityName: row.name,
                changes: isUpdate
                  ? computeChanges(extractEntityFields(existingFile!), extractEntityFields(row))
                  : { new: extractEntityFields(row) },
                metadata: {
                  path: attachmentPath,
                  parent_markdown_node_id: markdownNode.id,
                  is_attachment: true
                }
              })
          }
        ]
      });

      return toApiProjectFile(row);
    }
  });
};

export const createMarkdownDiagramAttachment = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspace: string,
  nodeId: string,
  name: string,
  content: Record<string, unknown>,
  event: AuthenticatedEvent
): Promise<ProjectFile> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to create diagram attachment',
    dbErrorMessages: projectDbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      const markdownNode = await db.project.getAnyContentNodeById(ws, nodeId);
      httpAssert.present(markdownNode, {
        status: 404,
        message: `Markdown document '${nodeId}' not found`
      });
      httpAssert.true(isMarkdownNode(markdownNode), {
        status: 400,
        message: 'Node is not a markdown document'
      });
      const resolved = await resolveMarkdownNodeScope(db, ws, authCtx, markdownNode, 'edit');

      const timestamp = new Date();
      const container = await ensureMarkdownAttachmentContainer(
        db,
        ws,
        markdownNode,
        authCtx,
        timestamp,
        resolved
      );

      const siblingNodes = await resolved.listNodes(db, ws);
      const existingDiagrams = getMarkdownAttachmentNodes(siblingNodes, markdownNode.id).filter(
        n => n.type === 'diagram'
      );

      let diagramName = name;
      let counter = 2;
      while (existingDiagrams.some(n => n.path === `${container.path}/${diagramName}.json`)) {
        diagramName = `${name} ${counter++}`;
      }
      const diagramPath = `${container.path}/${diagramName}.json`;

      const buffer = Buffer.from(JSON.stringify(content));
      const attachmentId = randomUUID();
      let row!: ContentNodeDbResult;
      await coordinateContentWrite({
        db,
        storage,
        operation: 'create-diagram-attachment',
        scope: markdownNode.project_id
          ? 'project'
          : markdownNode.entity_id
            ? 'entity'
            : 'workspace',
        nodeIds: [attachmentId],
        storageChanges: [
          {
            type: 'write',
            workspace: ws,
            storageId: resolved.storageId,
            nodeId: attachmentId,
            content: buffer
          }
        ],
        writeDatabase: async tx => {
          row = await tx.project.upsertContentNode({
            id: attachmentId,
            workspace: ws,
            ...contentNodeScopeFields(resolved),
            parent_id: container.id,
            path: diagramPath,
            name: diagramName,
            type: 'diagram',
            size_bytes: buffer.length,
            comment_count: 0,
            unresolved_comment_count: 0,
            created_atIfNew: timestamp,
            updated_at: timestamp,
            created_byIfNew: authCtx.userId,
            updated_by: authCtx.userId
          });
        },
        afterCommit: [
          {
            name: 'audit',
            run: tx =>
              writeAudit(tx, {
                userId: authCtx.userId,
                workspace: ws,
                operation: 'create',
                entityType: 'content_node',
                entityId: attachmentId,
                entityName: row.name,
                changes: { new: extractEntityFields(row) },
                metadata: {
                  path: diagramPath,
                  parent_markdown_node_id: markdownNode.id,
                  is_attachment: true
                }
              })
          }
        ]
      });

      return toApiProjectFile(row);
    }
  });
};
