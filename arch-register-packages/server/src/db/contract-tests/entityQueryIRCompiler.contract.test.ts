import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFixtureWorkspace, createFixtureProject } from './projectFixtures';
import { createFixtureCatalogEntity } from './catalogFixtures';
import type { DatabaseAdapter, DbDriver } from '../database';
import type { SchemaDbResult } from '../../domain/catalog/db/catalogDatabase';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { compileEntityQueryIR } from '../../domain/catalog/entityQueryIRCompiler';
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
  query: EntityQuery
) => {
  const validation = validateEntityQueryIR(query, schemas);
  expect(validation.ok, JSON.stringify(validation)).toBe(true);
  const { sql, params } = compileEntityQueryIR(query, schemas, driver, workspace);
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
    const schema = await createSchema(db, workspace, { name: 'Technology' });

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
});
