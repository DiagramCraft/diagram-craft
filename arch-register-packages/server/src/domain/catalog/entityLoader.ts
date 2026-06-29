import type { DatabaseAdapter } from '../../db/database';
import { ENTITY_DEFAULTS } from '../../constants';
import type { EntityDbResult, EntityListDbFilters } from './db/catalogDatabase';

export const listAllCatalogEntities = async (
  db: DatabaseAdapter,
  workspace: string,
  filters?: EntityListDbFilters
): Promise<EntityDbResult[]> => {
  const rows: EntityDbResult[] = [];
  const pageSize = ENTITY_DEFAULTS.PAGE_SIZE;
  let offset = 0;

  while (true) {
    const page = await db.catalog.listEntitiesPaginated(workspace, filters, {
      limit: pageSize,
      offset
    });
    if (page.length === 0) break;
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
};
