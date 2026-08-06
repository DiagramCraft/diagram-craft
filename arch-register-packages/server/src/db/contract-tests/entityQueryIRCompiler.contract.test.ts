import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFixtureWorkspace, createFixtureProject } from './projectFixtures';
import { createFixtureCatalogEntity } from './catalogFixtures';
import { createFixtureUser } from './authFixtures';
import { buildAuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter, DbDriver } from '../database';
import type { SchemaDbResult } from '../../domain/catalog/db/catalogDatabase';
import type { RelationSchemaDbResult } from '../../domain/catalog/db/relationDatabase';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import {
  compileEntityQueryIR,
  compileEntityQueryCountIR,
  type CompiledEntityQueryOptions
} from '../../domain/catalog/entityQueryIRCompiler';
import {
  validateEntityQueryIR,
  type SchemaCatalog
} from '../../domain/catalog/entityQueryIRValidator';
import { filterConditionsToEntityQueryIR } from '../../domain/catalog/entityQueryIRMapping';
import { matchesFilterCondition } from '../../domain/catalog/dataHelpers';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import { countEntities, listEntitiesWithCount } from '../../domain/catalog/entityQueryOperations';
import { buildEntityQueryForExecution, parseEntityQuery } from '../../domain/catalog/entityQuery';

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
    groups: overrides.groups,
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
  it('matches root free-text across name, slug, and description', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schema = await createSchema(db, workspace, { name: 'Component' });

    const nameMatch = await createFixtureCatalogEntity(db, workspace, schema.id, {
      name: 'Platform Service'
    });
    const slugMatch = await createFixtureCatalogEntity(db, workspace, schema.id, {
      slug: 'platform-api'
    });
    const descriptionMatch = await createFixtureCatalogEntity(db, workspace, schema.id, {
      description: 'Owned by the platform team'
    });
    await createFixtureCatalogEntity(db, workspace, schema.id, {
      name: 'Unrelated Service',
      slug: 'unrelated'
    });

    const schemas: SchemaCatalog = new Map([[schema.id, schema]]);
    const query: EntityQuery = {
      schemaId: schema.id,
      root: { kind: 'freeText', value: 'PLATFORM' }
    };

    const matches = await runQuery(db, driver, workspace, schemas, query);
    expect(matches.map(entity => entity.id)).toEqual(
      expect.arrayContaining([nameMatch.id, slugMatch.id, descriptionMatch.id])
    );
    expect(matches).toHaveLength(3);
  });

  it('folds legacy q into the IR and filters in SQL, without a second in-memory pass', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schema = await createSchema(db, workspace, { name: 'Component' });

    const nameMatch = await createFixtureCatalogEntity(db, workspace, schema.id, {
      name: 'Platform Service'
    });
    await createFixtureCatalogEntity(db, workspace, schema.id, { name: 'Unrelated Service' });

    // Simulates the full HTTP request path (entityOrpc.ts): parse -> fold q into the IR root ->
    // execute. Exercises the fix for #2357, where `q` used to be applied as an always-on
    // in-memory post-filter after the SQL query ran, rather than folded into the query itself.
    const input = { _schemaId: schema.id, q: 'platform' };
    const parsed = parseEntityQuery(input);
    const entityQuery = buildEntityQueryForExecution(input, parsed);

    const page = await listEntitiesWithCount(db, workspace, null, {
      entityQuery,
      view: 'full',
      limit: null,
      offset: 0
    });

    expect(page.items.map(item => item._uid)).toEqual([nameMatch.id]);
    expect(page.total).toBe(1);
  });

  it('folds owner/lifecycle filters into the IR for auditOperations-style entity lookups', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schema = await createSchema(db, workspace, { name: 'Component' });
    const now = new Date();

    const [platformTeam, dataTeam] = await db.workspace.replaceTeams(workspace, [
      {
        id: randomUUID(),
        workspace,
        name: 'Platform',
        sort_order: 0,
        color: null,
        description: '',
        created_at: now
      },
      {
        id: randomUUID(),
        workspace,
        name: 'Data',
        sort_order: 1,
        color: null,
        description: '',
        created_at: now
      }
    ]);
    const [activeState, deprecatedState] = await db.workspace.replaceLifecycleStates(workspace, [
      {
        id: randomUUID(),
        workspace,
        label: 'Active',
        color: '#000000',
        sort_order: 0,
        created_at: now
      },
      {
        id: randomUUID(),
        workspace,
        label: 'Deprecated',
        color: '#000000',
        sort_order: 1,
        created_at: now
      }
    ]);

    const match = await createFixtureCatalogEntity(db, workspace, schema.id, {
      owner: platformTeam!.id,
      lifecycle: activeState!.id
    });
    await createFixtureCatalogEntity(db, workspace, schema.id, {
      owner: platformTeam!.id,
      lifecycle: deprecatedState!.id
    });
    await createFixtureCatalogEntity(db, workspace, schema.id, {
      owner: dataTeam!.id,
      lifecycle: activeState!.id
    });

    // Mirrors auditOperations.listAuditLog's entity-id resolution for the owner/lifecycle
    // filters (issue #2356): synthesize an entityQuery instead of passing schemaId/owner/
    // lifecycle straight through, so the lookup runs via the SQL IR path.
    const input = { _schemaId: schema.id, owner: platformTeam!.id, lifecycle: activeState!.id };
    const parsed = parseEntityQuery(input);
    const entityQuery = buildEntityQueryForExecution(input, parsed);

    const matches = await listEntitiesWithCount(db, workspace, null, {
      entityQuery,
      view: 'summary',
      limit: null,
      offset: 0
    });

    expect(matches.items.map(item => item._uid)).toEqual([match.id]);
    expect(matches.total).toBe(1);
  });

  it('folds a schemaId-only filter into the IR for schemaOperations-style entity counts', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const referencedSchema = await createSchema(db, workspace, { name: 'Referenced' });
    const unreferencedSchema = await createSchema(db, workspace, { name: 'Unreferenced' });

    await createFixtureCatalogEntity(db, workspace, referencedSchema.id);
    await createFixtureCatalogEntity(db, workspace, referencedSchema.id);

    // Mirrors schemaOperations.ts's countEntities({ schemaId }) call sites (issue #2356).
    const countFor = async (schemaId: string) => {
      const input = { _schemaId: schemaId };
      const parsed = parseEntityQuery(input);
      const entityQuery = buildEntityQueryForExecution(input, parsed);
      return countEntities(db, workspace, null, { entityQuery });
    };

    expect(await countFor(referencedSchema.id)).toBe(2);
    expect(await countFor(unreferencedSchema.id)).toBe(0);
  });

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

  it('matches the legacy evaluator for _completeness predicates mapped through the legacy path', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schema = await createSchema(db, workspace, { name: 'Technology' });

    const complete = await createFixtureCatalogEntity(db, workspace, schema.id, {
      completeness: 90
    });
    const incomplete = await createFixtureCatalogEntity(db, workspace, schema.id, {
      completeness: 30
    });

    const schemas: SchemaCatalog = new Map([[schema.id, schema]]);
    const conditions: FilterCondition[] = [{ fieldId: '_completeness', op: 'lt', value: 50 }];

    const irQuery = filterConditionsToEntityQueryIR(schema.id, null, conditions);
    const irMatches = await runQuery(db, driver, workspace, schemas, irQuery);

    const flatMatches = [complete, incomplete].filter(entity =>
      conditions.every(c => matchesFilterCondition(entity, c, entity.completeness))
    );

    expect(new Set(irMatches.map(e => e.id))).toEqual(new Set(flatMatches.map(e => e.id)));
    expect(irMatches.map(e => e.id)).toEqual([incomplete.id]);
  });

  it('compiles _assessment:<fieldId> conditions mapped through the legacy path to a matching SQL filter', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const project = await createFixtureProject(db, workspace);
    const schema = await createSchema(db, workspace, { name: 'Technology' });

    const highRisk = await createFixtureCatalogEntity(db, workspace, schema.id);
    const lowRisk = await createFixtureCatalogEntity(db, workspace, schema.id);

    const assessment = await db.project.createAssessment({
      id: randomUUID(),
      workspace,
      project_id: project.id,
      name: 'Risk Assessment',
      description: '',
      status: 'open',
      mode: 'fields',
      scope: [schema.id],
      scope_conditions: [],
      groups: [],
      assigned_team_ids: [],
      due_at: null,
      recurrence: { type: 'none' },
      response_window_days: null,
      current_occurrence: 1,
      pending_occurrence_job_run_id: null,
      next_occurrence_at: null,
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
      occurrence: 1,
      values: { riskLevel: 4 },
      updated_by: null
    });
    await db.project.upsertAssessmentResponse({
      workspace,
      assessment_id: assessment.id,
      entity_id: lowRisk.id,
      occurrence: 1,
      values: { riskLevel: 1 },
      updated_by: null
    });

    const schemas: SchemaCatalog = new Map([[schema.id, schema]]);
    const conditions: FilterCondition[] = [
      { fieldId: '_assessment:riskLevel', op: 'gt', value: 2 }
    ];

    const irQuery = filterConditionsToEntityQueryIR(schema.id, assessment.id, conditions);
    const irMatches = await runQuery(db, driver, workspace, schemas, irQuery);

    expect(irMatches.map(e => e.id)).toEqual([highRisk.id]);
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
      mode: 'fields',
      scope: [schema.id],
      scope_conditions: [],
      groups: [],
      assigned_team_ids: [],
      due_at: null,
      recurrence: { type: 'none' },
      response_window_days: null,
      current_occurrence: 1,
      pending_occurrence_job_run_id: null,
      next_occurrence_at: null,
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
      occurrence: 1,
      values: { riskLevel: 4 },
      updated_by: null
    });
    await db.project.upsertAssessmentResponse({
      workspace,
      assessment_id: assessment.id,
      entity_id: lowRisk.id,
      occurrence: 1,
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
    const linkedEntity = await createFixtureCatalogEntity(db, workspace, schema.id);
    await db.project.addProjectEntity({
      workspace,
      project_id: project.id,
      entity_id: linkedEntity.id,
      entity_type_id: null,
      created_at: new Date()
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
      expect.arrayContaining([projectEntity.id, linkedEntity.id])
    );
    expect(matches.map(entity => entity.id)).not.toContain(globalEntity.id);
    expect(matches.map(entity => entity.id)).not.toContain(otherProjectEntity.id);

    const allMatches = await runQuery(db, driver, workspace, schemas, {
      ...query,
      projectScope: 'all'
    });
    expect(allMatches.map(entity => entity.id).sort()).toEqual(
      [globalEntity.id, projectEntity.id, linkedEntity.id].sort()
    );
    expect(allMatches.map(entity => entity.id)).not.toContain(otherProjectEntity.id);
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
      record_id: entity.id,
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
      record_id: entity.id,
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
    await db.changeCase.createCase({
      id: randomUUID(),
      workspace,
      project_id: project.id,
      name: 'planned rename',
      description: null,
      effective_date: '2030-01-01',
      milestone_id: null,
      message: 'planned rename',
      created_by: user.id,
      created_at: new Date('2026-01-02T00:00:00.000Z'),
      members: [
        {
          entity_id: entity.id,
          base_version: 1,
          base_state: { name: entity.name },
          proposed_state: { name: 'Future name' },
          diff: {}
        }
      ]
    });
    await db.project.addProjectEntity({
      workspace,
      project_id: project.id,
      entity_id: entity.id,
      entity_type_id: null,
      created_at: new Date('2026-01-02T00:00:00.000Z')
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

  it('fails closed for nested projections when target schemas or fields are unavailable', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const user = await createFixtureUser(db);
    const targetSchema = await createSchema(db, workspace, {
      name: 'Projection target',
      fields: [
        { id: 'visible', name: 'Visible', type: 'text' },
        { id: 'restricted', name: 'Restricted', type: 'text', groupId: 'restricted' }
      ],
      groups: [
        {
          id: 'restricted',
          name: 'Restricted',
          accessControl: { teamIds: ['team-restricted'] }
        }
      ]
    });
    const ownerSchema = await createSchema(db, workspace, {
      name: 'Projection owner',
      fields: [
        {
          id: 'target',
          name: 'Target',
          type: 'reference',
          schemaId: targetSchema.id,
          minCount: 0,
          maxCount: 1
        }
      ]
    });
    const unrelatedSchema = await createSchema(db, workspace, {
      name: 'Projection field collider',
      fields: [
        { id: 'secret', name: 'Secret', type: 'text' },
        { id: 'visible', name: 'Visible', type: 'text' },
        { id: 'restricted', name: 'Restricted', type: 'text' }
      ]
    });

    const target = await createFixtureCatalogEntity(db, workspace, targetSchema.id, {
      data: {
        visible: 'visible value',
        secret: 'stale secret',
        restricted: 'restricted value'
      }
    });
    const owner = await createFixtureCatalogEntity(db, workspace, ownerSchema.id, {
      data: { target: [target.id] }
    });
    const authCtx = buildAuthorizationContext({
      userId: user.id,
      globalRoles: [],
      workspaceRole: 'editor',
      teamAssignments: [],
      schemas: [ownerSchema, targetSchema, unrelatedSchema],
      entities: [owner, target],
      grants: []
    });
    const path = [{ kind: 'forward' as const, fieldId: 'target' }];
    const query: EntityQuery = {
      schemaId: ownerSchema.id,
      root: { kind: 'predicate', path: [], fieldId: '_id', op: 'equals', value: owner.id },
      projections: [
        { path, fieldId: 'visible', alias: 'visible' },
        { path, fieldId: 'secret', alias: 'secret' },
        { path, fieldId: 'restricted', alias: 'restricted' }
      ]
    };

    const run = async (schemas: SchemaCatalog) => {
      const validation = validateEntityQueryIR(query, schemas, authCtx);
      expect(validation.ok, JSON.stringify(validation)).toBe(true);
      const compiled = compileEntityQueryIR(query, schemas, driver, workspace, {}, authCtx);
      const rows = await db.catalog.runCompiledEntityQuery(compiled.sql, compiled.params);
      expect(rows).toHaveLength(1);
      return rows[0]!.projections;
    };

    const knownSchemas: SchemaCatalog = new Map([
      [ownerSchema.id, ownerSchema],
      [targetSchema.id, targetSchema],
      [unrelatedSchema.id, unrelatedSchema]
    ]);
    expect(await run(knownSchemas)).toEqual({
      visible: 'visible value',
      secret: null,
      restricted: null
    });

    await db.catalog.deleteSchema(workspace, targetSchema.id);
    const missingTargetSchemas: SchemaCatalog = new Map([
      [ownerSchema.id, ownerSchema],
      [unrelatedSchema.id, unrelatedSchema]
    ]);
    expect(await run(missingTargetSchemas)).toEqual({
      visible: null,
      secret: null,
      restricted: null
    });

    const page = await listEntitiesWithCount(db, workspace, authCtx, {
      entityQuery: query,
      view: 'full'
    });
    expect(page.items[0]?._projections).toEqual({
      visible: null,
      secret: null,
      restricted: null
    });
  });

  it('fails closed for nested projections when the target schema is unavailable as of a date', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const user = await createFixtureUser(db);
    const asOf = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const targetSchemaId = randomUUID();
    const createDatedSchema = async (
      id: string,
      name: string,
      fields: SchemaDbResult['fields'],
      createdAt: Date
    ) =>
      db.catalog.createSchema({
        id,
        workspace,
        name,
        description: '',
        fields,
        templates: [],
        groups: [],
        shared_field_group_links: [],
        color: null,
        icon: null,
        default_owner: null,
        key_prefix: id.slice(0, 8).toUpperCase(),
        created_at: createdAt,
        updated_at: createdAt
      });

    const ownerSchema = await createDatedSchema(
      randomUUID(),
      'Historical projection owner',
      [
        {
          id: 'target',
          name: 'Target',
          type: 'reference',
          schemaId: targetSchemaId,
          minCount: 0,
          maxCount: 1
        }
      ],
      new Date(asOf.getTime() - 2 * 24 * 60 * 60 * 1000)
    );
    const unrelatedSchema = await createDatedSchema(
      randomUUID(),
      'Historical projection field collider',
      [{ id: 'secret', name: 'Secret', type: 'text' }],
      new Date(asOf.getTime() - 2 * 24 * 60 * 60 * 1000)
    );
    const targetSchema = await createDatedSchema(
      targetSchemaId,
      'Future projection target',
      [{ id: 'secret', name: 'Secret', type: 'text' }],
      new Date(asOf.getTime() + 24 * 60 * 60 * 1000)
    );
    const target = await createFixtureCatalogEntity(db, workspace, targetSchema.id, {
      data: { secret: 'historical secret' },
      created_at: new Date(asOf.getTime() - 60 * 60 * 1000)
    });
    const owner = await createFixtureCatalogEntity(db, workspace, ownerSchema.id, {
      data: { target: [target.id] },
      created_at: new Date(asOf.getTime() - 60 * 60 * 1000)
    });
    const authCtx = buildAuthorizationContext({
      userId: user.id,
      globalRoles: [],
      workspaceRole: 'admin',
      teamAssignments: [],
      schemas: [ownerSchema, targetSchema, unrelatedSchema],
      entities: [owner, target],
      grants: []
    });
    const query: EntityQuery = {
      schemaId: ownerSchema.id,
      asOf: asOf.toISOString(),
      root: { kind: 'predicate', path: [], fieldId: '_id', op: 'equals', value: owner.id },
      projections: [
        {
          path: [{ kind: 'forward', fieldId: 'target' }],
          fieldId: 'secret',
          alias: 'secret'
        }
      ]
    };

    const page = await listEntitiesWithCount(db, workspace, authCtx, {
      entityQuery: query,
      view: 'full'
    });
    expect(page.total).toBe(1);
    expect(page.items[0]?._projections).toEqual({ secret: null });
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

  it('executes EntityQuery through the existing list/count path', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const technologySchema = await createSchema(db, workspace, { name: 'Technology' });
    const releaseSchema = await createSchema(db, workspace, {
      name: 'Technology Release',
      fields: [
        { id: 'eol_date', name: 'EOL Date', type: 'date' },
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
          schemaId: releaseSchema.id,
          minCount: 0,
          maxCount: -1
        }
      ]
    });
    const go = await createFixtureCatalogEntity(db, workspace, technologySchema.id, {
      slug: 'go'
    });
    const release = await createFixtureCatalogEntity(db, workspace, releaseSchema.id, {
      data: { eol_date: '2026-01-01', technology: [go.id] }
    });
    const component = await createFixtureCatalogEntity(db, workspace, componentSchema.id, {
      data: { technology_releases: [release.id] }
    });

    const query: EntityQuery = {
      schemaId: componentSchema.id,
      root: {
        kind: 'predicate',
        path: [
          { kind: 'forward', fieldId: 'technology_releases' },
          { kind: 'forward', fieldId: 'technology' }
        ],
        fieldId: '_id',
        op: 'equals',
        value: go.id
      },
      projections: [
        {
          path: [{ kind: 'forward', fieldId: 'technology_releases' }],
          fieldId: 'eol_date',
          alias: 'release_eol'
        }
      ]
    };

    const page = await listEntitiesWithCount(db, workspace, null, {
      entityQuery: query,
      view: 'full',
      limit: 1,
      offset: 0
    });

    expect(page.total).toBe(1);
    expect(page.items.map(item => item._uid)).toEqual([component.id]);
    expect(page.items[0]?._projections).toEqual({ release_eol: ['2026-01-01'] });
    expect(await countEntities(db, workspace, null, { entityQuery: query })).toBe(1);
  });

  it('preserves project scope and pagination through the IR list/count path', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const project = await createFixtureProject(db, workspace);
    const otherProject = await createFixtureProject(db, workspace);
    const schema = await createSchema(db, workspace, { name: 'Component' });
    const globalEntity = await createFixtureCatalogEntity(db, workspace, schema.id, {
      name: 'A global'
    });
    const projectEntity = await createFixtureCatalogEntity(db, workspace, schema.id, {
      project_id: project.id,
      name: 'B project'
    });
    await createFixtureCatalogEntity(db, workspace, schema.id, {
      project_id: otherProject.id,
      name: 'C other project'
    });

    const query: EntityQuery = {
      projectId: project.id,
      projectScope: 'project',
      schemaId: schema.id,
      root: { kind: 'predicate', path: [], fieldId: '_id', op: 'not_empty', value: null }
    };
    const page = await listEntitiesWithCount(db, workspace, null, {
      entityQuery: query,
      view: 'summary',
      limit: 1,
      offset: 0
    });

    expect(page.total).toBe(1);
    expect(page.items.map(item => item._uid)).toEqual([projectEntity.id]);
    expect(await countEntities(db, workspace, null, { entityQuery: query })).toBe(1);
    expect(page.items.map(item => item._uid)).not.toContain(globalEntity.id);
  });

  it('applies entity visibility before IR traversal results are returned', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schema = await createSchema(db, workspace, { name: 'Component' });
    const user = await createFixtureUser(db);
    const allowed = await createFixtureCatalogEntity(db, workspace, schema.id);
    const denied = await createFixtureCatalogEntity(db, workspace, schema.id);
    const grants = await db.catalog.replaceEntityGrants(workspace, allowed.id, [
      {
        id: randomUUID(),
        workspace,
        entity_id: allowed.id,
        principal_type: 'user',
        principal_id: user.id,
        role: 'editor',
        applies_to: 'self',
        created_at: new Date()
      }
    ]);
    const authCtx = buildAuthorizationContext({
      userId: user.id,
      globalRoles: [],
      workspaceRole: null,
      schemas: [schema],
      entities: [allowed, denied],
      grants
    });

    const page = await listEntitiesWithCount(db, workspace, authCtx, {
      entityQuery: {
        schemaId: schema.id,
        root: { kind: 'predicate', path: [], fieldId: '_id', op: 'not_empty', value: null }
      }
    });

    expect(page.items.map(item => item._uid)).toEqual([allowed.id]);
    expect(page.items.map(item => item._uid)).not.toContain(denied.id);
  });

  // #2592: a field id restricted in one schema's field group but also defined, unrestricted, by
  // an unrelated schema used to resolve/compile with no `schema_id` scoping at all, so a caller
  // with no access to the restricted group could still filter/sort/count/project on the field via
  // the unrestricted schema's grant, and the restricted schema's own rows still participated in
  // (or leaked their value into) the result. Reproduces the issue's exact Employee/Contractor
  // scenario end to end (real SQL, both dialects).
  it('scopes compiled SQL to the schemas that granted a field id colliding across schemas', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const user = await createFixtureUser(db);

    const employee = await createSchema(db, workspace, {
      name: 'Employee',
      fields: [{ id: 'salary', name: 'Salary', type: 'number', groupId: 'hr' }],
      groups: [{ id: 'hr', name: 'HR', accessControl: { teamIds: ['team-hr'] } }]
    });
    const contractor = await createSchema(db, workspace, {
      name: 'Contractor',
      fields: [{ id: 'salary', name: 'Salary', type: 'number' }]
    });

    const employeeEntity = await createFixtureCatalogEntity(db, workspace, employee.id, {
      name: 'Restricted Employee',
      data: { salary: 500 }
    });
    const contractorEntity = await createFixtureCatalogEntity(db, workspace, contractor.id, {
      name: 'Visible Contractor',
      data: { salary: 200 }
    });

    const schemas: SchemaCatalog = new Map([
      [employee.id, employee],
      [contractor.id, contractor]
    ]);

    const noAccess = buildAuthorizationContext({
      userId: user.id,
      globalRoles: [],
      workspaceRole: null,
      schemas: [employee, contractor],
      entities: [employeeEntity, contractorEntity],
      grants: []
    });
    const hrAccess = buildAuthorizationContext({
      userId: user.id,
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [{ teamId: 'team-hr', role: 'team_reviewer' }],
      schemas: [employee, contractor],
      entities: [employeeEntity, contractorEntity],
      grants: []
    });

    const filterQuery: EntityQuery = {
      root: { kind: 'predicate', path: [], fieldId: 'salary', op: 'gt', value: 100 }
    };

    const runFiltered = async (authCtx: ReturnType<typeof buildAuthorizationContext> | null) => {
      const validation = validateEntityQueryIR(filterQuery, schemas, authCtx);
      expect(validation.ok, JSON.stringify(validation)).toBe(true);
      const { sql, params } = compileEntityQueryIR(
        filterQuery,
        schemas,
        driver,
        workspace,
        {},
        authCtx
      );
      return db.catalog.runCompiledEntityQuery(sql, params);
    };

    const noAccessMatches = await runFiltered(noAccess);
    expect(noAccessMatches.map(entity => entity.id)).toEqual([contractorEntity.id]);
    expect(noAccessMatches.map(entity => entity.id)).not.toContain(employeeEntity.id);

    const hrAccessMatches = await runFiltered(hrAccess);
    expect(hrAccessMatches.map(entity => entity.id)).toEqual(
      expect.arrayContaining([employeeEntity.id, contractorEntity.id])
    );

    const projectionQuery: EntityQuery = {
      root: { kind: 'and', children: [] },
      projections: [{ path: [], fieldId: 'salary' }]
    };
    const projValidation = validateEntityQueryIR(projectionQuery, schemas, noAccess);
    expect(projValidation.ok, JSON.stringify(projValidation)).toBe(true);
    const { sql: projSql, params: projParams } = compileEntityQueryIR(
      projectionQuery,
      schemas,
      driver,
      workspace,
      {},
      noAccess
    );
    const projRows = await db.catalog.runCompiledEntityQuery(projSql, projParams);
    const employeeRow = projRows.find(row => row.id === employeeEntity.id);
    const contractorRow = projRows.find(row => row.id === contractorEntity.id);
    expect(employeeRow?.projections['salary']).toBeNull();
    expect(contractorRow?.projections['salary']).toBe(200);
  });

  it('preserves restricted-field unknown semantics through negation and composition', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const user = await createFixtureUser(db);

    const employee = await createSchema(db, workspace, {
      name: 'Employee',
      fields: [{ id: 'salary', name: 'Salary', type: 'number', groupId: 'hr' }],
      groups: [{ id: 'hr', name: 'HR', accessControl: { teamIds: ['team-hr'] } }]
    });
    const contractor = await createSchema(db, workspace, {
      name: 'Contractor',
      fields: [{ id: 'salary', name: 'Salary', type: 'number' }]
    });

    const restrictedEmployee = await createFixtureCatalogEntity(db, workspace, employee.id, {
      name: 'Restricted Employee',
      data: { salary: 500 }
    });
    const highContractor = await createFixtureCatalogEntity(db, workspace, contractor.id, {
      name: 'High Contractor',
      data: { salary: 200 }
    });
    const lowContractor = await createFixtureCatalogEntity(db, workspace, contractor.id, {
      name: 'Low Contractor',
      data: { salary: 50 }
    });

    const schemas: SchemaCatalog = new Map([
      [employee.id, employee],
      [contractor.id, contractor]
    ]);
    const noAccess = buildAuthorizationContext({
      userId: user.id,
      globalRoles: [],
      workspaceRole: 'editor',
      schemas: [employee, contractor],
      entities: [restrictedEmployee, highContractor, lowContractor],
      grants: []
    });
    const hrAccess = buildAuthorizationContext({
      userId: user.id,
      globalRoles: [],
      workspaceRole: 'editor',
      teamAssignments: [{ teamId: 'team-hr', role: 'team_reviewer' }],
      schemas: [employee, contractor],
      entities: [restrictedEmployee, highContractor, lowContractor],
      grants: []
    });

    const predicate = (fieldId: string, op: 'equals' | 'gt', value: unknown) => ({
      kind: 'predicate' as const,
      path: [],
      fieldId,
      op,
      value
    });
    const queryFor = (root: EntityQuery['root'], projections?: EntityQuery['projections']) => ({
      root,
      ...(projections ? { projections } : {})
    });
    const run = async (
      query: EntityQuery,
      authCtx: ReturnType<typeof buildAuthorizationContext>
    ) => {
      const validation = validateEntityQueryIR(query, schemas, authCtx);
      expect(validation.ok, JSON.stringify(validation)).toBe(true);
      const compiled = compileEntityQueryIR(query, schemas, driver, workspace, {}, authCtx);
      return db.catalog.runCompiledEntityQuery(compiled.sql, compiled.params);
    };

    const positive = queryFor(predicate('salary', 'gt', 100));
    expect((await run(positive, noAccess)).map(entity => entity.id)).toEqual([highContractor.id]);
    expect((await run(positive, hrAccess)).map(entity => entity.id)).toEqual(
      expect.arrayContaining([restrictedEmployee.id, highContractor.id])
    );

    const negated = queryFor({ kind: 'not', child: predicate('salary', 'gt', 100) });
    expect((await run(negated, noAccess)).map(entity => entity.id)).toEqual([lowContractor.id]);

    const conjunction = queryFor({
      kind: 'and',
      children: [predicate('salary', 'gt', 100), predicate('_name', 'equals', 'High Contractor')]
    });
    expect((await run(conjunction, noAccess)).map(entity => entity.id)).toEqual([
      highContractor.id
    ]);

    const disjunction = queryFor({
      kind: 'or',
      children: [predicate('salary', 'gt', 100), predicate('_name', 'equals', 'No such entity')]
    });
    expect((await run(disjunction, noAccess)).map(entity => entity.id)).toEqual([
      highContractor.id
    ]);

    const disjunctionWithKnownMatch = queryFor({
      kind: 'or',
      children: [
        predicate('salary', 'gt', 100),
        predicate('_name', 'equals', 'Restricted Employee')
      ]
    });
    expect((await run(disjunctionWithKnownMatch, noAccess)).map(entity => entity.id)).toEqual(
      expect.arrayContaining([restrictedEmployee.id, highContractor.id])
    );

    const negatedPage = await listEntitiesWithCount(db, workspace, noAccess, {
      entityQuery: negated,
      view: 'full'
    });
    expect(negatedPage.total).toBe(1);
    expect(negatedPage.items.map(entity => entity._uid)).toEqual([lowContractor.id]);
    expect(await countEntities(db, workspace, noAccess, { entityQuery: negated })).toBe(1);

    const projectionQuery = queryFor({ kind: 'and', children: [] }, [
      { path: [], fieldId: 'salary' }
    ]);
    const projected = await run(projectionQuery, noAccess);
    expect(
      projected.find(entity => entity.id === restrictedEmployee.id)?.projections['salary']
    ).toBe(null);
    expect(projected.find(entity => entity.id === highContractor.id)?.projections['salary']).toBe(
      200
    );
    expect(projected.find(entity => entity.id === lowContractor.id)?.projections['salary']).toBe(
      50
    );
  });

  it('preserves restricted relation-field unknown semantics through negation, counts, and projections', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const user = await createFixtureUser(db);
    const endpointSchema = await createSchema(db, workspace, { name: 'Endpoint' });
    const restrictedRelation = await db.relation.createRelationSchema({
      id: randomUUID(),
      workspace,
      name: 'Restricted Relation',
      description: '',
      in_schema_ids: [endpointSchema.id],
      out_schema_ids: [endpointSchema.id],
      fields: [{ id: 'note', name: 'Note', type: 'text', groupId: 'restricted' }],
      groups: [
        { id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-restricted'] } }
      ],
      shared_field_group_links: [],
      color: null,
      icon: null,
      relation_approval_policy: 'disabled',
      created_at: new Date(),
      updated_at: new Date()
    });
    const unrestrictedRelation = await db.relation.createRelationSchema({
      id: randomUUID(),
      workspace,
      name: 'Unrestricted Relation',
      description: '',
      in_schema_ids: [endpointSchema.id],
      out_schema_ids: [endpointSchema.id],
      fields: [{ id: 'note', name: 'Note', type: 'text' }],
      groups: [],
      shared_field_group_links: [],
      color: null,
      icon: null,
      relation_approval_policy: 'disabled',
      created_at: new Date(),
      updated_at: new Date()
    });
    const left = await createFixtureCatalogEntity(db, workspace, endpointSchema.id, {
      name: 'Left'
    });
    const right = await createFixtureCatalogEntity(db, workspace, endpointSchema.id, {
      name: 'Right'
    });
    const restricted = await db.relation.createRelation({
      id: randomUUID(),
      workspace,
      schema_id: restrictedRelation.id,
      in_entity_id: left.id,
      out_entity_id: right.id,
      data: { note: 'secret' },
      created_at: new Date(),
      updated_at: new Date()
    });
    const visible = await db.relation.createRelation({
      id: randomUUID(),
      workspace,
      schema_id: unrestrictedRelation.id,
      in_entity_id: left.id,
      out_entity_id: right.id,
      data: { note: 'visible' },
      created_at: new Date(),
      updated_at: new Date()
    });
    const low = await db.relation.createRelation({
      id: randomUUID(),
      workspace,
      schema_id: unrestrictedRelation.id,
      in_entity_id: right.id,
      out_entity_id: left.id,
      data: { note: 'low' },
      created_at: new Date(),
      updated_at: new Date()
    });

    const schemas: SchemaCatalog = new Map([[endpointSchema.id, endpointSchema]]);
    const relationSchemas = new Map([
      [restrictedRelation.id, restrictedRelation],
      [unrestrictedRelation.id, unrestrictedRelation]
    ]);
    const noAccess = buildAuthorizationContext({
      userId: user.id,
      globalRoles: [],
      workspaceRole: 'editor',
      schemas: [endpointSchema],
      entities: [left, right],
      grants: []
    });
    const queryFor = (root: EntityQuery['root'], projections?: EntityQuery['projections']) => ({
      root_kind: 'relation' as const,
      root,
      ...(projections ? { projections } : {})
    });
    const run = async (query: EntityQuery) => {
      const validation = validateEntityQueryIR(query, schemas, noAccess, relationSchemas);
      expect(validation.ok, JSON.stringify(validation)).toBe(true);
      const compiled = compileEntityQueryIR(
        query,
        schemas,
        driver,
        workspace,
        {},
        noAccess,
        relationSchemas
      );
      return db.relation.runCompiledRelationQuery(compiled.sql, compiled.params);
    };
    const predicate = {
      kind: 'predicate' as const,
      path: [],
      fieldId: 'note',
      op: 'equals' as const,
      value: 'visible'
    };

    expect((await run(queryFor(predicate))).map(relation => relation.id)).toEqual([visible.id]);
    expect(
      (await run(queryFor({ kind: 'not', child: predicate }))).map(relation => relation.id)
    ).toEqual([low.id]);

    const negated = queryFor({ kind: 'not', child: predicate });
    const countQuery = compileEntityQueryCountIR(
      negated,
      schemas,
      driver,
      workspace,
      {},
      noAccess,
      relationSchemas
    );
    const count = await db.relation.runCompiledRelationCountQuery(
      countQuery.sql,
      countQuery.params
    );
    expect(count).toBe(1);

    const projectionQuery = queryFor({ kind: 'and', children: [] }, [
      { path: [], fieldId: 'note' }
    ]);
    const projected = await run(projectionQuery);
    expect(
      projected.find(relation => relation.id === restricted.id)?.projections['note']
    ).toBeNull();
    expect(projected.find(relation => relation.id === visible.id)?.projections['note']).toBe(
      'visible'
    );
  });

  it('scopes typed-relation hops and projection bindings to accessible owner schemas', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const user = await createFixtureUser(db);
    const relationSchemaId = randomUUID();

    const targetSchema = await createSchema(db, workspace, { name: 'Target' });
    const openOwnerSchema = await createSchema(db, workspace, {
      name: 'Open Owner',
      fields: [
        {
          id: 'depends_on',
          name: 'Depends on',
          type: 'typedRelation',
          relationSchemaId,
          direction: 'out'
        }
      ]
    });
    const lockedOwnerSchema = await createSchema(db, workspace, {
      name: 'Locked Owner',
      fields: [
        {
          id: 'depends_on',
          name: 'Depends on',
          type: 'typedRelation',
          relationSchemaId,
          direction: 'out',
          groupId: 'locked'
        }
      ],
      groups: [{ id: 'locked', name: 'Locked', accessControl: { teamIds: ['team-locked'] } }]
    });
    const relationSchema: RelationSchemaDbResult = await db.relation.createRelationSchema({
      id: relationSchemaId,
      workspace,
      name: 'Depends On',
      description: '',
      in_schema_ids: [targetSchema.id],
      out_schema_ids: [openOwnerSchema.id, lockedOwnerSchema.id],
      fields: [
        { id: 'note', name: 'Note', type: 'text', requirementLevel: 'optional' },
        { id: 'status', name: 'Status', type: 'text', requirementLevel: 'optional' }
      ],
      groups: [],
      shared_field_group_links: [],
      color: null,
      icon: null,
      relation_approval_policy: 'disabled',
      created_at: new Date(),
      updated_at: new Date()
    });

    const target = await createFixtureCatalogEntity(db, workspace, targetSchema.id, {
      name: 'Target Entity'
    });
    const openOwner = await createFixtureCatalogEntity(db, workspace, openOwnerSchema.id, {
      name: 'Open Owner'
    });
    const lockedOwner = await createFixtureCatalogEntity(db, workspace, lockedOwnerSchema.id, {
      name: 'Locked Owner'
    });
    const relationData = { note: 'visible relation note', status: 'active' };
    await db.relation.createRelation({
      id: randomUUID(),
      workspace,
      schema_id: relationSchema.id,
      in_entity_id: target.id,
      out_entity_id: openOwner.id,
      data: relationData,
      created_at: new Date(),
      updated_at: new Date()
    });
    await db.relation.createRelation({
      id: randomUUID(),
      workspace,
      schema_id: relationSchema.id,
      in_entity_id: target.id,
      out_entity_id: lockedOwner.id,
      data: relationData,
      created_at: new Date(),
      updated_at: new Date()
    });

    const schemas: SchemaCatalog = new Map([
      [targetSchema.id, targetSchema],
      [openOwnerSchema.id, openOwnerSchema],
      [lockedOwnerSchema.id, lockedOwnerSchema]
    ]);
    const relationSchemas = new Map([[relationSchema.id, relationSchema]]);
    const noAccess = buildAuthorizationContext({
      userId: user.id,
      globalRoles: [],
      workspaceRole: null,
      schemas: [targetSchema, openOwnerSchema, lockedOwnerSchema],
      entities: [target, openOwner, lockedOwner],
      grants: []
    });
    const privileged = buildAuthorizationContext({
      userId: user.id,
      globalRoles: [],
      workspaceRole: 'admin',
      schemas: [targetSchema, openOwnerSchema, lockedOwnerSchema],
      entities: [target, openOwner, lockedOwner],
      grants: []
    });

    const path = (ownerSchemaIds: string[]) => [
      {
        kind: 'typedRelation' as const,
        fieldId: 'depends_on',
        relationSchemaId: relationSchema.id,
        direction: 'out' as const,
        ownerSchemaIds
      }
    ];
    const query: EntityQuery = {
      root: { kind: 'relationExists', path: path([openOwnerSchema.id]) },
      projections: [
        { path: path([openOwnerSchema.id]), fieldId: '_name', alias: 'target_name' },
        {
          path: path([openOwnerSchema.id]),
          fieldId: 'note',
          source: 'relation',
          alias: 'relation_note'
        },
        {
          path: path([openOwnerSchema.id]),
          fieldId: 'status',
          source: 'relation',
          alias: 'relation_status'
        }
      ]
    };

    const compileAndRun = async (
      authCtx: ReturnType<typeof buildAuthorizationContext>,
      ownerSchemaIds: string[]
    ) => {
      const scopedQuery: EntityQuery = {
        ...query,
        root: { kind: 'relationExists', path: path(ownerSchemaIds) },
        projections: query.projections!.map(projection => ({
          ...projection,
          path: path(ownerSchemaIds)
        }))
      };
      const validation = validateEntityQueryIR(scopedQuery, schemas, authCtx, relationSchemas);
      expect(validation.ok, JSON.stringify(validation)).toBe(true);
      const compiled = compileEntityQueryIR(
        scopedQuery,
        schemas,
        driver,
        workspace,
        {},
        authCtx,
        relationSchemas
      );
      expect(compiled.sql).toContain('LEFT JOIN scoped_entity in_relation_source_endpoint');
      expect(compiled.sql).toMatch(
        /r\.schema_id = (?:\$\d+|\?) AND out_relation_source_endpoint\.schema_id IN \((?:\$\d+|\?)(?:, (?:\$\d+|\?))*\)/
      );
      return db.catalog.runCompiledEntityQuery(compiled.sql, compiled.params);
    };

    const noAccessMatches = await compileAndRun(noAccess, [openOwnerSchema.id]);
    expect(noAccessMatches.map(entity => entity.id)).toEqual([openOwner.id]);
    expect(noAccessMatches[0]?.projections['target_name']).toEqual(['Target Entity']);
    expect(noAccessMatches[0]?.projections['relation_note']).toEqual([relationData.note]);
    expect(noAccessMatches[0]?.projections['relation_status']).toEqual([relationData.status]);

    const privilegedMatches = await compileAndRun(privileged, [
      openOwnerSchema.id,
      lockedOwnerSchema.id
    ]);
    expect(privilegedMatches.map(entity => entity.id)).toEqual(
      expect.arrayContaining([openOwner.id, lockedOwner.id])
    );

    const restrictedBinding: EntityQuery = {
      root: { kind: 'relationExists', path: path([openOwnerSchema.id, lockedOwnerSchema.id]) }
    };
    const restrictedValidation = validateEntityQueryIR(
      restrictedBinding,
      schemas,
      noAccess,
      relationSchemas
    );
    expect(restrictedValidation.ok).toBe(false);
  });

  it('does not let a relation instance version leak into an asOf entity query (#2687)', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schema = await createSchema(db, workspace, { name: 'Service' });
    const relationSchema = await db.relation.createRelationSchema({
      id: randomUUID(),
      workspace,
      name: 'Depends On',
      description: '',
      in_schema_ids: [schema.id],
      out_schema_ids: [schema.id],
      fields: [],
      groups: [],
      shared_field_group_links: [],
      color: null,
      icon: null,
      relation_approval_policy: 'disabled',
      created_at: new Date(),
      updated_at: new Date()
    });
    const entityA = await createFixtureCatalogEntity(db, workspace, schema.id, { name: 'A' });
    const entityB = await createFixtureCatalogEntity(db, workspace, schema.id, { name: 'B' });
    const relation = await db.relation.createRelation({
      id: randomUUID(),
      workspace,
      schema_id: relationSchema.id,
      in_entity_id: entityA.id,
      out_entity_id: entityB.id,
      data: {},
      created_at: new Date(),
      updated_at: new Date()
    });
    // Simulates what relationOperations.ts now writes on relation create — a record_version row
    // sharing the same table entities' asOf reconstruction reads from.
    await db.catalog.createEntityVersion({
      id: randomUUID(),
      workspace,
      record_id: relation.id,
      version_number: 1,
      kind: 'autosave',
      commit_message: null,
      created_at: new Date(),
      created_by: null,
      state: {
        id: relation.id,
        workspace,
        schema_id: relationSchema.id,
        in_entity_id: entityA.id,
        out_entity_id: entityB.id,
        data: {},
        version: 1,
        approval_policy_override: null,
        created_at: relation.created_at.toISOString(),
        updated_at: relation.updated_at.toISOString()
      },
      applied_case_revision_id: null
    });

    const schemas: SchemaCatalog = new Map([[schema.id, schema]]);
    const query: EntityQuery = {
      asOf: new Date().toISOString(),
      schemaId: schema.id,
      root: { kind: 'predicate', path: [], fieldId: '_id', op: 'not_empty', value: null }
    };

    const matches = await runQuery(db, driver, workspace, schemas, query);
    const ids = matches.map(result => result.id);
    expect(ids.sort()).toEqual([entityA.id, entityB.id].sort());
    expect(ids).not.toContain(relation.id);
  });

  it('reconstructs a typed relation hop and its field data as of a point in time (#2687)', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const relationSchemaId = randomUUID();
    const ownerSchema = await createSchema(db, workspace, {
      name: 'Owner',
      fields: [
        {
          id: 'depends_on',
          name: 'Depends on',
          type: 'typedRelation',
          relationSchemaId,
          direction: 'out'
        }
      ]
    });
    const relationSchema = await db.relation.createRelationSchema({
      id: relationSchemaId,
      workspace,
      name: 'Depends On',
      description: '',
      in_schema_ids: [ownerSchema.id],
      out_schema_ids: [ownerSchema.id],
      fields: [{ id: 'status', name: 'Status', type: 'text', requirementLevel: 'optional' }],
      groups: [],
      shared_field_group_links: [],
      color: null,
      icon: null,
      relation_approval_policy: 'disabled',
      created_at: new Date(),
      updated_at: new Date()
    });

    const owner = await createFixtureCatalogEntity(db, workspace, ownerSchema.id, {
      name: 'Owner Entity'
    });
    const target = await createFixtureCatalogEntity(db, workspace, ownerSchema.id, {
      name: 'Target Entity'
    });
    // Must postdate both entities' own created_at (set to "now" by the fixture helper above), or
    // an asOf point between them would find neither entity to have existed yet.
    const afterEntities = Date.now();
    const historicalDate = new Date(afterEntities + 1000);
    const liveDate = new Date(afterEntities + 3000);
    const relation = await db.relation.createRelation({
      id: randomUUID(),
      workspace,
      schema_id: relationSchema.id,
      in_entity_id: target.id,
      out_entity_id: owner.id,
      data: { status: 'final' },
      version: 2,
      created_at: historicalDate,
      updated_at: liveDate
    });
    await db.catalog.createEntityVersion({
      id: randomUUID(),
      workspace,
      record_id: relation.id,
      version_number: 1,
      kind: 'autosave',
      commit_message: null,
      created_at: historicalDate,
      created_by: null,
      state: {
        id: relation.id,
        workspace,
        schema_id: relationSchema.id,
        in_entity_id: target.id,
        out_entity_id: owner.id,
        data: { status: 'draft' },
        version: 1,
        approval_policy_override: null,
        created_at: historicalDate.toISOString(),
        updated_at: historicalDate.toISOString()
      },
      applied_case_revision_id: null
    });

    const schemas: SchemaCatalog = new Map([[ownerSchema.id, ownerSchema]]);
    const relationSchemas = new Map([[relationSchema.id, relationSchema]]);
    const path = (value: string) => [
      {
        kind: 'typedRelation' as const,
        fieldId: 'depends_on',
        relationSchemaId: relationSchema.id,
        direction: 'out' as const,
        ownerSchemaIds: [ownerSchema.id],
        filter: {
          kind: 'predicate' as const,
          path: [],
          fieldId: 'status',
          op: 'equals' as const,
          value
        }
      }
    ];
    const runFor = async (asOf: string | undefined, statusValue: string) => {
      const query: EntityQuery = {
        asOf,
        root: { kind: 'relationExists', path: path(statusValue) }
      };
      const validation = validateEntityQueryIR(query, schemas, null, relationSchemas);
      expect(validation.ok, JSON.stringify(validation)).toBe(true);
      const compiled = compileEntityQueryIR(
        query,
        schemas,
        driver,
        workspace,
        {},
        null,
        relationSchemas
      );
      const rows = await db.catalog.runCompiledEntityQuery(compiled.sql, compiled.params);
      return rows.map(row => row.id);
    };

    // Live state has status 'final' — matches 'final', not 'draft'.
    expect(await runFor(undefined, 'final')).toEqual([owner.id]);
    expect(await runFor(undefined, 'draft')).toEqual([]);

    // asOf the historical point, the relation had status 'draft', not the live 'final'.
    const asOfHistorical = new Date(historicalDate.getTime() + 1000).toISOString();
    expect(await runFor(asOfHistorical, 'draft')).toEqual([owner.id]);
    expect(await runFor(asOfHistorical, 'final')).toEqual([]);
  });

  it('applies active future changes to relation-rooted asOf queries (#2702)', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const project = await createFixtureProject(db, workspace);
    const user = await createFixtureUser(db);
    const schema = await createSchema(db, workspace, { name: 'System' });
    const relationSchema = await db.relation.createRelationSchema({
      id: randomUUID(),
      workspace,
      name: 'Depends On',
      description: '',
      in_schema_ids: [schema.id],
      out_schema_ids: [schema.id],
      fields: [{ id: 'status', name: 'Status', type: 'text' }],
      groups: [],
      shared_field_group_links: [],
      color: null,
      icon: null,
      relation_approval_policy: 'disabled',
      created_at: new Date(),
      updated_at: new Date()
    });
    const entityA = await createFixtureCatalogEntity(db, workspace, schema.id, { name: 'A' });
    const entityB = await createFixtureCatalogEntity(db, workspace, schema.id, { name: 'B' });
    const relation = await db.relation.createRelation({
      id: randomUUID(),
      workspace,
      schema_id: relationSchema.id,
      in_entity_id: entityA.id,
      out_entity_id: entityB.id,
      data: { status: 'current' },
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-01T00:00:00.000Z')
    });
    await db.catalog.createEntityVersion({
      id: randomUUID(),
      workspace,
      record_id: relation.id,
      version_number: 1,
      kind: 'autosave',
      commit_message: null,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      created_by: null,
      state: {
        id: relation.id,
        workspace,
        schema_id: relationSchema.id,
        in_entity_id: entityA.id,
        out_entity_id: entityB.id,
        data: { status: 'current' },
        version: 1,
        approval_policy_override: null,
        created_at: relation.created_at.toISOString(),
        updated_at: relation.updated_at.toISOString()
      },
      applied_case_revision_id: null
    });
    await db.changeCase.createCase({
      id: randomUUID(),
      workspace,
      project_id: project.id,
      name: 'planned relation status change',
      description: null,
      effective_date: '2030-01-01',
      milestone_id: null,
      message: 'planned relation status change',
      created_by: user.id,
      created_at: new Date('2026-01-02T00:00:00.000Z'),
      members: [
        {
          entity_id: relation.id,
          base_version: 1,
          base_state: { data: { status: 'current' } },
          proposed_state: { data: { status: 'proposed' } },
          diff: {}
        }
      ]
    });

    const schemas: SchemaCatalog = new Map([[schema.id, schema]]);
    const relationSchemas = new Map([[relationSchema.id, relationSchema]]);
    const runFor = async (asOf: string | undefined) => {
      const query: EntityQuery = {
        asOf,
        projectId: project.id,
        projectScope: 'project',
        schemaId: relationSchema.id,
        root: { kind: 'predicate', path: [], fieldId: 'status', op: 'equals', value: 'proposed' }
      };
      const validation = validateEntityQueryIR(query, schemas, null, relationSchemas);
      expect(validation.ok, JSON.stringify(validation)).toBe(true);
      const compiled = compileEntityQueryIR(
        query,
        schemas,
        driver,
        workspace,
        {},
        null,
        relationSchemas
      );
      const rows = await db.relation.runCompiledRelationQuery(compiled.sql, compiled.params);
      return rows.map(row => row.id);
    };

    // Live state has status 'current' — the proposed change hasn't been applied yet.
    expect(await runFor(undefined)).toEqual([]);

    // asOf before the case's effective_date: proposed change not yet in effect.
    expect(await runFor('2026-06-01T00:00:00.000Z')).toEqual([]);

    // asOf past the effective_date: the planned change is folded into the reconstructed state,
    // matching how the entity-rooted path already applies active_future_events (#2702).
    expect(await runFor('2030-02-01T00:00:00.000Z')).toEqual([relation.id]);
  });

  it('narrows relation-rooted temporal candidates without changing results (#2725)', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schema = await createSchema(db, workspace, { name: 'System' });
    const otherSchema = await createSchema(db, workspace, { name: 'Other System' });
    const relationSchema = await db.relation.createRelationSchema({
      id: randomUUID(),
      workspace,
      name: 'Depends On',
      description: '',
      in_schema_ids: [schema.id],
      out_schema_ids: [schema.id],
      fields: [{ id: 'status', name: 'Status', type: 'text' }],
      groups: [],
      shared_field_group_links: [],
      color: null,
      icon: null,
      relation_approval_policy: 'disabled',
      created_at: new Date(),
      updated_at: new Date()
    });
    const otherRelationSchema = await db.relation.createRelationSchema({
      id: randomUUID(),
      workspace,
      name: 'Other Relation',
      description: '',
      in_schema_ids: [otherSchema.id],
      out_schema_ids: [otherSchema.id],
      fields: [{ id: 'status', name: 'Status', type: 'text' }],
      groups: [],
      shared_field_group_links: [],
      color: null,
      icon: null,
      relation_approval_policy: 'disabled',
      created_at: new Date(),
      updated_at: new Date()
    });
    const inEntity = await createFixtureCatalogEntity(db, workspace, schema.id, { name: 'In' });
    const outEntity = await createFixtureCatalogEntity(db, workspace, schema.id, { name: 'Out' });
    const otherInEntity = await createFixtureCatalogEntity(db, workspace, otherSchema.id, {
      name: 'Other In'
    });
    const otherOutEntity = await createFixtureCatalogEntity(db, workspace, otherSchema.id, {
      name: 'Other Out'
    });
    const historicalDate = new Date('2026-01-01T00:00:00.000Z');
    const asOf = new Date('2026-01-02T00:00:00.000Z');

    const createHistoricalRelation = async (
      relationSchemaId: string,
      inEntityId: string,
      outEntityId: string,
      status: string
    ) => {
      const relation = await db.relation.createRelation({
        id: randomUUID(),
        workspace,
        schema_id: relationSchemaId,
        in_entity_id: inEntityId,
        out_entity_id: outEntityId,
        data: { status },
        created_at: historicalDate,
        updated_at: historicalDate
      });
      await db.catalog.createEntityVersion({
        id: randomUUID(),
        workspace,
        record_id: relation.id,
        version_number: 1,
        kind: 'autosave',
        commit_message: null,
        created_at: historicalDate,
        created_by: null,
        state: {
          id: relation.id,
          workspace,
          schema_id: relationSchemaId,
          in_entity_id: inEntityId,
          out_entity_id: outEntityId,
          data: { status },
          version: 1,
          approval_policy_override: null,
          created_at: historicalDate.toISOString(),
          updated_at: historicalDate.toISOString()
        },
        applied_case_revision_id: null
      });
      return relation;
    };

    const selected = await createHistoricalRelation(
      relationSchema.id,
      inEntity.id,
      outEntity.id,
      'historical'
    );
    await createHistoricalRelation(
      otherRelationSchema.id,
      otherInEntity.id,
      otherOutEntity.id,
      'historical'
    );

    const schemas: SchemaCatalog = new Map([
      [schema.id, schema],
      [otherSchema.id, otherSchema]
    ]);
    const relationSchemas = new Map([
      [relationSchema.id, relationSchema],
      [otherRelationSchema.id, otherRelationSchema]
    ]);
    const query: EntityQuery = {
      root_kind: 'relation',
      asOf: asOf.toISOString(),
      root: {
        kind: 'and',
        children: [
          {
            kind: 'predicate',
            path: [],
            fieldId: '_schemaId',
            op: 'equals',
            value: relationSchema.id
          },
          {
            kind: 'predicate',
            path: [],
            fieldId: '_inEntityId',
            op: 'equals',
            value: inEntity.id
          },
          { kind: 'predicate', path: [], fieldId: 'status', op: 'equals', value: 'historical' }
        ]
      }
    };

    const validation = validateEntityQueryIR(query, schemas, null, relationSchemas);
    expect(validation.ok, JSON.stringify(validation)).toBe(true);
    const compiled = compileEntityQueryIR(
      query,
      schemas,
      driver,
      workspace,
      {},
      null,
      relationSchemas
    );
    const rows = await db.relation.runCompiledRelationQuery(compiled.sql, compiled.params);

    expect(rows.map(row => row.id)).toEqual([selected.id]);
  });

  it('executes a relation-rooted query end to end (#2689)', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schema = await createSchema(db, workspace, { name: 'System' });
    const relationSchema = await db.relation.createRelationSchema({
      id: randomUUID(),
      workspace,
      name: 'Depends On',
      description: '',
      in_schema_ids: [schema.id],
      out_schema_ids: [schema.id],
      fields: [{ id: 'status', name: 'Status', type: 'text' }],
      groups: [],
      shared_field_group_links: [],
      color: null,
      icon: null,
      relation_approval_policy: 'disabled',
      created_at: new Date(),
      updated_at: new Date()
    });
    const entityA = await createFixtureCatalogEntity(db, workspace, schema.id, { name: 'A' });
    const entityB = await createFixtureCatalogEntity(db, workspace, schema.id, { name: 'B' });
    const entityC = await createFixtureCatalogEntity(db, workspace, schema.id, { name: 'C' });
    const matching = await db.relation.createRelation({
      id: randomUUID(),
      workspace,
      schema_id: relationSchema.id,
      in_entity_id: entityA.id,
      out_entity_id: entityB.id,
      data: { status: 'active' },
      created_at: new Date(),
      updated_at: new Date()
    });
    await db.relation.createRelation({
      id: randomUUID(),
      workspace,
      schema_id: relationSchema.id,
      in_entity_id: entityA.id,
      out_entity_id: entityC.id,
      data: { status: 'inactive' },
      created_at: new Date(),
      updated_at: new Date()
    });

    const schemas: SchemaCatalog = new Map([[schema.id, schema]]);
    const relationSchemas = new Map([[relationSchema.id, relationSchema]]);

    // Scalar predicate directly on the relation row.
    const scalarQuery: EntityQuery = {
      schemaId: relationSchema.id,
      root: { kind: 'predicate', path: [], fieldId: 'status', op: 'equals', value: 'active' }
    };
    const scalarValidation = validateEntityQueryIR(scalarQuery, schemas, null, relationSchemas);
    expect(scalarValidation.ok, JSON.stringify(scalarValidation)).toBe(true);
    const scalarCompiled = compileEntityQueryIR(
      scalarQuery,
      schemas,
      driver,
      workspace,
      {},
      null,
      relationSchemas
    );
    const scalarRows = await db.relation.runCompiledRelationQuery(
      scalarCompiled.sql,
      scalarCompiled.params
    );
    expect(scalarRows.map(row => row.id)).toEqual([matching.id]);
    expect(scalarRows[0]!.in_entity_name).toBe('A');
    expect(scalarRows[0]!.out_entity_name).toBe('B');

    // endpoint traversal: relations whose 'out' endpoint is named 'C'.
    const endpointQuery: EntityQuery = {
      schemaId: relationSchema.id,
      root: {
        kind: 'predicate',
        path: [{ kind: 'endpoint', direction: 'out' }],
        fieldId: '_name',
        op: 'equals',
        value: 'C'
      }
    };
    const endpointValidation = validateEntityQueryIR(endpointQuery, schemas, null, relationSchemas);
    expect(endpointValidation.ok, JSON.stringify(endpointValidation)).toBe(true);
    const endpointCompiled = compileEntityQueryIR(
      endpointQuery,
      schemas,
      driver,
      workspace,
      {},
      null,
      relationSchemas
    );
    const endpointRows = await db.relation.runCompiledRelationQuery(
      endpointCompiled.sql,
      endpointCompiled.params
    );
    expect(endpointRows.map(row => row.out_entity_id)).toEqual([entityC.id]);

    // An empty SQL visibility policy gates which relations are returned without materializing
    // the workspace's relation ids in application code.
    const gatedCompiled = compileEntityQueryIR(
      { schemaId: relationSchema.id, root: { kind: 'and', children: [] } },
      schemas,
      driver,
      workspace,
      {
        relationVisibility: {
          entitySchemaIds: [schema.id],
          endpointScopes: [],
          ownerIds: [],
          allOwners: false
        }
      },
      null,
      relationSchemas
    );
    const gatedRows = await db.relation.runCompiledRelationQuery(
      gatedCompiled.sql,
      gatedCompiled.params
    );
    expect(gatedRows).toHaveLength(0);

    const missingSchema = await createSchema(db, workspace, { name: 'Deleted endpoint schema' });
    const danglingEndpoint = await createFixtureCatalogEntity(db, workspace, missingSchema.id, {
      name: 'Dangling endpoint'
    });
    const danglingRelation = await db.relation.createRelation({
      id: randomUUID(),
      workspace,
      schema_id: relationSchema.id,
      in_entity_id: danglingEndpoint.id,
      out_entity_id: entityB.id,
      data: { status: 'dangling' },
      created_at: new Date(),
      updated_at: new Date()
    });
    await db.catalog.deleteSchema(workspace, missingSchema.id);

    const ownerWideCompiled = compileEntityQueryIR(
      { schemaId: relationSchema.id, root: { kind: 'and', children: [] } },
      schemas,
      driver,
      workspace,
      {
        relationVisibility: {
          entitySchemaIds: [schema.id],
          endpointScopes: [],
          ownerIds: [],
          allOwners: true
        }
      },
      null,
      relationSchemas
    );
    const ownerWideRows = await db.relation.runCompiledRelationQuery(
      ownerWideCompiled.sql,
      ownerWideCompiled.params
    );
    expect(ownerWideRows.map(row => row.id)).toEqual(expect.arrayContaining([matching.id]));
    expect(ownerWideRows.map(row => row.id)).not.toContain(danglingRelation.id);
  });

  it('lists relations through listRelationsWithCount using the relation-rooted query engine (#2689)', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schema = await createSchema(db, workspace, { name: 'System' });
    const relationSchema = await db.relation.createRelationSchema({
      id: randomUUID(),
      workspace,
      name: 'Depends On',
      description: '',
      in_schema_ids: [schema.id],
      out_schema_ids: [schema.id],
      fields: [{ id: 'status', name: 'Status', type: 'text' }],
      groups: [],
      shared_field_group_links: [],
      color: null,
      icon: null,
      relation_approval_policy: 'disabled',
      created_at: new Date(),
      updated_at: new Date()
    });
    const entityA = await createFixtureCatalogEntity(db, workspace, schema.id, { name: 'A' });
    const entityB = await createFixtureCatalogEntity(db, workspace, schema.id, { name: 'B' });
    await db.relation.createRelation({
      id: randomUUID(),
      workspace,
      schema_id: relationSchema.id,
      in_entity_id: entityA.id,
      out_entity_id: entityB.id,
      data: { status: 'active' },
      created_at: new Date(),
      updated_at: new Date()
    });

    const { listRelationsWithCount } = await import('../../domain/catalog/entityQueryOperations');
    const page = await listRelationsWithCount(db, workspace, null, {
      relationQuery: { schemaId: relationSchema.id, root: { kind: 'and', children: [] } }
    });
    expect(page.total).toBe(1);
    expect(page.items[0]!._schema.id).toBe(relationSchema.id);
    expect(page.items[0]!['status']).toBe('active');
  });

  it('paginates relation-rooted queries via SQL LIMIT/OFFSET with an accurate total across pages (#2700)', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schema = await createSchema(db, workspace, { name: 'System' });
    const relationSchema = await db.relation.createRelationSchema({
      id: randomUUID(),
      workspace,
      name: 'Depends On',
      description: '',
      in_schema_ids: [schema.id],
      out_schema_ids: [schema.id],
      fields: [],
      groups: [],
      shared_field_group_links: [],
      color: null,
      icon: null,
      relation_approval_policy: 'disabled',
      created_at: new Date(),
      updated_at: new Date()
    });
    const entities = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        createFixtureCatalogEntity(db, workspace, schema.id, { name: `E${i}` })
      )
    );
    for (let i = 0; i < 5; i++) {
      await db.relation.createRelation({
        id: randomUUID(),
        workspace,
        schema_id: relationSchema.id,
        in_entity_id: entities[i]!.id,
        out_entity_id: entities[i + 1]!.id,
        data: {},
        created_at: new Date(),
        updated_at: new Date()
      });
    }

    const { listRelationsWithCount } = await import('../../domain/catalog/entityQueryOperations');
    const relationQuery = {
      schemaId: relationSchema.id,
      root: { kind: 'and' as const, children: [] }
    };

    const firstPage = await listRelationsWithCount(db, workspace, null, {
      relationQuery,
      limit: 2,
      offset: 0
    });
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.total).toBe(5);

    const secondPage = await listRelationsWithCount(db, workspace, null, {
      relationQuery,
      limit: 2,
      offset: 2
    });
    expect(secondPage.items).toHaveLength(2);
    expect(secondPage.total).toBe(5);

    const lastPage = await listRelationsWithCount(db, workspace, null, {
      relationQuery,
      limit: 2,
      offset: 4
    });
    expect(lastPage.items).toHaveLength(1);
    expect(lastPage.total).toBe(5);

    // No overlap between pages, and every relation is reachable across pages.
    const allIds = new Set(
      [...firstPage.items, ...secondPage.items, ...lastPage.items].map(item => item._uid)
    );
    expect(allIds.size).toBe(5);

    const pastEnd = await listRelationsWithCount(db, workspace, null, {
      relationQuery,
      limit: 2,
      offset: 10
    });
    expect(pastEnd.items).toHaveLength(0);
    expect(pastEnd.total).toBe(5);
  });
});
