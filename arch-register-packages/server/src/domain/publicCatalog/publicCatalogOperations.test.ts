import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import {
  getPublicCatalogConfig,
  getPublicCatalogEntity,
  getPublicCatalogManifest,
  getPublicCatalogTopology,
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
    },
    relation: {
      listRelations: vi.fn(async () => ({ items: [], total: 0 }))
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
    expect(result.endpoints.topology).toContain('/api/public/v1/workspace-slug/topology');
  });

  it('builds a bounded publication-safe topology in the requested direction', async () => {
    const source = {
      ...entity,
      id: 'entity-source',
      public_id: 'SVC-001',
      name: 'Catalog API',
      schema_id: 'schema-source',
      data: {
        dependencies: ['entity-target'],
        restrictedDependencies: ['entity-hidden'],
        typedLinks: []
      }
    };
    const target = {
      ...entity,
      id: 'entity-target',
      public_id: 'SVC-002',
      slug: 'payments-api',
      name: 'Payments API',
      schema_id: 'schema-target',
      data: { next: ['entity-hidden'] }
    };
    const hiddenTarget = {
      ...entity,
      id: 'entity-hidden',
      public_id: 'SVC-003',
      slug: 'internal-api',
      name: 'Internal API',
      schema_id: 'schema-target',
      data: { next: [] }
    };
    const sourceSchema = {
      ...schema,
      id: 'schema-source',
      name: 'Service',
      fields: [
        {
          id: 'dependencies',
          name: 'Dependencies',
          type: 'reference',
          predicate: 'depends on',
          schemaId: 'schema-target',
          minCount: 0,
          maxCount: -1
        },
        {
          id: 'restrictedDependencies',
          name: 'Restricted dependencies',
          type: 'reference',
          schemaId: 'schema-target',
          minCount: 0,
          maxCount: -1,
          groupId: 'restricted'
        },
        {
          id: 'typedLinks',
          name: 'Typed links',
          type: 'typedRelation',
          relationSchemaId: 'relation-schema-1',
          direction: 'out'
        }
      ]
    } as unknown as SchemaDbResult;
    const targetSchema = {
      ...schema,
      id: 'schema-target',
      name: 'System',
      key_prefix: 'SYS',
      fields: [
        {
          id: 'next',
          name: 'Next',
          type: 'reference',
          schemaId: 'schema-target',
          minCount: 0,
          maxCount: -1
        }
      ]
    } as unknown as SchemaDbResult;
    const db = makeDb({
      ...publicConfig,
      schemas: [
        {
          schemaId: 'schema-source',
          fieldIds: ['dependencies', 'restrictedDependencies', 'typedLinks']
        },
        { schemaId: 'schema-target', fieldIds: ['next'] }
      ]
    });
    db.catalog.listEntities = vi.fn(async () => [source, target, hiddenTarget]) as never;
    db.catalog.getSchema = vi.fn(async (_workspace, schemaId) => {
      if (schemaId === 'schema-source') return sourceSchema;
      if (schemaId === 'schema-target') return targetSchema;
      return null;
    }) as never;
    db.relation.listRelations = vi.fn(async () => ({
      items: [
        {
          id: 'relation-internal-1',
          workspace: 'workspace-1',
          schema_id: 'relation-schema-1',
          schema_name: 'Internal relation schema name',
          in_entity_id: target.id,
          in_entity_name: target.name,
          out_entity_id: source.id,
          out_entity_name: source.name,
          data: {},
          owner: null,
          owner_name: null,
          lifecycle: null,
          lifecycle_label: null,
          version: 1,
          approval_policy_override: null,
          created_at: now,
          updated_at: now
        }
      ],
      total: 1
    })) as never;

    const result = await getPublicCatalogTopology(db, 'workspace-slug', 'SVC-001', {
      depth: 2,
      direction: 'outgoing'
    });

    expect(result).toMatchObject({
      depth: 2,
      direction: 'outgoing',
      truncated: false,
      limits: { nodes: 200, edges: 500 }
    });
    expect(result.nodes.map(node => node.publicId)).toEqual(['SVC-001', 'SVC-002', 'SVC-003']);
    expect(result.edges).toEqual([
      {
        id: 'edge:reference:SVC-001:SVC-002:depends on',
        from: 'SVC-001',
        to: 'SVC-002',
        label: 'depends on',
        kind: 'reference'
      },
      {
        id: 'edge:typed:SVC-001:SVC-002:Typed links',
        from: 'SVC-001',
        to: 'SVC-002',
        label: 'Typed links',
        kind: 'typed'
      },
      {
        id: 'edge:reference:SVC-002:SVC-003:Next',
        from: 'SVC-002',
        to: 'SVC-003',
        label: 'Next',
        kind: 'reference'
      }
    ]);
    expect(JSON.stringify(result)).not.toContain('relation-internal-1');
    expect(JSON.stringify(result)).not.toContain('relation-schema-1');
    expect(JSON.stringify(result)).not.toContain('restrictedDependencies');

    const incoming = await getPublicCatalogTopology(db, 'workspace-slug', 'SVC-002', {
      depth: 1,
      direction: 'incoming'
    });
    expect(incoming.nodes.map(node => node.publicId)).toEqual(['SVC-002', 'SVC-001']);
    expect(incoming.edges.map(edge => edge.kind)).toEqual(['reference', 'typed']);
    expect(incoming.edges.every(edge => edge.from === 'SVC-001' && edge.to === 'SVC-002')).toBe(
      true
    );
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
