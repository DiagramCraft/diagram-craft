import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter } from '../../db/database';
import { listDocuments } from './markdownListingOperations';

const { requireWorkspaceCapability, requireProjectAccess } = vi.hoisted(() => ({
  requireWorkspaceCapability: vi.fn(),
  requireProjectAccess: vi.fn()
}));

vi.mock('../auth/authorization', () => ({
  buildApiAuthCtx: vi.fn(async () => ({ userId: 'user-1' })),
  requireEntityAction: vi.fn(),
  requireProjectAccess,
  requireProjectAction: vi.fn(),
  requireWorkspaceCapability
}));

vi.mock('../workspace/resolveWorkspace', () => ({
  resolveWorkspace: vi.fn(async () => 'ws-1')
}));

const event = { context: { user: { id: 'user-1' } } } as unknown as AuthenticatedEvent;

const baseNode: {
  id: string;
  workspace: string;
  project_id: string | null;
  entity_id: string | null;
  parent_id: string | null;
  mount_id: string | null;
  path: string;
  name: string;
  role: string | null;
  type: 'markdown';
  size_bytes: number;
  comment_count: number;
  unresolved_comment_count: number;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by: string;
} = {
  id: 'node',
  workspace: 'ws-1',
  project_id: null,
  entity_id: null,
  parent_id: null,
  mount_id: null,
  path: 'doc.md',
  name: 'doc',
  role: null,
  type: 'markdown',
  size_bytes: 0,
  comment_count: 0,
  unresolved_comment_count: 0,
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z'),
  created_by: 'user-1',
  updated_by: 'user-1'
};

type NodeOverrides = Partial<typeof baseNode>;

const makeNode = (overrides: NodeOverrides) => ({ ...baseNode, ...overrides });

const makeDb = (
  nodes: ReturnType<typeof makeNode>[],
  metadataByNode: Record<
    string,
    { document_type_id: string | null; values: Record<string, unknown> }
  >,
  documentTypes: Record<
    string,
    { id: string; name: string; color: string | null; icon: string | null; fields: unknown[] }
  >,
  projectsById: Record<string, { owner: string; id?: string }> = {},
  entitiesById: Record<string, { id: string }> = {}
) =>
  ({
    project: {
      listAllContentNodes: vi.fn(async () => nodes),
      getProject: vi.fn(async (_ws: string, id: string) => {
        const project = projectsById[id];
        return project ? { ...project, id: project.id ?? id } : null;
      })
    },
    catalog: {
      getEntity: vi.fn(async (_ws: string, id: string) => entitiesById[id] ?? null)
    },
    document: {
      getDocumentMetadata: vi.fn(async (_ws: string, nodeId: string) => {
        const meta = metadataByNode[nodeId];
        if (!meta) return null;
        return {
          workspace: 'ws-1',
          node_id: nodeId,
          document_type_id: meta.document_type_id,
          values: meta.values,
          updated_at: new Date()
        };
      }),
      getDocumentType: vi.fn(async (_ws: string, id: string) => documentTypes[id] ?? null)
    }
  }) as unknown as DatabaseAdapter;

