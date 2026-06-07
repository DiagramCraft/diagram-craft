import { H3, defineHandler } from 'h3';
import type { DatabaseAdapter } from '../db/database.js';
import type { Entity, EntitySchema } from '../types.js';
import { resolveWorkspace } from '../utils/resolveWorkspace.js';
import { handleDbError } from '../utils/http.js';
import { toDiagramCraftData, toDiagramCraftSchema } from '../api/public-transforms.js';

const PUBLIC_SCHEMAS_BASE = '/api/public/:workspace/schemas';
const PUBLIC_DATA_BASE = '/api/public/:workspace/data';

const handleError = (error: unknown, fallback: string): never => handleDbError(error, fallback);

export function createPublicRoutes(db: DatabaseAdapter) {
  const router = new H3();

  router.get(
    PUBLIC_SCHEMAS_BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      try {
        const rows = (await db.catalog.listSchemas(workspace)) as EntitySchema[];
        return rows.map(toDiagramCraftSchema);
      } catch (e) {
        handleError(e, 'Failed to retrieve public schemas');
      }
    })
  );

  router.get(
    PUBLIC_DATA_BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      try {
        const rows = (await db.catalog.listEntities(workspace)) as Entity[];
        return rows.map(toDiagramCraftData);
      } catch (e) {
        handleError(e, 'Failed to retrieve public data');
      }
    })
  );

  return router;
}
