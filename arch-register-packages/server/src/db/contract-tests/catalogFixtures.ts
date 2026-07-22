import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../database';
import type { EntityDbCreate } from '../../domain/catalog/db/catalogDatabase';

export const createFixtureCatalogEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  schemaId: string,
  overrides: Partial<EntityDbCreate> = {}
) => {
  const id = overrides.id ?? randomUUID();
  const now = new Date();
  return db.catalog.createEntity({
    id,
    workspace,
    public_id: overrides.public_id ?? `PUB-${id}`,
    slug: overrides.slug ?? id,
    namespace: overrides.namespace ?? 'default',
    name: overrides.name ?? `Entity ${id}`,
    description: overrides.description ?? '',
    owner: overrides.owner ?? null,
    lifecycle: overrides.lifecycle ?? null,
    target_lifecycle: overrides.target_lifecycle ?? null,
    target_lifecycle_date: overrides.target_lifecycle_date ?? null,
    tags: overrides.tags ?? [],
    links: overrides.links ?? [],
    schema_id: schemaId,
    data: overrides.data ?? {},
    project_id: overrides.project_id ?? null,
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now
  });
};
