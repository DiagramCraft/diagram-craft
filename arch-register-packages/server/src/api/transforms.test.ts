import { describe, expect, it } from 'vitest';
import type { FileTree } from '@arch-register/api-types';
import type {
  AuditLogEntry,
  Entity,
  EntitySchema,
  Project,
  ProjectFile,
  Workspace,
  WorkspaceEnum,
  WorkspaceLifecycleState,
  WorkspaceMember,
  WorkspaceOwner,
  User,
} from '../types.js';
import {
  toApiAuditLogEntry,
  toApiEntity,
  toApiEntitySummary,
  toApiEnum,
  toApiLifecycleState,
  toApiOwnerOption,
  toApiProject,
  toApiProjectDetail,
  toApiProjectFile,
  toApiSchema,
  toApiWorkspace,
  toApiWorkspaceMember,
  toApiWorkspaceUser,
} from './transforms.js';

const now = new Date('2025-06-01T12:00:00.000Z');
const nowIso = '2025-06-01T12:00:00.000Z';

const baseEntity: Entity = {
  id: 'e-1',
  workspace: 'ws-1',
  slug: 'my-entity',
  namespace: 'ns',
  name: 'My Entity',
  description: 'A test entity',
  owner: 'team-a',
  lifecycle: 'prod',
  tags: ['a', 'b'],
  links: [{ url: 'https://example.com', title: 'Example' }],
  schema_id: 'schema-1',
  data: { custom: 'value' },
  visibility_mode: 'public',
  created_at: now,
  updated_at: now,
};

const baseProject: Project = {
  id: 'p-1',
  workspace: 'ws-1',
  name: 'My Project',
  description: 'desc',
  owner: null,
  status: 'active',
  color: '#ff0000',
  created_at: now,
  updated_at: now,
};

const baseProjectFile: ProjectFile = {
  id: 'f-1',
  workspace: 'ws-1',
  project_id: 'p-1',
  path: '/diagrams/main.dc',
  name: 'Main',
  size_bytes: 1024,
  comment_count: 2,
  unresolved_comment_count: 1,
  is_template: false,
  is_workspace_template: false,
  preview_svg: null,
  created_at: now,
  updated_at: now,
};

// ── toApiEntity ───────────────────────────────────────────────

describe('toApiEntity', () => {
  it('maps all standard fields', () => {
    const result = toApiEntity(baseEntity, null);
    expect(result._uid).toBe('e-1');
    expect(result._workspace).toBe('ws-1');
    expect(result._schemaId).toBe('schema-1');
    expect(result._name).toBe('My Entity');
    expect(result._slug).toBe('my-entity');
    expect(result._namespace).toBe('ns');
    expect(result._description).toBe('A test entity');
    expect(result._owner).toBe('team-a');
    expect(result._lifecycle).toBe('prod');
    expect(result._tags).toEqual(['a', 'b']);
    expect(result._visibilityMode).toBe('public');
  });

  it('spreads entity.data into the result', () => {
    const result = toApiEntity(baseEntity, null);
    expect(result.custom).toBe('value');
  });

  it('grants all capabilities when authCtx is null', () => {
    const result = toApiEntity(baseEntity, null);
    expect(result.canView).toBe(true);
    expect(result.canEdit).toBe(true);
    expect(result.canDelete).toBe(true);
    expect(result.canAdmin).toBe(true);
    expect(result.canCreateChild).toBe(true);
  });
});

describe('toApiEntitySummary', () => {
  it('maps standard fields without data spread', () => {
    const result = toApiEntitySummary(baseEntity, null);
    expect(result._uid).toBe('e-1');
    expect(result._name).toBe('My Entity');
    expect((result as Record<string, unknown>).custom).toBeUndefined();
  });

  it('grants all capabilities when authCtx is null', () => {
    const result = toApiEntitySummary(baseEntity, null);
    expect(result.canView).toBe(true);
  });
});

// ── toApiEnum ─────────────────────────────────────────────────

