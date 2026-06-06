import { H3Event } from 'h3';
import type { DatabaseAdapter } from '../db/database.js';
import { httpAssert } from './httpAssert.js';

export const resolveWorkspace = async (event: H3Event, db: DatabaseAdapter): Promise<string> => {
  const slug = event.context.params?.['workspace'];
  httpAssert.string(slug, { message: 'workspace is required' });

  const row = await db.catalog.resolveWorkspaceSlug(slug);
  httpAssert.present(row, { status: 404, message: `Workspace '${slug}' not found` });

  return row;
};
