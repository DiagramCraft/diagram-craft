import { describe, expect, it } from 'vitest';
import {
  toApiLifecycleState,
  toApiOwnerOption,
  toApiWorkspace,
  toApiWorkspaceMember,
  toApiWorkspaceUser
} from './workspaceHelpers';
import { WorkspaceMemberRow, WorkspaceRow, WorkspaceOwnerRow } from './db/workspaceDatabase';
import { WorkspaceLifecycleStateRow } from './db/workspaceDatabase';
import { UserRow } from '../auth/db/authDatabase';

const now = new Date('2025-06-01T12:00:00.000Z');
const nowIso = '2025-06-01T12:00:00.000Z';

// ── toApiWorkspace ────────────────────────────────────────────

describe('toApiWorkspace', () => {
  it('maps all fields and serializes dates', () => {
    const ws: WorkspaceRow = {
      id: 'ws-1',
      name: 'Acme',
      url_slug: 'acme',
      short_code: 'ACM',
      color: '#fff',
      description: 'desc',
      created_at: now,
      updated_at: now
    };
    const result = toApiWorkspace(ws);
    expect(result.id).toBe('ws-1');
    expect(result.url_slug).toBe('acme');
    expect(result.created_at).toBe(nowIso);
  });
});

// ── toApiLifecycleState ───────────────────────────────────────

describe('toApiLifecycleState', () => {
  it('maps all fields', () => {
    const state: WorkspaceLifecycleStateRow = {
      id: 'prod',
      workspace: 'ws-1',
      label: 'Production',
      color: '#green',
      sort_order: 1,
      created_at: now
    };
    const result = toApiLifecycleState(state);
    expect(result).toEqual({ id: 'prod', label: 'Production', color: '#green', sort_order: 1 });
  });
});

// ── toApiOwnerOption ──────────────────────────────────────────

describe('toApiOwnerOption', () => {
  it('maps id and sort_order', () => {
    const owner: WorkspaceOwnerRow = {
      id: 'team-a',
      workspace: 'ws-1',
      name: 'Team A',
      sort_order: 3,
      color: null,
      description: '',
      created_at: now
    };
    const result = toApiOwnerOption(owner);
    expect(result).toEqual({
      id: 'team-a',
      name: 'Team A',
      sort_order: 3,
      color: null,
      description: ''
    });
  });
});

// ── toApiWorkspaceMember ──────────────────────────────────────

describe('toApiWorkspaceMember', () => {
  it('merges member and user data', () => {
    const member: WorkspaceMemberRow = {
      workspace: 'ws-1',
      user_id: 'u-1',
      role: 'editor',
      created_at: now
    };
    const user: UserRow = {
      id: 'u-1',
      user_id: 'alice',
      email: 'a@b.com',
      display_name: 'Alice',
      auth_provider: 'local',
      password_hash: null,
      oidc_issuer: null,
      oidc_subject: null,
      is_active: true,
      color: null,
      created_at: now,
      updated_at: now,
      last_login_at: null
    };
    const result = toApiWorkspaceMember(member, user);
    expect(result.user_id).toBe('u-1');
    expect(result.display_name).toBe('Alice');
    expect(result.email).toBe('a@b.com');
    expect(result.role).toBe('editor');
    expect(result.created_at).toBe(nowIso);
    expect(result.user_id).toBe('u-1');
  });
});

// ── toApiWorkspaceUser ────────────────────────────────────────

describe('toApiWorkspaceUser', () => {
  it('maps user fields', () => {
    const user: UserRow = {
      id: 'u-2',
      user_id: 'bob',
      email: 'b@c.com',
      display_name: 'Bob',
      auth_provider: 'oidc',
      password_hash: null,
      oidc_issuer: null,
      oidc_subject: null,
      is_active: false,
      color: null,
      created_at: now,
      updated_at: now,
      last_login_at: null
    };
    const result = toApiWorkspaceUser(user);
    expect(result.id).toBe('u-2');
    expect(result.user_id).toBe('bob');
    expect(result.email).toBe('b@c.com');
    expect(result.is_active).toBe(false);
    expect(result.auth_provider).toBe('oidc');
  });
});
