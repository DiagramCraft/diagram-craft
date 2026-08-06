import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TechnologyEolMapping } from '@arch-register/api-types/jobsContract';
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

const mapping: TechnologyEolMapping = {
  productFieldId: 'provider',
  cycleFieldId: 'cycle',
  latestVersionFieldId: 'latest',
  releaseDateFieldId: 'released',
  supportUntilFieldId: null,
  securityUntilFieldId: null,
  eolDateFieldId: 'eol',
  sourceUrlFieldId: null,
  synchronizedAtFieldId: null
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
  project_id: null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
  version: 1,
  approval_policy_override: null,
  owner_name: null,
  lifecycle_label: null,
  target_lifecycle_label: null,
  schema_name: schema.name,
  completeness: 0
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
        createEntityVersion: vi.fn(),
        pruneAutosaveVersions: vi.fn()
      },
      audit: { createAuditLog: vi.fn(async input => ({ id: 'audit-1', ...input })) },
      watch: { createNotificationsFromAudit: vi.fn() }
    } as unknown as DatabaseAdapter;

    const result = await createTechnologyEolJobHandler(db)({
      jobId: 'run-1',
      workspace: 'workspace-1',
      payload: {
        schemaId: schema.id,
        mapping
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

  it.each([
    ['product', 'provider'],
    ['cycle', 'cycle']
  ])(
    'does not load entities or call external services when the %s input becomes protected',
    async (_label, fieldId) => {
      const currentSchema: SchemaDbResult = {
        ...schema,
        fields: schema.fields.map(field =>
          field.id === fieldId ? { ...field, groupId: 'restricted' } : field
        ),
        groups: [
          {
            id: 'restricted',
            name: 'Restricted',
            accessControl: { teamIds: ['security'] }
          }
        ]
      };
      const fetch = vi.fn();
      const listEntitiesPaginated = vi.fn();
      const updateEntity = vi.fn();
      vi.stubGlobal('fetch', fetch);

      const db = {
        catalog: {
          getSchema: vi.fn(async () => currentSchema),
          listEntitiesPaginated,
          updateEntity,
          createEntityVersion: vi.fn(),
          pruneAutosaveVersions: vi.fn()
        },
        audit: { createAuditLog: vi.fn() },
        watch: { createNotificationsFromAudit: vi.fn() }
      } as unknown as DatabaseAdapter;

      await expect(
        createTechnologyEolJobHandler(db)({
          jobId: 'run-protected',
          workspace: schema.workspace,
          payload: { schemaId: schema.id, mapping },
          signal: new AbortController().signal
        })
      ).rejects.toThrow(/access-controlled field group/);

      expect(listEntitiesPaginated).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
      expect(updateEntity).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['missing schema', null, mapping, /Target schema not found/],
    [
      'missing input field',
      { ...schema, fields: schema.fields.filter(field => field.id !== 'provider') },
      mapping,
      /Input field 'provider' was not found/
    ],
    [
      'stale input group',
      {
        ...schema,
        fields: schema.fields.map(field =>
          field.id === 'provider' ? { ...field, groupId: 'deleted-group' } : field
        ),
        groups: []
      },
      mapping,
      /access-controlled field group/
    ],
    [
      'missing destination field',
      schema,
      { ...mapping, eolDateFieldId: 'deleted' },
      /Destination field/
    ],
    [
      'duplicate destination fields',
      schema,
      { ...mapping, eolDateFieldId: 'latest' },
      /destination field can only be mapped once/
    ]
  ])(
    'fails closed for %s before loading entities',
    async (_label, currentSchema, jobMapping, error) => {
      const listEntitiesPaginated = vi.fn();
      const db = {
        catalog: {
          getSchema: vi.fn(async () => currentSchema),
          listEntitiesPaginated,
          updateEntity: vi.fn(),
          createEntityVersion: vi.fn(),
          pruneAutosaveVersions: vi.fn()
        },
        audit: { createAuditLog: vi.fn() },
        watch: { createNotificationsFromAudit: vi.fn() }
      } as unknown as DatabaseAdapter;

      await expect(
        createTechnologyEolJobHandler(db)({
          jobId: 'run-invalid',
          workspace: schema.workspace,
          payload: { schemaId: schema.id, mapping: jobMapping },
          signal: new AbortController().signal
        })
      ).rejects.toThrow(error);

      expect(listEntitiesPaginated).not.toHaveBeenCalled();
    }
  );

  it('rejects an incomplete stored mapping before loading entities', async () => {
    const listEntitiesPaginated = vi.fn();
    const db = {
      catalog: {
        getSchema: vi.fn(async () => schema),
        listEntitiesPaginated,
        updateEntity: vi.fn(),
        createEntityVersion: vi.fn(),
        pruneAutosaveVersions: vi.fn()
      },
      audit: { createAuditLog: vi.fn() },
      watch: { createNotificationsFromAudit: vi.fn() }
    } as unknown as DatabaseAdapter;

    await expect(
      createTechnologyEolJobHandler(db)({
        jobId: 'run-malformed',
        workspace: schema.workspace,
        payload: {
          schemaId: schema.id,
          mapping: { ...mapping, eolDateFieldId: undefined }
        },
        signal: new AbortController().signal
      })
    ).rejects.toThrow('invalid payload');

    expect(listEntitiesPaginated).not.toHaveBeenCalled();
  });
});