describe('toApiEnum', () => {
  it('maps fields and serializes dates to ISO strings', () => {
    const e: WorkspaceEnum = {
      id: 'enum-1',
      workspace: 'ws-1',
      name: 'Status',
      options: [{ value: 'active', label: 'Active' }],
      sort_order: 0,
      created_at: now,
      updated_at: now,
    };
    const result = toApiEnum(e);
    expect(result.id).toBe('enum-1');
    expect(result.options).toEqual([{ value: 'active', label: 'Active' }]);
    expect(result.created_at).toBe(nowIso);
    expect(result.updated_at).toBe(nowIso);
  });
});

// ── toApiSchema ───────────────────────────────────────────────

describe('toApiSchema', () => {
  const baseEnum: WorkspaceEnum = {
    id: 'enum-env',
    workspace: 'ws-1',
    name: 'Env',
    options: [{ value: 'prod', label: 'Production' }],
    sort_order: 0,
    created_at: now,
    updated_at: now,
  };

  const schema: EntitySchema = {
    id: 'schema-1',
    workspace: 'ws-1',
    name: 'Application',
    description: 'desc',
    fields: [
      { id: 'env', name: 'Env', type: 'select', enumId: 'enum-env' },
      { id: 'notes', name: 'Notes', type: 'text' },
      { id: 'go_live', name: 'Go Live', type: 'date' },
    ],
    color: null,
    icon: null,
    default_owner: null,
    created_at: now,
    updated_at: now,
  };

  it('resolves options for select fields', () => {
    const result = toApiSchema(schema, 5, [baseEnum]);
    const envField = result.fields.find(f => f.id === 'env') as Record<string, unknown>;
    expect(envField?.options).toEqual([{ value: 'prod', label: 'Production' }]);
  });

  it('falls back to empty options when enum is missing', () => {
    const result = toApiSchema(schema, 5, []);
    const envField = result.fields.find(f => f.id === 'env') as Record<string, unknown>;
    expect(envField?.options).toEqual([]);
  });

  it('leaves non-select fields unchanged', () => {
    const result = toApiSchema(schema, 5, []);
    const notesField = result.fields.find(f => f.id === 'notes');
    expect(notesField).toEqual({ id: 'notes', name: 'Notes', type: 'text' });
  });

  it('passes through date fields unchanged', () => {
    const result = toApiSchema(schema, 5, []);
    const dateField = result.fields.find(f => f.id === 'go_live');
    expect(dateField).toEqual({ id: 'go_live', name: 'Go Live', type: 'date' });
  });

  it('includes entity count and serializes dates', () => {
    const result = toApiSchema(schema, 42, []);
    expect(result.entity_count).toBe(42);
    expect(result.created_at).toBe(nowIso);
  });
});

// ── toApiProject ──────────────────────────────────────────────

describe('toApiProject', () => {
  it('maps fields and serializes dates', () => {
    const result = toApiProject(baseProject, 7, null);
    expect(result.id).toBe('p-1');
    expect(result.file_count).toBe(7);
    expect(result.created_at).toBe(nowIso);
    expect(result.updated_at).toBe(nowIso);
  });
});

// ── toApiProjectFile ──────────────────────────────────────────

describe('toApiProjectFile', () => {
  it('maps all fields and serializes dates', () => {
    const result = toApiProjectFile(baseProjectFile);
    expect(result.id).toBe('f-1');
    expect(result.project_id).toBe('p-1');
    expect(result.size_bytes).toBe(1024);
    expect(result.comment_count).toBe(2);
    expect(result.unresolved_comment_count).toBe(1);
    expect(result.is_template).toBe(false);
    expect(result.created_at).toBe(nowIso);
  });
});

// ── toApiProjectDetail ────────────────────────────────────────

describe('toApiProjectDetail', () => {
  it('counts root files', () => {
    const files: FileTree = { folders: [], rootFiles: [baseProjectFile as unknown as import('@arch-register/api-types').ProjectFile, baseProjectFile as unknown as import('@arch-register/api-types').ProjectFile] };
    const result = toApiProjectDetail(baseProject, files, null);
    expect(result.file_count).toBe(2);
  });

  it('counts files in folders', () => {
    const folder = { path: '/diagrams', files: [baseProjectFile as unknown as import('@arch-register/api-types').ProjectFile, baseProjectFile as unknown as import('@arch-register/api-types').ProjectFile] };
    const files: FileTree = { folders: [folder], rootFiles: [] };
    const result = toApiProjectDetail(baseProject, files, null);
    expect(result.file_count).toBe(2);
  });

  it('sums files across folders and root', () => {
    const folder = { path: '/diagrams', files: [baseProjectFile as unknown as import('@arch-register/api-types').ProjectFile] };
    const files: FileTree = { folders: [folder], rootFiles: [baseProjectFile as unknown as import('@arch-register/api-types').ProjectFile] };
    const result = toApiProjectDetail(baseProject, files, null);
    expect(result.file_count).toBe(2);
  });
});

