import { describe, expect, it } from 'vitest';
import {
  buildDefaultLifecycleStates,
  buildDefaultWorkspaceTeams,
  buildWorkspaceCreateInput,
  buildWorkspaceUpdateInput,
  normalizeReplicationInclude,
  shortCode
} from './workspaceRoutes';
import type { Workspace } from '../../types';

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
      expect.objectContaining({ workspace: 'ws-1', label: 'Proposed', sort_order: 0 }),
      expect.objectContaining({ workspace: 'ws-1', label: 'Experimental', sort_order: 1 }),
      expect.objectContaining({ workspace: 'ws-1', label: 'Production', sort_order: 2 }),
      expect.objectContaining({ workspace: 'ws-1', label: 'Deprecated', sort_order: 3 })
    ]);
  });

  it('builds default workspace teams', () => {
    expect(buildDefaultWorkspaceTeams('ws-1', now)).toEqual([
      expect.objectContaining({ workspace: 'ws-1', name: 'Platform Team', sort_order: 0 }),
      expect.objectContaining({ workspace: 'ws-1', name: 'UX Team', sort_order: 1 }),
      expect.objectContaining({ workspace: 'ws-1', name: 'Security Team', sort_order: 2 })
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
      id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
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
