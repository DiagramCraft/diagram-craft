import { H3Event, HTTPError } from 'h3';
import sql from '../db/client.js';

export const resolveWorkspace = async (event: H3Event): Promise<string> => {
  const slug = event.context.params?.['workspace'];
  if (!slug) throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'workspace is required' });

  const [row] = await sql<{ id: string }[]>`
    SELECT id FROM workspace WHERE url_slug = ${slug}
  `;
  if (!row) throw new HTTPError({ status: 404, statusText: 'Not Found', message: `Workspace '${slug}' not found` });

  return row.id;
};
