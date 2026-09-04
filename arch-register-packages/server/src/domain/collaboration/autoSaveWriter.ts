import { getDiagramCommentCounts } from '../diagram/commentCounts';
import { generateAccurateSvgPreview } from '../diagram/serverDiagramRenderer';
import { generateSvgPreview } from '../diagram/svgPreviewGenerator';
import { storageScope } from '../project/projectOperationHelpers';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import { createLogger } from '../../utils/logger';
import type { AutoSaveWriter } from './diagramAutoSave';
import { parseRoomPath } from './roomPath';
import { coordinateContentWrite } from '../project/contentWriteCoordinator';

const logger = createLogger('CollaborationAutoSave');

export const createAutoSaveWriter = (
  db: DatabaseAdapter,
  storage: StorageAdapter
): AutoSaveWriter => {
  return async (relPath, content) => {
    const parsed = parseRoomPath(relPath);
    if (!parsed) {
      logger.warn(`Unexpected room path format: ${relPath}`);
      return;
    }

    const workspace = await db.catalog.resolveWorkspaceSlug(parsed.workspaceSlug);
    if (!workspace) {
      logger.warn(`Unknown workspace slug in room path: ${parsed.workspaceSlug}`);
      return;
    }

    const node = await db.project.contentNodes.getAnyContentNodeById(workspace, parsed.fileId);
    if (!node) {
      logger.warn(`Ignored collaboration save for unknown content node ${parsed.fileId}`);
      return;
    }
    if (node.mount_id) {
      logger.warn(`Ignored collaboration save for read-only mounted node ${node.id}`);
      return;
    }

    const buf = Buffer.from(content, 'utf8');
    const updatedAt = new Date();
    const scope = storageScope(workspace, node);
    let commentCount = 0;
    let unresolvedCommentCount = 0;
    let previewSvg: string | null = null;
    try {
      const parsedContent = JSON.parse(content);
      const commentCounts = getDiagramCommentCounts(parsedContent);
      commentCount = commentCounts.commentCount;
      unresolvedCommentCount = commentCounts.unresolvedCommentCount;
      previewSvg =
        (await generateAccurateSvgPreview(parsedContent)) ?? generateSvgPreview(parsedContent);
    } catch {
      // Keep the existing behavior for invalid diagram JSON: update size and
      // clear derived preview/count data.
    }

    await coordinateContentWrite({
      db,
      storage,
      operation: 'collaboration-autosave',
      scope: node.project_id ? 'project' : node.entity_id ? 'entity' : 'workspace',
      nodeIds: [node.id],
      storageChanges: [
        { type: 'write', workspace, storageId: scope, nodeId: node.id, content: buf }
      ],
      writeDatabase: async tx => {
        if (node.project_id || node.entity_id) {
          await tx.project.contentNodes.updateContentNodeDerivedData(
            workspace,
            scope,
            node.id,
            buf.length,
            commentCount,
            unresolvedCommentCount,
            previewSvg,
            updatedAt
          );
        } else {
          await tx.project.contentNodes.updateWorkspaceContentNodeDerivedData(
            workspace,
            node.id,
            buf.length,
            commentCount,
            unresolvedCommentCount,
            previewSvg,
            updatedAt
          );
        }
      }
    });
  };
};
