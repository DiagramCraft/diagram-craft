import { H3, defineHandler } from 'h3';
import sql from '../db/client.js';
import type { Entity, EntitySchema } from '../types.js';
import { resolveWorkspace } from './workspace-resolver.js';
import { handlePgError } from '../utils/http.js';
import { toDiagramCraftData, toDiagramCraftSchema } from './public-shape.js';

const PUBLIC_SCHEMAS_BASE = '/api/public/:workspace/schemas';
const PUBLIC_DATA_BASE = '/api/public/:workspace/data';

const handleError = (error: unknown, fallback: string): never => handlePgError(error, fallback);

export function createPublicRoutes() {
  const router = new H3();

  router.get(
    PUBLIC_SCHEMAS_BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event);
      try {
        const rows = await sql<EntitySchema[]>`
          SELECT *
          FROM entity_schema
          WHERE workspace = ${workspace}
          ORDER BY name
        `;
        return rows.map(toDiagramCraftSchema);
      } catch (e) {
        handleError(e, 'Failed to retrieve public schemas');
      }
    })
  );

  router.get(
    PUBLIC_DATA_BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event);
      try {
        const rows = await sql<Entity[]>`
          SELECT *
          FROM entity
          WHERE workspace = ${workspace}
          ORDER BY name
        `;
        return rows.map(toDiagramCraftData);
      } catch (e) {
        handleError(e, 'Failed to retrieve public data');
      }
    })
  );

  return router;
}
