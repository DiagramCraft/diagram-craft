import type { CatalogDatabase } from '../db/database.js';
import { httpAssert } from './httpAssert.js';

export const resolveWorkspace = async (catalog: CatalogDatabase, slug: string | undefined): Promise<string> => {
  httpAssert.string(slug, { message: 'workspace is required' });

  const row = await catalog.resolveWorkspaceSlug(slug);
  httpAssert.present(row, { status: 404, message: `Workspace '${slug}' not found` });

  return row;
};
