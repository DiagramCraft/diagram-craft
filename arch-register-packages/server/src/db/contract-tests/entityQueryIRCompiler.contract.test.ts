import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFixtureWorkspace, createFixtureProject } from './projectFixtures';
import { createFixtureCatalogEntity } from './catalogFixtures';
import { createFixtureUser } from './authFixtures';
import type { DatabaseAdapter, DbDriver } from '../database';
import type { SchemaDbResult } from '../../domain/catalog/db/catalogDatabase';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import {
  compileEntityQueryIR,
  type CompiledEntityQueryOptions
} from '../../domain/catalog/entityQueryIRCompiler';
import {
  validateEntityQueryIR,
  type SchemaCatalog
} from '../../domain/catalog/entityQueryIRValidator';
import { filterConditionsToEntityQueryIR } from '../../domain/catalog/entityQueryIRMapping';
import { matchesFilterCondition } from '../../domain/catalog/dataHelpers';
import type { FilterCondition } from '@arch-register/api-types/viewContract';

const createSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  overrides: Partial<SchemaDbResult> & { name: string }
): Promise<SchemaDbResult> => {
  const id = overrides.id ?? randomUUID();
  const now = new Date();
  return db.catalog.createSchema({
    id,
    workspace,
    name: overrides.name,
    description: '',
    fields: overrides.fields ?? [],
    color: null,
    icon: null,
    default_owner: null,
    key_prefix: id.slice(0, 8).toUpperCase(),
    created_at: now,
    updated_at: now
  });
};

const runQuery = async (
  db: DatabaseAdapter,
  driver: DbDriver,
  workspace: string,
  schemas: SchemaCatalog,
  query: EntityQuery,
  options?: CompiledEntityQueryOptions
) => {
  const validation = validateEntityQueryIR(query, schemas);
  expect(validation.ok, JSON.stringify(validation)).toBe(true);
  const { sql, params } = compileEntityQueryIR(query, schemas, driver, workspace, options);
  return db.catalog.runCompiledEntityQuery(sql, params);
};

