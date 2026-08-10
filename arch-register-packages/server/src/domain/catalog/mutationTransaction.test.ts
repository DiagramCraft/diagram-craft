import { describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityDbCreate, EntityDbResult } from './db/catalogDatabase';
import type { RelationDbResult } from './db/relationDatabase';
import { createEntityWithAudit, entityToBaseState } from './entityMutations';
import { deleteRelationWithAudit, createRelationWithAudit } from './relationMutations';
import { withCatalogMutationTransaction } from './mutationTransaction';

const now = new Date('2026-08-10T10:00:00.000Z');

const schema = {
  id: 'schema-1',
  workspace: 'ws-1',
  name: 'Service',
  description: '',
  fields: [],
  groups: [],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'SRV',
  created_at: now,
  updated_at: now
};

const entityInput: EntityDbCreate = {
  id: 'entity-1',
  workspace: 'ws-1',
  public_id: 'SRV-1',
  slug: 'service-1',
  namespace: 'default',
  name: 'Service 1',
  description: '',
  owner: null,
  lifecycle: null,
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: [],
  links: [],
  schema_id: schema.id,
  data: {},
  project_id: null,
  created_at: now,
  updated_at: now,
  completeness: 0
};

const relation = (overrides: Partial<RelationDbResult> = {}): RelationDbResult => ({
  id: 'relation-1',
  workspace: 'ws-1',
  schema_id: 'relation-schema-1',
  schema_name: 'Depends on',
  in_entity_id: 'entity-1',
  in_entity_name: 'Service 1',
  out_entity_id: 'entity-2',
  out_entity_name: 'Service 2',
  data: {},
  owner: null,
  owner_name: null,
  lifecycle: null,
  lifecycle_label: null,
  version: 1,
  approval_policy_override: null,
  created_at: now,
  updated_at: now,
  ...overrides
});

const makeDatabase = (options: { failAudit?: boolean; failOutbox?: boolean } = {}) => {
  const state = {
    entities: new Map<string, EntityDbResult>(),
    relations: new Map<string, RelationDbResult>(),
    versions: new Map<string, Record<string, unknown>>(),
    audits: 0,
    outboxJobs: 0
  };

  const catalog = {
    getSchema: async () => schema,
    createEntity: async (input: EntityDbCreate) => {
      const row = {
        ...input,
        version: input.version ?? 1,
        owner_name: null,
        lifecycle_label: null,
        target_lifecycle_label: null,
        schema_name: schema.name
      } as EntityDbResult;
      state.entities.set(row.id, row);
      return row;
    },
    createEntityVersion: async (input: Record<string, unknown>) => {
      state.versions.set(String(input.id), input);
      return input;
    },
    pruneAutosaveVersions: async () => {}
  };

  const relationDb = {
    createRelation: async (input: Record<string, unknown>) => {
      const row = relation(input as Partial<RelationDbResult>);
      state.relations.set(row.id, row);
      return row;
    },
    deleteRelation: async (_workspace: string, id: string) => {
      const row = state.relations.get(id) ?? null;
      if (row) state.relations.delete(id);
      return row;
    }
  };

  const audit = {
    createAuditLog: async () => {
      if (options.failAudit) throw new Error('audit failed');
      state.audits += 1;
      return { id: `audit-${state.audits}` };
    }
  };

  const jobs = {
    enqueueOneOffRun: async () => {
      if (options.failOutbox) throw new Error('outbox failed');
      state.outboxJobs += 1;
      return {};
    }
  };

  const root = {
    catalog,
    relation: relationDb,
    audit,
    jobs,
    core: undefined as unknown
  } as unknown as DatabaseAdapter;

  const transaction = async <T>(callback: (tx: DatabaseAdapter) => Promise<T>) => {
    const snapshot = {
      entities: new Map(state.entities),
      relations: new Map(state.relations),
      versions: new Map(state.versions),
      audits: state.audits,
      outboxJobs: state.outboxJobs
    };
    const tx = {
      ...root,
      core: {
        driver: 'sqlite' as const,
        isTransaction: true,
        close: async () => {},
        transaction: async <R>(nested: (db: DatabaseAdapter) => Promise<R>) => nested(tx)
      }
    } as unknown as DatabaseAdapter;
    try {
      return await callback(tx);
    } catch (error) {
      state.entities = snapshot.entities;
      state.relations = snapshot.relations;
      state.versions = snapshot.versions;
      state.audits = snapshot.audits;
      state.outboxJobs = snapshot.outboxJobs;
      throw error;
    }
  };

  root.core = {
    driver: 'sqlite',
    isTransaction: false,
    close: async () => {},
    transaction
  };

  return { db: root, state };
};

describe('catalog mutation transactions', () => {
  it('rolls back an entity, version, audit, and outbox job when audit fan-out enqueue fails', async () => {
    const { db, state } = makeDatabase({ failOutbox: true });

    await expect(
      withCatalogMutationTransaction(db, tx =>
        createEntityWithAudit(tx, {
          workspace: 'ws-1',
          entity: entityInput,
          actor: { id: 'user-1', displayName: 'User' }
        })
      )
    ).rejects.toThrow('outbox failed');

    expect(state.entities).toHaveLength(0);
    expect(state.versions).toHaveLength(0);
    expect(state.audits).toBe(0);
    expect(state.outboxJobs).toBe(0);
  });

  it('commits the entity, version, audit, and outbox job together on success', async () => {
    const { db, state } = makeDatabase();

    await withCatalogMutationTransaction(db, tx =>
      createEntityWithAudit(tx, {
        workspace: 'ws-1',
        entity: entityInput,
        actor: { id: 'user-1', displayName: 'User' }
      })
    );

    expect(state.entities).toHaveLength(1);
    expect(state.versions).toHaveLength(1);
    expect(state.audits).toBe(1);
    expect(state.outboxJobs).toBe(1);
  });

  it('rolls back a relation deletion and deleted version when audit insertion fails', async () => {
    const { db, state } = makeDatabase({ failAudit: true });
    const existing = relation();
    state.relations.set(existing.id, existing);

    await expect(
      withCatalogMutationTransaction(db, tx =>
        deleteRelationWithAudit(tx, {
          workspace: 'ws-1',
          relation: existing,
          actor: { id: 'user-1', displayName: 'User' },
          versionNumber: 2
        })
      )
    ).rejects.toThrow('audit failed');

    expect(state.relations.get(existing.id)).toEqual(existing);
    expect(state.versions).toHaveLength(0);
    expect(state.audits).toBe(0);
  });

  it('keeps relation creation and version history atomic with the audit outbox', async () => {
    const { db, state } = makeDatabase({ failAudit: true });

    await expect(
      withCatalogMutationTransaction(db, tx =>
        createRelationWithAudit(tx, {
          workspace: 'ws-1',
          relation: {
            id: 'relation-1',
            workspace: 'ws-1',
            schema_id: 'relation-schema-1',
            in_entity_id: 'entity-1',
            out_entity_id: 'entity-2',
            data: {},
            created_at: now,
            updated_at: now
          },
          actor: { id: 'user-1', displayName: 'User' }
        })
      )
    ).rejects.toThrow('audit failed');

    expect(state.relations).toHaveLength(0);
    expect(state.versions).toHaveLength(0);
    expect(state.audits).toBe(0);
    expect(state.outboxJobs).toBe(0);
  });

  it('serializes entity state using the same version snapshot written by the mutation', () => {
    expect(entityToBaseState({ ...entityInput, version: 3 } as never)).toMatchObject({
      id: entityInput.id,
      version: 3
    });
  });
});
