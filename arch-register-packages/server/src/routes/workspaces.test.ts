import { describe, expect, it } from 'vitest';
import {
  buildDefaultLifecycleStates,
  buildDefaultWorkspaceTeams,
  buildWorkspaceCreateInput,
  buildWorkspaceUpdateInput,
  normalizeReplicationInclude,
  shortCode
} from './workspaces';
import type { Workspace } from '../types';

const now = new Date('2026-06-01T12:00:00.000Z');

const baseWorkspace: Workspace = {
  id: 'default',
  name: 'Default Workspace',
  url_slug: 'default',
  short_code: 'DW',
  color: '#123456',
  description: 'Original',
  created_at: now,
  updated_at: now
};

describe('workspace route helpers', () => {
  it('builds short codes from workspace names', () => {
    expect(shortCode('Default Workspace')).toBe('DW');
    expect(shortCode('Architecture Register')).toBe('AR');
  });

  it('builds default lifecycle states', () => {
    expect(buildDefaultLifecycleStates('ws-1', now)).toEqual([
      expect.objectContaining({ id: 'proposed', workspace: 'ws-1', sort_order: 0 }),
      expect.objectContaining({ id: 'experimental', workspace: 'ws-1', sort_order: 1 }),
      expect.objectContaining({ id: 'production', workspace: 'ws-1', sort_order: 2 }),
      expect.objectContaining({ id: 'deprecated', workspace: 'ws-1', sort_order: 3 })
    ]);
  });

  it('builds default workspace teams', () => {
    expect(buildDefaultWorkspaceTeams('ws-1', now)).toEqual([
      expect.objectContaining({ id: 'platform-team', workspace: 'ws-1', sort_order: 0 }),
      expect.objectContaining({ id: 'ux-team', workspace: 'ws-1', sort_order: 1 }),
      expect.objectContaining({ id: 'security-team', workspace: 'ws-1', sort_order: 2 })
    ]);
  });

  it('builds create workspace input with normalized values', () => {
    expect(
      buildWorkspaceCreateInput(
        {
          name: 'New Workspace',
          description: 7,
          color: 8,
          slug: 'New Workspace !!!',
          badge: 'nwx'
        },
        now
      )
    ).toEqual({
      id: 'new-workspace',
      name: 'New Workspace',
      url_slug: 'new-workspace',
      short_code: 'NW',
      color: '',
      description: '',
      created_at: now,
      updated_at: now
    });
  });

  it('builds update workspace input preserving omitted fields', () => {
    expect(buildWorkspaceUpdateInput({ name: 'Renamed Workspace' }, baseWorkspace, now)).toEqual({
      name: 'Renamed Workspace',
      url_slug: 'default',
      short_code: 'DW',
      color: '#123456',
      description: 'Original',
      updated_at: now
    });
  });

  it('builds update workspace input with normalized explicit fields', () => {
    expect(
      buildWorkspaceUpdateInput(
        {
          name: 'Renamed Workspace',
          url_slug: 'Renamed Workspace !!',
          short_code: 'RW',
          color: '#abcdef',
          description: 'Updated'
        },
        baseWorkspace,
        now
      )
    ).toEqual({
      name: 'Renamed Workspace',
      url_slug: 'renamed-workspace',
      short_code: 'RW',
      color: '#abcdef',
      description: 'Updated',
      updated_at: now
    });
  });

  it('normalizes replication include values', () => {
    expect(normalizeReplicationInclude(undefined)).toEqual(new Set(['schemas', 'settings']));
    expect(normalizeReplicationInclude(['schemas', 1, 'settings'])).toEqual(
      new Set(['schemas', 'settings'])
    );
  });
});
