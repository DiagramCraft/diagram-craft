import { H3Event, HTTPError } from 'h3';
import type { DatabaseAdapter } from '../db/database.js';

export const resolveWorkspace = async (event: H3Event, db: DatabaseAdapter): Promise<string> => {
  const slug = event.context.params?.['workspace'];
  if (!slug) throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'workspace is required' });

  const row = await db.resolveWorkspaceSlug(slug);
  if (!row) throw new HTTPError({ status: 404, statusText: 'Not Found', message: `Workspace '${slug}' not found` });

  return row;
};