runContractSuiteAgainstBothDrivers('entityQueryIRCompiler', (getDb, driver) => {
  it('resolves a forward single-hop reference predicate', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);

    const techReleaseSchema = await createSchema(db, workspace, {
      name: 'Technology Release',
      fields: [{ id: 'eol_date', name: 'EOL Date', type: 'date' }]
    });
    const componentSchema = await createSchema(db, workspace, {
      name: 'Component',
      fields: [
        {
          id: 'technology_releases',
          name: 'Technology Releases',
          type: 'reference',
          schemaId: techReleaseSchema.id,
          minCount: 0,
          maxCount: -1
        }
      ]
    });

    const relEol = await createFixtureCatalogEntity(db, workspace, techReleaseSchema.id, {
      data: { eol_date: '2026-01-01' }
    });
    const relFresh = await createFixtureCatalogEntity(db, workspace, techReleaseSchema.id, {
      data: { eol_date: '2030-01-01' }
    });
    const componentAtRisk = await createFixtureCatalogEntity(db, workspace, componentSchema.id, {
      data: { technology_releases: [relEol.id] }
    });
    await createFixtureCatalogEntity(db, workspace, componentSchema.id, {
      data: { technology_releases: [relFresh.id] }
    });

    const schemas: SchemaCatalog = new Map([
      [componentSchema.id, componentSchema],
      [techReleaseSchema.id, techReleaseSchema]
    ]);

    const query: EntityQuery = {
      schemaId: componentSchema.id,
      root: {
        kind: 'predicate',
        path: [{ kind: 'forward', fieldId: 'technology_releases' }],
        fieldId: 'eol_date',
        op: 'before',
        value: '2026-06-30'
      }
    };

    const matches = await runQuery(db, driver, workspace, schemas, query);
    expect(matches.map(e => e.id)).toEqual([componentAtRisk.id]);
  });

  it('resolves a backward single-hop with an explicit ownerSchemaId', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);

    const domainSchema = await createSchema(db, workspace, { name: 'Domain' });
    const systemSchema = await createSchema(db, workspace, {
      name: 'System',
      fields: [
        {
          id: 'domain',
          name: 'Domain',
          type: 'containment',
          schemaId: domainSchema.id,
          minCount: 0,
          maxCount: 1
        }
      ]
    });

    const domainMatch = await createFixtureCatalogEntity(db, workspace, domainSchema.id);
    await createFixtureCatalogEntity(db, workspace, domainSchema.id);
    const systemMatch = await createFixtureCatalogEntity(db, workspace, systemSchema.id, {
      data: { domain: [domainMatch.id] }
    });

    const schemas: SchemaCatalog = new Map([
      [domainSchema.id, domainSchema],
      [systemSchema.id, systemSchema]
    ]);

    const query: EntityQuery = {
      schemaId: domainSchema.id,
      root: {
        kind: 'predicate',
        path: [{ kind: 'backward', fieldId: 'domain', ownerSchemaId: systemSchema.id }],
        fieldId: '_id',
        op: 'equals',
        value: systemMatch.id
      }
    };

    const matches = await runQuery(db, driver, workspace, schemas, query);
    expect(matches.map(e => e.id)).toEqual([domainMatch.id]);
  });

  it('scopes a bracketed filter to the same existential witness (§4.3)', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);

    const technologySchema = await createSchema(db, workspace, { name: 'Technology' });
    const techReleaseSchema = await createSchema(db, workspace, {
      name: 'Technology Release',
      fields: [
        { id: 'release_cycle', name: 'Release Cycle', type: 'text' },
        {
          id: 'technology',
          name: 'Technology',
          type: 'containment',
          schemaId: technologySchema.id,
          minCount: 1,
          maxCount: 1
        }
      ]
    });
    const componentSchema = await createSchema(db, workspace, {
      name: 'Component',
      fields: [
        {
          id: 'technology_releases',
          name: 'Technology Releases',
          type: 'reference',
          schemaId: techReleaseSchema.id,
          minCount: 0,
          maxCount: -1
        }
      ]
    });

    const go = await createFixtureCatalogEntity(db, workspace, technologySchema.id, { slug: 'go' });
    const python = await createFixtureCatalogEntity(db, workspace, technologySchema.id, {
      slug: 'python'
    });

    // A single release satisfying both conditions at once.
    const relGoOld = await createFixtureCatalogEntity(db, workspace, techReleaseSchema.id, {
      data: { release_cycle: '1.5', technology: [go.id] }
    });
    // Two releases that each satisfy exactly one condition, on different technologies.
    const relGoNew = await createFixtureCatalogEntity(db, workspace, techReleaseSchema.id, {
      data: { release_cycle: '4.0', technology: [go.id] }
    });
    const relPythonOld = await createFixtureCatalogEntity(db, workspace, techReleaseSchema.id, {
      data: { release_cycle: '1.0', technology: [python.id] }
    });

    const singleWitnessComponent = await createFixtureCatalogEntity(
      db,
      workspace,
      componentSchema.id,
      {
        data: { technology_releases: [relGoOld.id] }
      }
    );
    const splitWitnessComponent = await createFixtureCatalogEntity(
      db,
      workspace,
      componentSchema.id,
      {
        data: { technology_releases: [relGoNew.id, relPythonOld.id] }
      }
    );

    const schemas: SchemaCatalog = new Map([
      [technologySchema.id, technologySchema],
      [techReleaseSchema.id, techReleaseSchema],
      [componentSchema.id, componentSchema]
    ]);

    const independentQuery: EntityQuery = {
      schemaId: componentSchema.id,
      root: {
        kind: 'and',
        children: [
          {
            kind: 'predicate',
            path: [{ kind: 'forward', fieldId: 'technology_releases' }],
            fieldId: 'release_cycle',
            op: 'lt',
            value: 2
          },
          {
            kind: 'predicate',
            path: [
              { kind: 'forward', fieldId: 'technology_releases' },
              { kind: 'forward', fieldId: 'technology' }
            ],
            fieldId: '_slug',
            op: 'equals',
            value: 'go'
          }
        ]
      }
    };
    const independentMatches = await runQuery(db, driver, workspace, schemas, independentQuery);
    expect(new Set(independentMatches.map(e => e.id))).toEqual(
      new Set([singleWitnessComponent.id, splitWitnessComponent.id])
    );

    const scopedQuery: EntityQuery = {
      schemaId: componentSchema.id,
      root: {
        kind: 'relationExists',
        path: [
          {
            kind: 'forward',
            fieldId: 'technology_releases',
            filter: {
              kind: 'and',
              children: [
                {
                  kind: 'predicate',
                  path: [],
                  fieldId: 'release_cycle',
                  op: 'lt',
                  value: 2
                },
                {
                  kind: 'predicate',
                  path: [{ kind: 'forward', fieldId: 'technology' }],
                  fieldId: '_slug',
                  op: 'equals',
                  value: 'go'
                }
              ]
            }
          }
        ]
      }
    };
    const scopedMatches = await runQuery(db, driver, workspace, schemas, scopedQuery);
    expect(scopedMatches.map(e => e.id)).toEqual([singleWitnessComponent.id]);
  });

  it('terminates a traversal branch that would otherwise exceed MAX_PATH_HOPS', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schema = await createSchema(db, workspace, { name: 'Lonely' });
    const schemas: SchemaCatalog = new Map([[schema.id, schema]]);

    const tooDeep: EntityQuery = {
      schemaId: schema.id,
      root: {
        kind: 'relationExists',
        path: Array.from({ length: 7 }, () => ({ kind: 'forward' as const, fieldId: 'self' }))
      }
    };

    const validation = validateEntityQueryIR(tooDeep, schemas);
    expect(validation.ok).toBe(false);
  });

  it("matches today's flat FilterCondition[] evaluation via the degenerate mapping", async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schema = await createSchema(db, workspace, {
      name: 'Technology',
      fields: [{ id: 'category', name: 'Category', type: 'text' }]
    });

    const matching = await createFixtureCatalogEntity(db, workspace, schema.id, {
      data: { category: 'framework' }
    });
    const other = await createFixtureCatalogEntity(db, workspace, schema.id, {
      data: { category: 'library' }
    });

    const schemas: SchemaCatalog = new Map([[schema.id, schema]]);
    const conditions: FilterCondition[] = [
      { fieldId: 'category', op: 'equals', value: 'framework' }
    ];

    const irQuery = filterConditionsToEntityQueryIR(schema.id, null, conditions);
    const irMatches = await runQuery(db, driver, workspace, schemas, irQuery);

    const flatMatches = [matching, other].filter(entity =>
      conditions.every(c => matchesFilterCondition(entity, c, null))
    );

    expect(new Set(irMatches.map(e => e.id))).toEqual(new Set(flatMatches.map(e => e.id)));
    expect(irMatches.map(e => e.id)).toEqual([matching.id]);
  });

  it('joins assessment_response for _assessment/_assessment:<fieldId> predicates', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const project = await createFixtureProject(db, workspace);
    const schema = await createSchema(db, workspace, {
      name: 'Technology',
      fields: [{ id: 'category', name: 'Category', type: 'text' }]
    });

    const highRisk = await createFixtureCatalogEntity(db, workspace, schema.id);
    const lowRisk = await createFixtureCatalogEntity(db, workspace, schema.id);
    const noResponse = await createFixtureCatalogEntity(db, workspace, schema.id);

    const assessment = await db.project.createAssessment({
      id: randomUUID(),
      workspace,
      project_id: project.id,
      name: 'Risk Assessment',
      description: '',
      status: 'open',
      scope: [schema.id],
      scope_conditions: [],
      fields: [
        { id: 'riskLevel', label: 'Risk Level', requirementLevel: 'required', type: 'rating' }
      ],
      created_at: new Date(),
      updated_at: new Date()
    });

    await db.project.upsertAssessmentResponse({
      workspace,
      assessment_id: assessment.id,
      entity_id: highRisk.id,
      values: { riskLevel: 4 },
      updated_by: null
    });
    await db.project.upsertAssessmentResponse({
      workspace,
      assessment_id: assessment.id,
      entity_id: lowRisk.id,
      values: { riskLevel: 1 },
      updated_by: null
    });

    const schemas: SchemaCatalog = new Map([[schema.id, schema]]);

    const presenceQuery: EntityQuery = {
      schemaId: schema.id,
      assessmentId: assessment.id,
      root: { kind: 'predicate', path: [], fieldId: '_assessment', op: 'not_empty', value: null }
    };
    const presenceMatches = await runQuery(db, driver, workspace, schemas, presenceQuery);
    expect(new Set(presenceMatches.map(e => e.id))).toEqual(new Set([highRisk.id, lowRisk.id]));
    expect(presenceMatches.some(e => e.id === noResponse.id)).toBe(false);

    const fieldQuery: EntityQuery = {
      schemaId: schema.id,
      assessmentId: assessment.id,
      root: {
        kind: 'predicate',
        path: [],
        fieldId: '_assessment:riskLevel',
        op: 'gt',
        value: 2
      }
    };
    const fieldMatches = await runQuery(db, driver, workspace, schemas, fieldQuery);
    expect(fieldMatches.map(e => e.id)).toEqual([highRisk.id]);
  });

  it('applies live project scope inside the compiler CTE', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const project = await createFixtureProject(db, workspace);
    const schema = await createSchema(db, workspace, { name: 'Technology' });
    const globalEntity = await createFixtureCatalogEntity(db, workspace, schema.id);
    const projectEntity = await createFixtureCatalogEntity(db, workspace, schema.id, {
      project_id: project.id
    });
    const otherProject = await createFixtureProject(db, workspace);
    const otherProjectEntity = await createFixtureCatalogEntity(db, workspace, schema.id, {
      project_id: otherProject.id
    });
    const schemas: SchemaCatalog = new Map([[schema.id, schema]]);
    const query: EntityQuery = {
      projectId: project.id,
      projectScope: 'project',
      schemaId: schema.id,
      root: { kind: 'predicate', path: [], fieldId: '_id', op: 'not_empty', value: null }
    };

    const matches = await runQuery(db, driver, workspace, schemas, query);
    expect(matches.map(entity => entity.id)).toEqual(
      expect.arrayContaining([globalEntity.id, projectEntity.id])
    );
    expect(matches.map(entity => entity.id)).not.toContain(otherProjectEntity.id);
  });

  it('reconstructs historical state from entity_version in SQL', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schema = await createSchema(db, workspace, {
      name: 'Technology',
      fields: [{ id: 'category', name: 'Category', type: 'text' }]
    });
    const entity = await createFixtureCatalogEntity(db, workspace, schema.id, {
      name: 'Live name'
    });
    const historicalDate = new Date('2026-01-02T00:00:00.000Z');
    await db.catalog.createEntityVersion({
      id: randomUUID(),
      workspace,
      entity_id: entity.id,
      version_number: 1,
      kind: 'autosave',
      commit_message: null,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      created_by: null,
      state: {
        id: entity.id,
        public_id: entity.public_id,
        slug: entity.slug,
        namespace: entity.namespace,
        name: 'Historical name',
        description: entity.description,
        schema_id: schema.id,
        data: { category: 'historical' },
        tags: [],
        links: [],
        project_id: null,
        version: 1,
        created_at: entity.created_at.toISOString(),
        updated_at: historicalDate.toISOString()
      },
      applied_case_revision_id: null
    });
    const schemas: SchemaCatalog = new Map([[schema.id, schema]]);
    const query: EntityQuery = {
      asOf: historicalDate.toISOString(),
      schemaId: schema.id,
      root: {
        kind: 'predicate',
        path: [],
        fieldId: 'category',
        op: 'equals',
        value: 'historical'
      }
    };

    const matches = await runQuery(db, driver, workspace, schemas, query);
    expect(matches.map(result => result.name)).toEqual(['Historical name']);
  });

  it('uses the live row as an SQL baseline when no entity version exists', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schema = await createSchema(db, workspace, { name: 'Technology' });
    const entity = await createFixtureCatalogEntity(db, workspace, schema.id);
    const schemas: SchemaCatalog = new Map([[schema.id, schema]]);
    const query: EntityQuery = {
      asOf: '2030-01-01T00:00:00.000Z',
      schemaId: schema.id,
      root: { kind: 'predicate', path: [], fieldId: '_id', op: 'equals', value: entity.id }
    };

    const matches = await runQuery(db, driver, workspace, schemas, query);
    expect(matches.map(result => result.id)).toEqual([entity.id]);
  });

  it('applies active future changes and respects project case scope', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const project = await createFixtureProject(db, workspace);
    const user = await createFixtureUser(db);
    const schema = await createSchema(db, workspace, { name: 'Technology' });
    const entity = await createFixtureCatalogEntity(db, workspace, schema.id, {
      name: 'Current name'
    });
    await db.catalog.createEntityVersion({
      id: randomUUID(),
      workspace,
      entity_id: entity.id,
      version_number: 1,
      kind: 'autosave',
      commit_message: null,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      created_by: null,
      state: {
        id: entity.id,
        public_id: entity.public_id,
        slug: entity.slug,
        namespace: entity.namespace,
        name: entity.name,
        description: entity.description,
        schema_id: schema.id,
        data: {},
        tags: [],
        links: [],
        project_id: null,
        version: 1,
        created_at: entity.created_at.toISOString(),
        updated_at: entity.updated_at.toISOString()
      },
      applied_case_revision_id: null
    });
    await db.catalog.createSnapshot({
      id: randomUUID(),
      workspace,
      entity_id: entity.id,
      status: 'future_update',
      project_id: project.id,
      target_date: '2030-01-01',
      milestone_id: null,
      commit_message: 'planned rename',
      created_at: new Date('2026-01-02T00:00:00.000Z'),
      created_by: user.id,
      created_by_name: null,
      base_state: { name: entity.name },
      proposed_state: { name: 'Future name' }
    });
    const schemas: SchemaCatalog = new Map([[schema.id, schema]]);
    const query: EntityQuery = {
      asOf: '2030-02-01T00:00:00.000Z',
      projectId: project.id,
      projectScope: 'project',
      schemaId: schema.id,
      root: { kind: 'predicate', path: [], fieldId: '_name', op: 'equals', value: 'Future name' }
    };

    const matches = await runQuery(db, driver, workspace, schemas, query);
    expect(matches.map(result => result.id)).toEqual([entity.id]);
  });

  it('returns scalar projections and reuses the filtered relation path', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const releaseSchema = await createSchema(db, workspace, {
      name: 'Technology Release',
      fields: [
        { id: 'eol_date', name: 'EOL Date', type: 'date' },
        { id: 'latest_version', name: 'Latest Version', type: 'text' }
      ]
    });
    const componentSchema = await createSchema(db, workspace, {
      name: 'Component',
      fields: [
        {
          id: 'technology_releases',
          name: 'Technology Releases',
          type: 'reference',
          schemaId: releaseSchema.id,
          minCount: 0,
          maxCount: 1
        }
      ]
    });
    const release = await createFixtureCatalogEntity(db, workspace, releaseSchema.id, {
      data: { eol_date: '2026-01-01', latest_version: '1.2.3' }
    });
    const component = await createFixtureCatalogEntity(db, workspace, componentSchema.id, {
      data: { technology_releases: [release.id] }
    });
    const schemas: SchemaCatalog = new Map([
      [releaseSchema.id, releaseSchema],
      [componentSchema.id, componentSchema]
    ]);
    const query: EntityQuery = {
      schemaId: componentSchema.id,
      root: {
        kind: 'predicate',
        path: [{ kind: 'forward', fieldId: 'technology_releases' }],
        fieldId: 'eol_date',
        op: 'before',
        value: '2026-06-30'
      },
      projections: [
        {
          path: [{ kind: 'forward', fieldId: 'technology_releases' }],
          fieldId: 'eol_date',
          alias: 'eol'
        },
        {
          path: [{ kind: 'forward', fieldId: 'technology_releases' }],
          fieldId: 'latest_version'
        }
      ]
    };

    const matches = await runQuery(db, driver, workspace, schemas, query);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.id).toBe(component.id);
    expect(matches[0]!.projections).toEqual({
      eol: '2026-01-01',
      'technology_releases.latest_version': '1.2.3'
    });
  });

  it('aggregates multi-valued projections and hides invisible related entities', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const releaseSchema = await createSchema(db, workspace, {
      name: 'Technology Release',
      fields: [{ id: 'eol_date', name: 'EOL Date', type: 'date' }]
    });
    const componentSchema = await createSchema(db, workspace, {
      name: 'Component',
      fields: [
        {
          id: 'technology_releases',
          name: 'Technology Releases',
          type: 'reference',
          schemaId: releaseSchema.id,
          minCount: 0,
          maxCount: -1
        }
      ]
    });
    const first = await createFixtureCatalogEntity(db, workspace, releaseSchema.id, {
      data: { eol_date: '2026-01-01' }
    });
    const second = await createFixtureCatalogEntity(db, workspace, releaseSchema.id, {
      data: { eol_date: '2027-01-01' }
    });
    const component = await createFixtureCatalogEntity(db, workspace, componentSchema.id, {
      data: { technology_releases: [first.id, second.id] }
    });
    const schemas: SchemaCatalog = new Map([
      [releaseSchema.id, releaseSchema],
      [componentSchema.id, componentSchema]
    ]);
    const query: EntityQuery = {
      schemaId: componentSchema.id,
      root: { kind: 'predicate', path: [], fieldId: '_id', op: 'equals', value: component.id },
      projections: [
        {
          path: [{ kind: 'forward', fieldId: 'technology_releases' }],
          fieldId: 'eol_date'
        }
      ]
    };

    const matches = await runQuery(db, driver, workspace, schemas, query);
    expect(matches[0]!.projections['technology_releases.eol_date']).toEqual([
      '2026-01-01',
      '2027-01-01'
    ]);

    const hiddenMatches = await runQuery(db, driver, workspace, schemas, query, {
      visibleEntityIds: [component.id]
    });
    expect(hiddenMatches[0]!.projections['technology_releases.eol_date']).toEqual([]);
  });

  it('rejects projection reuse when independent multi-valued witnesses are ambiguous', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const releaseSchema = await createSchema(db, workspace, {
      name: 'Technology Release',
      fields: [
        { id: 'eol_date', name: 'EOL Date', type: 'date' },
        { id: 'release_cycle', name: 'Release Cycle', type: 'number' }
      ]
    });
    const componentSchema = await createSchema(db, workspace, {
      name: 'Component',
      fields: [
        {
          id: 'technology_releases',
          name: 'Technology Releases',
          type: 'reference',
          schemaId: releaseSchema.id,
          minCount: 0,
          maxCount: -1
        }
      ]
    });
    const schemas: SchemaCatalog = new Map([
      [releaseSchema.id, releaseSchema],
      [componentSchema.id, componentSchema]
    ]);
    const query: EntityQuery = {
      schemaId: componentSchema.id,
      root: {
        kind: 'and',
        children: [
          {
            kind: 'predicate',
            path: [{ kind: 'forward', fieldId: 'technology_releases' }],
            fieldId: 'eol_date',
            op: 'not_empty',
            value: null
          },
          {
            kind: 'predicate',
            path: [{ kind: 'forward', fieldId: 'technology_releases' }],
            fieldId: 'release_cycle',
            op: 'gt',
            value: 1
          }
        ]
      },
      projections: [
        {
          path: [{ kind: 'forward', fieldId: 'technology_releases' }],
          fieldId: 'eol_date'
        }
      ]
    };

    expect(() => compileEntityQueryIR(query, schemas, driver, workspace)).toThrow('ambiguous');
  });
});
