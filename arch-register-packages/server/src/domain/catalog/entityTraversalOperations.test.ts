import { describe, expect, it, vi } from 'vitest';
import { HTTPError } from 'h3';
import type { DatabaseAdapter } from '../../db/database';
import { resolveTraversalRootEntityIds } from './entityTraversalOperations';
import type { Entity } from './db/catalogDatabase';
import type { RelationDbResult } from './db/relationDatabase';
import type { ChangeCaseDbResult, ChangeCaseMemberDbResult } from './db/changeCaseDatabase';

const ws = 'ws-1';

const makeEntity = (id: string): Entity => ({ id, workspace: ws }) as Entity;

const makeRelation = (id: string, overrides: Partial<RelationDbResult> = {}): RelationDbResult =>
  ({
    id,
    workspace: ws,
    in_entity_id: 'entity-in',
    out_entity_id: 'entity-out',
    ...overrides
  }) as RelationDbResult;

const makeDb = (overrides: {
  getEntity?: (id: string) => Promise<Entity | null>;
  getRelation?: (id: string) => Promise<RelationDbResult | null>;
  getCase?: (caseId: string) => Promise<ChangeCaseDbResult | null>;
  getActiveRevision?: (caseId: string) => Promise<{ id: string } | null>;
  listMembers?: (revisionId: string) => Promise<ChangeCaseMemberDbResult[]>;
}) =>
  ({
    catalog: {
      getEntity: vi.fn((_ws: string, id: string) => (overrides.getEntity ?? (async () => null))(id))
    },
    relation: {
      getRelation: vi.fn((_ws: string, id: string) =>
        (overrides.getRelation ?? (async () => null))(id)
      )
    },
    changeCase: {
      getCase: vi.fn((_ws: string, caseId: string) =>
        (overrides.getCase ?? (async () => null))(caseId)
      ),
      getActiveRevision: vi.fn((_ws: string, caseId: string) =>
        (overrides.getActiveRevision ?? (async () => null))(caseId)
      ),
      listMembers: vi.fn((_ws: string, revisionId: string) =>
        (overrides.listMembers ?? (async () => []))(revisionId)
      )
    }
  }) as unknown as DatabaseAdapter;

describe('resolveTraversalRootEntityIds', () => {
  it('resolves an entity subject to itself', async () => {
    const db = makeDb({ getEntity: async id => makeEntity(id) });
    const ids = await resolveTraversalRootEntityIds(db, ws, {
      kind: 'entity',
      entityId: 'entity-1'
    });
    expect(ids).toEqual(['entity-1']);
  });

  it('404s when the entity subject does not exist', async () => {
    const db = makeDb({});
    await expect(
      resolveTraversalRootEntityIds(db, ws, { kind: 'entity', entityId: 'missing' })
    ).rejects.toMatchObject({ status: 404 } satisfies Partial<HTTPError>);
  });

  it('resolves a relation subject to both endpoints', async () => {
    const db = makeDb({
      getRelation: async id =>
        makeRelation(id, { in_entity_id: 'entity-a', out_entity_id: 'entity-b' })
    });
    const ids = await resolveTraversalRootEntityIds(db, ws, {
      kind: 'relation',
      relationId: 'relation-1'
    });
    expect(ids).toEqual(['entity-a', 'entity-b']);
  });

  it('404s when the relation subject does not exist', async () => {
    const db = makeDb({});
    await expect(
      resolveTraversalRootEntityIds(db, ws, { kind: 'relation', relationId: 'missing' })
    ).rejects.toMatchObject({ status: 404 } satisfies Partial<HTTPError>);
  });

  it('resolves a change-case subject to the entities/relations touched by its members', async () => {
    const db = makeDb({
      getCase: async caseId => ({ id: caseId }) as ChangeCaseDbResult,
      getActiveRevision: async () => ({ id: 'revision-1' }),
      listMembers: async () => [
        { entity_id: 'entity-1' } as ChangeCaseMemberDbResult,
        { entity_id: 'relation-1' } as ChangeCaseMemberDbResult
      ],
      getEntity: async id => (id === 'entity-1' ? makeEntity(id) : null),
      getRelation: async id =>
        id === 'relation-1'
          ? makeRelation(id, { in_entity_id: 'entity-a', out_entity_id: 'entity-b' })
          : null
    });
    const ids = await resolveTraversalRootEntityIds(db, ws, {
      kind: 'changeCase',
      caseId: 'case-1'
    });
    expect(new Set(ids)).toEqual(new Set(['entity-1', 'entity-a', 'entity-b']));
  });

  it('returns an empty root set for a change case with no members, without erroring', async () => {
    const db = makeDb({
      getCase: async caseId => ({ id: caseId }) as ChangeCaseDbResult,
      getActiveRevision: async () => ({ id: 'revision-1' }),
      listMembers: async () => []
    });
    const ids = await resolveTraversalRootEntityIds(db, ws, {
      kind: 'changeCase',
      caseId: 'case-1'
    });
    expect(ids).toEqual([]);
  });

  it('404s when the change case does not exist', async () => {
    const db = makeDb({});
    await expect(
      resolveTraversalRootEntityIds(db, ws, { kind: 'changeCase', caseId: 'missing' })
    ).rejects.toMatchObject({ status: 404 } satisfies Partial<HTTPError>);
  });

  it('409s when the change case has no active revision', async () => {
    const db = makeDb({
      getCase: async caseId => ({ id: caseId }) as ChangeCaseDbResult,
      getActiveRevision: async () => null
    });
    await expect(
      resolveTraversalRootEntityIds(db, ws, { kind: 'changeCase', caseId: 'case-1' })
    ).rejects.toMatchObject({ status: 409 } satisfies Partial<HTTPError>);
  });
});