describe('listDocuments', () => {
  beforeEach(() => {
    requireWorkspaceCapability.mockReset().mockImplementation(() => undefined);
    requireProjectAccess.mockReset().mockImplementation(() => undefined);
  });

  it('lists untyped and typed documents across workspace, project, and entity scopes', async () => {
    const nodes = [
      makeNode({ id: 'ws-doc', name: 'Workspace Doc' }),
      makeNode({ id: 'proj-doc', name: 'Project Doc', project_id: 'proj-1' }),
      makeNode({ id: 'ent-doc', name: 'Entity Doc', entity_id: 'entity-1' })
    ];
    const db = makeDb(
      nodes,
      { 'proj-doc': { document_type_id: 'type-1', values: { status: 'active' } } },
      { 'type-1': { id: 'type-1', name: 'ADR', color: '#fff', icon: 'file', fields: [] } },
      { 'proj-1': { owner: 'team-1' } }
    );

    const result = await listDocuments(db, 'ws-1', {}, event);

    expect(result.map(r => r.file.id).sort()).toEqual(['ent-doc', 'proj-doc', 'ws-doc']);
    const projDoc = result.find(r => r.file.id === 'proj-doc');
    expect(projDoc).toMatchObject({
      scope: 'project',
      document_type_id: 'type-1',
      document_type_name: 'ADR',
      metadata: { status: 'active' }
    });
    const wsDoc = result.find(r => r.file.id === 'ws-doc');
    expect(wsDoc).toMatchObject({ scope: 'workspace', document_type_id: null });
  });

  it('silently excludes documents the caller cannot view', async () => {
    const nodes = [
      makeNode({ id: 'visible', name: 'Visible' }),
      makeNode({ id: 'hidden', name: 'Hidden', project_id: 'proj-1' })
    ];
    const db = makeDb(nodes, {}, {}, { 'proj-1': { owner: 'team-1' } });
    requireProjectAccess.mockImplementation(() => {
      throw new Error('forbidden');
    });

    const result = await listDocuments(db, 'ws-1', {}, event);

    expect(result.map(r => r.file.id)).toEqual(['visible']);
  });

  it('filters by text search on title', async () => {
    const nodes = [
      makeNode({ id: 'a', name: 'Architecture Overview' }),
      makeNode({ id: 'b', name: 'Runbook' })
    ];
    const db = makeDb(nodes, {}, {});

    const result = await listDocuments(db, 'ws-1', { q: 'arch' }, event);

    expect(result.map(r => r.file.id)).toEqual(['a']);
  });

  it('filters to untyped documents when document_type_id is "none"', async () => {
    const nodes = [makeNode({ id: 'typed' }), makeNode({ id: 'untyped' })];
    const db = makeDb(
      nodes,
      { typed: { document_type_id: 'type-1', values: {} } },
      { 'type-1': { id: 'type-1', name: 'ADR', color: null, icon: null, fields: [] } }
    );

    const result = await listDocuments(db, 'ws-1', { documentTypeId: 'none' }, event);

    expect(result.map(r => r.file.id)).toEqual(['untyped']);
  });

  it('filters by scope, project id, and entity id', async () => {
    const nodes = [
      makeNode({ id: 'proj-a', project_id: 'proj-1' }),
      makeNode({ id: 'proj-b', project_id: 'proj-2' }),
      makeNode({ id: 'ent-a', entity_id: 'entity-1' })
    ];
    const db = makeDb(nodes, {}, {}, { 'proj-1': { owner: 't' }, 'proj-2': { owner: 't' } });

    expect(
      (await listDocuments(db, 'ws-1', { scope: 'entity' }, event)).map(r => r.file.id)
    ).toEqual(['ent-a']);
    expect(
      (await listDocuments(db, 'ws-1', { projectId: 'proj-2' }, event)).map(r => r.file.id)
    ).toEqual(['proj-b']);
  });

  it('resolves public project and entity identifiers before filtering', async () => {
    const nodes = [
      makeNode({ id: 'project-doc', project_id: 'project-internal' }),
      makeNode({ id: 'entity-doc', entity_id: 'entity-internal' })
    ];
    const db = makeDb(
      nodes,
      {},
      {},
      {
        'project-public': { id: 'project-internal', owner: 'team-1' },
        'project-internal': { id: 'project-internal', owner: 'team-1' }
      },
      { 'entity-public': { id: 'entity-internal' } }
    );

    expect(
      (await listDocuments(db, 'ws-1', { projectId: 'project-public' }, event)).map(
        result => result.file.id
      )
    ).toEqual(['project-doc']);
    expect(
      (await listDocuments(db, 'ws-1', { entityId: 'entity-public' }, event)).map(
        result => result.file.id
      )
    ).toEqual(['entity-doc']);
  });

  it('filters by metadata field conditions', async () => {
    const nodes = [makeNode({ id: 'a' }), makeNode({ id: 'b' })];
    const db = makeDb(
      nodes,
      {
        a: { document_type_id: 'type-1', values: { status: 'approved' } },
        b: { document_type_id: 'type-1', values: { status: 'draft' } }
      },
      { 'type-1': { id: 'type-1', name: 'ADR', color: null, icon: null, fields: [] } }
    );

    const result = await listDocuments(
      db,
      'ws-1',
      { conditions: [{ fieldId: 'status', op: 'equals', value: 'approved' }] },
      event
    );

    expect(result.map(r => r.file.id)).toEqual(['a']);
  });

  it('sorts by title, updated date, and metadata field', async () => {
    const nodes = [
      makeNode({ id: 'b', name: 'Bravo', updated_at: new Date('2024-01-02T00:00:00Z') }),
      makeNode({ id: 'a', name: 'Alpha', updated_at: new Date('2024-01-01T00:00:00Z') })
    ];
    const db = makeDb(nodes, {}, {});

    const byTitle = await listDocuments(db, 'ws-1', { sort: 'title' }, event);
    expect(byTitle.map(r => r.file.id)).toEqual(['a', 'b']);

    const byUpdatedDesc = await listDocuments(
      db,
      'ws-1',
      { sort: 'updated_at', sortDir: 'desc' },
      event
    );
    expect(byUpdatedDesc.map(r => r.file.id)).toEqual(['b', 'a']);
  });

  it('caps results at the requested limit, defaulting to 100', async () => {
    const nodes = Array.from({ length: 150 }, (_, i) =>
      makeNode({ id: `doc-${i}`, name: `Doc ${i}` })
    );
    const db = makeDb(nodes, {}, {});

    const defaultResult = await listDocuments(db, 'ws-1', {}, event);
    expect(defaultResult).toHaveLength(100);

    const limited = await listDocuments(db, 'ws-1', { limit: 5 }, event);
    expect(limited).toHaveLength(5);
  });
});
