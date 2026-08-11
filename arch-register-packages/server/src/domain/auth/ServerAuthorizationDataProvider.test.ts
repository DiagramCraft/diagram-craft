import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import { ServerDataProvider } from './ServerAuthorizationDataProvider';

const now = new Date('2026-08-11T12:00:00.000Z');

const makeDatabase = () => {
  const entity = {
    id: 'entity-1',
    workspace: 'workspace-1',
    public_id: 'APP-1',
    slug: 'application',
    namespace: 'default',
    name: 'Application',
    description: 'An application',
    owner: 'team-1',
    lifecycle: 'active',
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['platform'],
    links: [],
    schema_id: 'schema-1',
    data: { criticality: 'high' },
    owner_name: 'Platform',
    lifecycle_label: 'Active',
    target_lifecycle_label: null,
    schema_name: 'Application',
    project_id: null,
    completeness: 100,
    created_at: now,
    updated_at: now
  };
  const schema = {
    id: 'schema-1',
    workspace: 'workspace-1',
    name: 'Application',
    description: '',
    fields: [],
    color: null,
    icon: null,
    default_owner: null,
    key_prefix: 'APP',
    created_at: now,
    updated_at: now
  };
  const grant = {
    id: 'grant-1',
    workspace: 'workspace-1',
    entity_id: 'entity-1',
    principal_type: 'team' as const,
    principal_id: 'team-1',
    role: 'editor' as const,
    applies_to: 'self' as const,
    created_at: now
  };

  return {
    entity,
    schema,
    grant,
    db: {
      catalog: {
        listEntitiesPaginated: vi.fn().mockResolvedValueOnce([entity]).mockResolvedValueOnce([]),
        listSchemas: vi.fn().mockResolvedValue([schema]),
        listEntityGrants: vi.fn().mockResolvedValue([grant])
      }
    } as unknown as DatabaseAdapter
  };
};

describe('ServerDataProvider', () => {
  it('maps database rows to the reduced permission DTOs', async () => {
    const { db, entity, schema, grant } = makeDatabase();
    const provider = new ServerDataProvider(db);

    await expect(provider.getEntities('workspace-1')).resolves.toEqual([
      {
        id: entity.id,
        workspace: entity.workspace,
        slug: entity.slug,
        namespace: entity.namespace,
        name: entity.name,
        description: entity.description,
        owner: entity.owner,
        lifecycle: entity.lifecycle,
        tags: entity.tags,
        links: entity.links,
        schema_id: entity.schema_id,
        data: entity.data,
        created_at: entity.created_at,
        updated_at: entity.updated_at
      }
    ]);
    await expect(provider.getSchemas('workspace-1')).resolves.toEqual([
      {
        id: schema.id,
        workspace: schema.workspace,
        name: schema.name,
        fields: schema.fields,
        color: schema.color,
        icon: schema.icon,
        default_owner: schema.default_owner,
        created_at: schema.created_at,
        updated_at: schema.updated_at
      }
    ]);
    await expect(provider.getEntityGrants('workspace-1')).resolves.toEqual([grant]);
  });
});
