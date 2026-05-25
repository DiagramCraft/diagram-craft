import { H3, HTTPError, defineHandler } from 'h3';
import sql from '../db/client.js';
import type { Workspace } from '../types.js';

const BASE = '/api/workspaces';

const handleError = (error: unknown, fallback: string): never => {
  if (HTTPError.isError(error)) throw error;
  throw new HTTPError({ status: 500, statusText: 'Internal Server Error', message: fallback });
};

export function createWorkspaceRoutes() {
  const router = new H3();

  // GET /api/workspaces
  router.get(
    BASE,
    defineHandler(async () => {
      try {
        return await sql<Workspace[]>`SELECT * FROM workspace ORDER BY id`;
      } catch (e) {
        handleError(e, 'Failed to retrieve workspaces');
      }
    })
  );

  return router;
}
