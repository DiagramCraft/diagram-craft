import { getDiagramCommentCounts } from '../diagram/commentCounts';
import { generateAccurateSvgPreview } from '../diagram/serverDiagramRenderer';
import { generateSvgPreview } from '../diagram/svgPreviewGenerator';
import { storageScope } from '../project/projectOperationHelpers';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import { createLogger } from '../../utils/logger';
import type { AutoSaveWriter } from './diagramAutoSave';
import { parseRoomPath } from './roomPath';

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

    const node = await db.project.getAnyContentNodeById(workspace, parsed.fileId);
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
    await storage.write(workspace, scope, node.id, buf);

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

    if (node.project_id || node.entity_id) {
      await db.project.updateContentNodeDerivedData(
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
      await db.project.updateWorkspaceContentNodeDerivedData(
        workspace,
        node.id,
        buf.length,
        commentCount,
        unresolvedCommentCount,
        previewSvg,
        updatedAt
      );
    }
  };
};
