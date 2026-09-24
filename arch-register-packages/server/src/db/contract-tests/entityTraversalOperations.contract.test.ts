import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import {
  createFixtureEntity,
  createFixtureProject,
  createFixtureSchema,
  createFixtureWorkspace
} from '../testSupport/fixtures';
import { resolveTraversalRootEntityIds } from '../../domain/catalog/entityTraversalOperations';
import type { DatabaseAdapter } from '../database';

const createFixtureRelationSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  inSchemaIds: string[],
  outSchemaIds: string[]
) => {
  const id = randomUUID();
  const now = new Date();
  await db.relation.createRelationSchema({
    id,
    workspace,
    name: `Relation schema ${id}`,
    description: '',
    in_schema_ids: inSchemaIds,
    out_schema_ids: outSchemaIds,
    fields: [],
    groups: [],
    shared_field_group_links: [],
    color: null,
    icon: null,
    relation_approval_policy: 'disabled',
    unique_endpoint_pair: false,
    created_at: now,
    updated_at: now
  });
  return id;
};

runContractSuiteAgainstBothDrivers('resolveTraversalRootEntityIds', getDb => {
  it('resolves a relation subject to both endpoints', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const appSchema = await createFixtureSchema(db, workspace);
    const dbSchema = await createFixtureSchema(db, workspace);
    const relationSchemaId = await createFixtureRelationSchema(
      db,
      workspace,
      [appSchema],
      [dbSchema]
    );
    const app = await createFixtureEntity(db, workspace, appSchema, { name: 'App' });
    const database = await createFixtureEntity(db, workspace, dbSchema, { name: 'Database' });
    const now = new Date();
    const relation = await db.relation.createRelation({
      id: randomUUID(),
      workspace,
      schema_id: relationSchemaId,
      in_entity_id: app.id,
      out_entity_id: database.id,
      data: {},
      created_at: now,
      updated_at: now
    });

    const ids = await resolveTraversalRootEntityIds(db, workspace, {
      kind: 'relation',
      relationId: relation.id
    });

    expect(new Set(ids)).toEqual(new Set([app.id, database.id]));
  });

  it('resolves a change-case subject to the entities touched by its active revision', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schema = await createFixtureSchema(db, workspace);
    const project = await createFixtureProject(db, workspace);
    const entityA = await createFixtureEntity(db, workspace, schema);
    const entityB = await createFixtureEntity(db, workspace, schema);

    const changeCase = await db.changeCase.createCase({
      id: randomUUID(),
      workspace,
      project_id: project.id,
      name: 'Split the service',
      description: null,
      effective_date: '2026-09-01',
      milestone_id: null,
      message: null,
      created_by: null,
      created_at: new Date(),
      members: [entityA, entityB].map(entity => ({
        entity_id: entity.id,
        base_version: 1,
        base_state: { id: entity.id },
        proposed_state: { id: entity.id, name: 'renamed' },
        diff: {}
      }))
    });

    const ids = await resolveTraversalRootEntityIds(db, workspace, {
      kind: 'changeCase',
      caseId: changeCase.id
    });

    expect(new Set(ids)).toEqual(new Set([entityA.id, entityB.id]));
  });

  it('returns an empty root set for a change case with no members', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const project = await createFixtureProject(db, workspace);

    const changeCase = await db.changeCase.createCase({
      id: randomUUID(),
      workspace,
      project_id: project.id,
      name: null,
      description: null,
      effective_date: '2026-09-01',
      milestone_id: null,
      message: null,
      created_by: null,
      created_at: new Date(),
      members: []
    });

    const ids = await resolveTraversalRootEntityIds(db, workspace, {
      kind: 'changeCase',
      caseId: changeCase.id
    });

    expect(ids).toEqual([]);
  });
});