// ── toApiWorkspace ────────────────────────────────────────────

describe('toApiWorkspace', () => {
  it('maps all fields and serializes dates', () => {
    const ws: Workspace = { id: 'ws-1', name: 'Acme', url_slug: 'acme', short_code: 'ACM', color: '#fff', description: 'desc', created_at: now, updated_at: now };
    const result = toApiWorkspace(ws);
    expect(result.id).toBe('ws-1');
    expect(result.url_slug).toBe('acme');
    expect(result.created_at).toBe(nowIso);
  });
});

// ── toApiLifecycleState ───────────────────────────────────────

describe('toApiLifecycleState', () => {
  it('maps all fields', () => {
    const state: WorkspaceLifecycleState = { id: 'prod', workspace: 'ws-1', label: 'Production', color: '#green', sort_order: 1, created_at: now };
    const result = toApiLifecycleState(state);
    expect(result).toEqual({ id: 'prod', label: 'Production', color: '#green', sort_order: 1 });
  });
});

// ── toApiOwnerOption ──────────────────────────────────────────

describe('toApiOwnerOption', () => {
  it('maps id and sort_order', () => {
    const owner: WorkspaceOwner = { id: 'team-a', workspace: 'ws-1', sort_order: 3, color: null, description: '', created_at: now };
    const result = toApiOwnerOption(owner);
    expect(result).toEqual({ id: 'team-a', sort_order: 3 });
  });
});

// ── toApiWorkspaceMember ──────────────────────────────────────

describe('toApiWorkspaceMember', () => {
  it('merges member and user data', () => {
    const member: WorkspaceMember = { workspace: 'ws-1', user_id: 'u-1', role: 'editor', created_at: now };
    const user: User = { id: 'u-1', email: 'a@b.com', display_name: 'Alice', auth_provider: 'local', password_hash: null, oidc_issuer: null, oidc_subject: null, is_active: true, color: null, created_at: now, updated_at: now, last_login_at: null };
    const result = toApiWorkspaceMember(member, user);
    expect(result.user_id).toBe('u-1');
    expect(result.display_name).toBe('Alice');
    expect(result.email).toBe('a@b.com');
    expect(result.role).toBe('editor');
    expect(result.created_at).toBe(nowIso);
  });
});

// ── toApiWorkspaceUser ────────────────────────────────────────

describe('toApiWorkspaceUser', () => {
  it('maps user fields', () => {
    const user: User = { id: 'u-2', email: 'b@c.com', display_name: 'Bob', auth_provider: 'oidc', password_hash: null, oidc_issuer: null, oidc_subject: null, is_active: false, color: null, created_at: now, updated_at: now, last_login_at: null };
    const result = toApiWorkspaceUser(user);
    expect(result.id).toBe('u-2');
    expect(result.email).toBe('b@c.com');
    expect(result.is_active).toBe(false);
    expect(result.auth_provider).toBe('oidc');
  });
});

// ── toApiAuditLogEntry ────────────────────────────────────────

describe('toApiAuditLogEntry', () => {
  it('maps all fields and serializes timestamp', () => {
    const entry: AuditLogEntry = {
      id: 'audit-1',
      workspace: 'ws-1',
      timestamp: now,
      user_id: 'u-1',
      operation: 'create',
      entity_type: 'entity',
      entity_id: 'e-1',
      entity_name: 'My Entity',
      entity_slug: 'my-entity',
      schema_id: 'schema-1',
      changes: { new: { name: 'My Entity' } },
      metadata: {},
    };
    const result = toApiAuditLogEntry(entry);
    expect(result.id).toBe('audit-1');
    expect(result.timestamp).toBe(nowIso);
    expect(result.operation).toBe('create');
    expect(result.changes).toEqual({ new: { name: 'My Entity' } });
  });
});
