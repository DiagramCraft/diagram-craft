import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import { buildTemplateWikiPages, type TemplateWikiOptions } from './templateWikiPages';

/**
 * Creates the wiki pages shipped with the given template bundles in the workspace.
 *
 * Existing nodes are left untouched (`createContentNodeIfAbsent`), so pages a user has since
 * edited are never overwritten when a template is applied again.
 */
export const persistTemplateWikiPages = async (
  db: DatabaseAdapter,
  storage: Pick<StorageAdapter, 'write'> | undefined,
  options: TemplateWikiOptions,
  now: Date,
  userId: string | null
): Promise<void> => {
  // Page bodies live in storage; without it the nodes would be empty pages.
  if (!storage) return;
  for (const node of buildTemplateWikiPages(options)) {
    const size =
      node.body === undefined ? 0 : Buffer.byteLength(JSON.stringify({ body: node.body }), 'utf8');
    const created = await db.project.contentNodes.createContentNodeIfAbsent({
      id: node.id,
      workspace: options.workspaceId,
      project_id: null,
      entity_id: null,
      parent_id: node.parentId,
      path: node.path,
      name: node.name,
      type: node.type,
      size_bytes: size,
      comment_count: 0,
      unresolved_comment_count: 0,
      created_atIfNew: now,
      created_byIfNew: userId,
      updated_at: now,
      updated_by: userId
    });
    if (created && node.body !== undefined) {
      await storage.write(
        options.workspaceId,
        options.workspaceId,
        created.id,
        Buffer.from(JSON.stringify({ body: node.body }), 'utf8')
      );
    }
  }
};
