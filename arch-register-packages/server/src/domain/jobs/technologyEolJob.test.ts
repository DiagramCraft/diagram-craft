import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import { createTechnologyEolJobHandler } from './technologyEolJob';

const schema: SchemaDbResult = {
  id: 'schema-1',
  workspace: 'workspace-1',
  name: 'Technology Release',
  description: '',
  key_prefix: 'TEC',
  fields: [
    { id: 'provider', name: 'Provider', type: 'text' as const },
    { id: 'cycle', name: 'Cycle', type: 'text' as const },
    { id: 'latest', name: 'Latest', type: 'text' as const, external_kind: 'integration' as const },
    {
      id: 'released',
      name: 'Released',
      type: 'date' as const,
      external_kind: 'integration' as const
    },
    { id: 'eol', name: 'EOL', type: 'date' as const, external_kind: 'integration' as const }
  ],
  templates: [],
  color: null,
  icon: null,
  default_owner: null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z')
};

const entity: EntityDbResult = {
  id: 'entity-1',
  workspace: 'workspace-1',
  public_id: 'TEC-1',
  slug: 'nodejs-20',
  namespace: 'default',
  name: 'Node.js 20',
  description: '',
  owner: null,
  lifecycle: null,
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: [],
  links: [],
  schema_id: schema.id,
  data: { provider: 'nodejs', cycle: '20' },
  generated_metadata: {},
  visibility_mode: null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
  version: 1,
  approval_policy_override: null,
  owner_name: null,
  lifecycle_label: null,
  target_lifecycle_label: null,
  schema_name: schema.name
};

afterEach(() => vi.unstubAllGlobals());

describe('technology EOL job', () => {
  it('maps provider values through the external entity update path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              schema_version: '1.2.1',
              result: {
                name: '20',
                releaseDate: '2023-04-18',
                latest: { name: '20.20.2' },
                eoasFrom: '2024-10-22',
                eolFrom: '2026-04-30'
              }
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
      )
    );

    let updatedEntity = entity;
    const db = {
      core: { isTransaction: true },
      catalog: {
        getSchema: vi.fn(async () => schema),
        listEntitiesPaginated: vi.fn().mockResolvedValueOnce([entity]).mockResolvedValueOnce([]),
        updateEntity: vi.fn(async (_workspace, _id, input) => {
          updatedEntity = { ...updatedEntity, ...input };
          return updatedEntity;
        }),
        createSnapshot: vi.fn(),
        pruneAutosaveSnapshots: vi.fn()
      },
      audit: { createAuditLog: vi.fn(async input => ({ id: 'audit-1', ...input })) },
      watch: { createNotificationsFromAudit: vi.fn() }
    } as unknown as DatabaseAdapter;

    const result = await createTechnologyEolJobHandler(db)({
      jobId: 'run-1',
      workspace: 'workspace-1',
      payload: {
        schemaId: schema.id,
        mapping: {
          productFieldId: 'provider',
          cycleFieldId: 'cycle',
          latestVersionFieldId: 'latest',
          releaseDateFieldId: 'released',
          supportUntilFieldId: null,
          securityUntilFieldId: null,
          eolDateFieldId: 'eol',
          sourceUrlFieldId: null,
          synchronizedAtFieldId: null
        }
      },
      signal: new AbortController().signal
    });

    expect(result).toMatchObject({ processed: 1, updated: 1, failed: 0, skipped: 0 });
    expect(updatedEntity.data).toMatchObject({
      provider: 'nodejs',
      cycle: '20',
      latest: '20.20.2',
      released: '2023-04-18',
      eol: '2026-04-30'
    });
    expect(updatedEntity.generated_metadata?.latest).toMatchObject({
      external_kind: 'integration',
      status: 'success',
      source: 'endoflife.date',
      requestId: 'run-1'
    });
  });
});
