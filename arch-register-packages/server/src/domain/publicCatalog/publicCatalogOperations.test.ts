import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import {
  getPublicCatalogConfig,
  getPublicCatalogEntity,
  getPublicCatalogManifest,
  getPublicCatalogWikiPage
} from './publicCatalogOperations';

const now = new Date('2026-08-11T10:00:00.000Z');

const entity: EntityDbResult = {
  id: 'entity-1',
  workspace: 'workspace-1',
  public_id: 'SVC-001',
  slug: 'catalog-api',
  namespace: 'default',
  name: 'Catalog API',
  description: 'A public service',
  owner: null,
  lifecycle: 'active',
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: ['public'],
  links: [],
  schema_id: 'schema-1',
  data: { summary: 'safe', secret: 'must-not-leak' },
  project_id: null,
  created_at: now,
  updated_at: now,
  owner_name: null,
  lifecycle_label: 'Active',
  target_lifecycle_label: null,
  schema_name: 'Service',
  completeness: 100
};

const schema = {
  id: 'schema-1',
  workspace: 'workspace-1',
  name: 'Service',
  description: 'Published services',
  key_prefix: 'SVC',
  fields: [
    { id: 'summary', name: 'Summary', type: 'text', requirementLevel: 'optional' },
    {
      id: 'secret',
      name: 'Secret',
      type: 'text',
      requirementLevel: 'optional',
      groupId: 'restricted'
    }
  ],
  groups: [{ id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-1'] } }],
  color: null,
  icon: null,
  default_owner: null,
  created_at: now,
  updated_at: now
} as unknown as SchemaDbResult;

const publicConfig = {
  enabled: true,
  indexable: false,
  schemas: [{ schemaId: 'schema-1', fieldIds: ['summary', 'secret'] }],
  entityOverrides: [],
  pages: [],
  apiArtifacts: []
};

const makeDb = (storedConfig: Record<string, unknown> | null = publicConfig) =>
  ({
    publicCatalog: {
      getConfig: vi.fn(async () =>
        storedConfig == null
          ? null
          : { config: storedConfig, enabled: storedConfig.enabled as boolean, updated_at: now }
      )
    },
    catalog: {
      resolveWorkspaceSlug: vi.fn(async () => 'workspace-1'),
      listEntities: vi.fn(async () => [entity]),
      getEntity: vi.fn(async () => entity),
      getSchema: vi.fn(async () => schema)
    },
    project: {
      getAnyContentNodeById: vi.fn(async () => null)
    },
    artifact: {
      getArtifact: vi.fn(async () => null)
    },
    artifactProjections: {
      apiSpecification: {
        getRevision: vi.fn(async () => null)
      }
    }
  }) as unknown as DatabaseAdapter;

describe('public catalog publication', () => {
  it('defaults to disabled when no publication row exists', async () => {
    const result = await getPublicCatalogConfig(makeDb(null), 'workspace-1');
    expect(result.config.enabled).toBe(false);
    expect(result.config.schemas).toEqual([]);
  });

  it('redacts restricted fields even when an administrator selected them', async () => {
    const result = await getPublicCatalogEntity(makeDb(), 'workspace-slug', 'SVC-001');
    expect(result.fields).toEqual({ summary: 'safe' });
    expect(result.fields).not.toHaveProperty('secret');
  });

  it('uses public entity names for reference values and returns field labels', async () => {
    const source = {
      ...entity,
      data: { ...entity.data, dependencies: ['entity-2'] }
    };
    const target = {
      ...entity,
      id: 'entity-2',
      public_id: 'SVC-002',
      slug: 'payments-api',
      name: 'Payments API',
      data: { summary: 'payments' }
    };
    const referenceSchema = {
      ...schema,
      fields: [
        ...schema.fields,
        {
          id: 'dependencies',
          name: 'Dependencies',
          type: 'reference',
          schemaId: 'schema-1',
          minCount: 0,
          maxCount: -1
        }
      ]
    } as unknown as SchemaDbResult;
    const db = makeDb({
      ...publicConfig,
      schemas: [{ schemaId: 'schema-1', fieldIds: ['summary', 'dependencies'] }]
    });
    db.catalog.listEntities = vi.fn(async () => [source, target]) as never;
    db.catalog.getEntity = vi.fn(async (_workspace, id) => {
      if (id === 'SVC-001' || id === 'entity-1') return source;
      if (id === 'SVC-002' || id === 'entity-2') return target;
      return null;
    }) as never;
    db.catalog.getSchema = vi.fn(async () => referenceSchema) as never;

    const result = await getPublicCatalogEntity(db, 'workspace-slug', 'SVC-001');

    expect(result.schema.fields).toContainEqual({
      id: 'dependencies',
      name: 'Dependencies',
      type: 'reference'
    });
    expect(result.fields).toMatchObject({ dependencies: ['Payments API'] });
  });

  it('keeps the manifest deterministic and reports only public entities', async () => {
    const result = await getPublicCatalogManifest(makeDb(), 'workspace-slug');
    expect(result).toMatchObject({
      workspace: 'workspace-slug',
      entityCount: 1,
      indexable: false,
      schemas: [{ id: 'schema-1', fields: [{ id: 'summary' }] }]
    });
    expect(result.pages).toEqual([]);
    expect(result.endpoints.entities).toContain('/api/public/v1/workspace-slug/entities');
  });

  it('returns 404 for a disabled catalog', async () => {
    await expect(
      getPublicCatalogManifest(
        makeDb({ enabled: false, schemas: [], entityOverrides: [], pages: [], apiArtifacts: [] }),
        'workspace-slug'
      )
    ).rejects.toMatchObject({ status: 404 });
  });

  it('only serves configured non-project Markdown and strips unsafe markup', async () => {
    const db = makeDb({
      ...publicConfig,
      pages: [
        {
          nodeId: 'node-1',
          scope: 'workspace',
          publicPath: 'guide',
          order: 0
        }
      ]
    });
    db.project.getAnyContentNodeById = vi.fn(async () => ({
      id: 'node-1',
      workspace: 'workspace-1',
      project_id: null,
      entity_id: null,
      type: 'markdown',
      path: 'guide.md',
      name: 'Guide',
      updated_at: now
    })) as never;
    const storage = {
      read: vi.fn(async () =>
        Buffer.from('# Hello <script>alert(1)</script>\n[bad](javascript:alert(1))')
      )
    };

    const result = await getPublicCatalogWikiPage(db, storage as never, 'workspace-slug', 'guide');
    expect(result.body).toBe('# Hello alert(1)\n[bad]');
  });

  it('does not let a workspace page target an entity node', async () => {
    const db = makeDb({
      ...publicConfig,
      pages: [{ nodeId: 'node-1', scope: 'workspace', publicPath: 'guide', order: 0 }]
    });
    db.project.getAnyContentNodeById = vi.fn(async () => ({
      id: 'node-1',
      workspace: 'workspace-1',
      project_id: null,
      entity_id: 'entity-1',
      type: 'markdown',
      path: 'guide.md',
      name: 'Guide',
      updated_at: now
    })) as never;

    await expect(
      getPublicCatalogWikiPage(db, { read: vi.fn() } as never, 'workspace-slug', 'guide')
    ).rejects.toMatchObject({ status: 404 });
  });
});
