import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter } from '../../db/database';
import { listDocumentBacklinks } from './markdownListingOperations';

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

type DocLink = {
  workspace: string;
  node_id: string;
  field_id: string;
  target_type: 'entity' | 'document';
  target_id: string;
  position: number;
};

const makeDb = (
  nodesById: Record<string, ReturnType<typeof makeNode>>,
  links: DocLink[],
  metadataByNode: Record<
    string,
    { document_type_id: string | null; values: Record<string, unknown> }
  > = {},
  documentTypes: Record<
    string,
    {
      id: string;
      name: string;
      color: string | null;
      icon: string | null;
      fields: Array<{ id: string; name: string; inverseName?: string; retired?: boolean }>;
    }
  > = {},
  projectsById: Record<string, { owner: string }> = {}
) =>
  ({
    project: {
      getAnyContentNodeById: vi.fn(async (_ws: string, id: string) => nodesById[id] ?? null),
      getProject: vi.fn(async (_ws: string, id: string) => projectsById[id] ?? null)
    },
    document: {
      listDocumentsLinkingDocument: vi.fn(async (_ws: string, documentId: string) =>
        links.filter(link => link.target_type === 'document' && link.target_id === documentId)
      ),
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

describe('listDocumentBacklinks', () => {
  beforeEach(() => {
    requireWorkspaceCapability.mockReset().mockImplementation(() => undefined);
    requireProjectAccess.mockReset().mockImplementation(() => undefined);
  });

  it('lists accessible documents linking to the target document, with the inverse label', async () => {
    const older = makeNode({ id: 'adr-1', name: 'ADR-1' });
    const newer = makeNode({ id: 'adr-2', name: 'ADR-2' });
    const db = makeDb(
      { 'adr-1': older, 'adr-2': newer },
      [
        {
          workspace: 'ws-1',
          node_id: 'adr-2',
          field_id: 'supersedes',
          target_type: 'document',
          target_id: 'adr-1',
          position: 0
        }
      ],
      { 'adr-2': { document_type_id: 'type-1', values: { supersedes: ['adr-1'] } } },
      {
        'type-1': {
          id: 'type-1',
          name: 'ADR',
          color: '#fff',
          icon: 'file',
          fields: [{ id: 'supersedes', name: 'Supersedes', inverseName: 'Superseded by' }]
        }
      }
    );

    const result = await listDocumentBacklinks(db, 'ws-1', 'adr-1', event);

    expect(result).toEqual([
      expect.objectContaining({
        field_id: 'supersedes',
        field_name: 'Supersedes',
        field_inverse_name: 'Superseded by',
        document_type_name: 'ADR'
      })
    ]);
    expect(result[0]?.file.id).toBe('adr-2');
  });

  it('silently excludes a linking document the caller cannot view', async () => {
    const target = makeNode({ id: 'target' });
    const hiddenSource = makeNode({ id: 'hidden', project_id: 'proj-1' });
    const db = makeDb(
      { target, hidden: hiddenSource },
      [
        {
          workspace: 'ws-1',
          node_id: 'hidden',
          field_id: 'related',
          target_type: 'document',
          target_id: 'target',
          position: 0
        }
      ],
      {},
      {},
      { 'proj-1': { owner: 'team-1' } }
    );
    requireProjectAccess.mockImplementation(() => {
      throw new Error('forbidden');
    });

    const result = await listDocumentBacklinks(db, 'ws-1', 'target', event);

    expect(result).toEqual([]);
  });

  it('falls back to the field id and null inverse name when the field cannot be resolved', async () => {
    const target = makeNode({ id: 'target' });
    const source = makeNode({ id: 'source' });
    const db = makeDb({ target, source }, [
      {
        workspace: 'ws-1',
        node_id: 'source',
        field_id: 'unknown_field',
        target_type: 'document',
        target_id: 'target',
        position: 0
      }
    ]);

    const result = await listDocumentBacklinks(db, 'ws-1', 'target', event);

    expect(result).toEqual([
      expect.objectContaining({
        field_id: 'unknown_field',
        field_name: 'unknown_field',
        field_inverse_name: null,
        document_type_id: null
      })
    ]);
  });

  it('resolves retired fields by id rather than dropping their label', async () => {
    const target = makeNode({ id: 'target' });
    const source = makeNode({ id: 'source' });
    const db = makeDb(
      { target, source },
      [
        {
          workspace: 'ws-1',
          node_id: 'source',
          field_id: 'old_field',
          target_type: 'document',
          target_id: 'target',
          position: 0
        }
      ],
      { source: { document_type_id: 'type-1', values: {} } },
      {
        'type-1': {
          id: 'type-1',
          name: 'ADR',
          color: null,
          icon: null,
          fields: [{ id: 'old_field', name: 'Old field (retired)', retired: true }]
        }
      }
    );

    const result = await listDocumentBacklinks(db, 'ws-1', 'target', event);

    expect(result).toEqual([
      expect.objectContaining({ field_id: 'old_field', field_name: 'Old field (retired)' })
    ]);
  });
});
