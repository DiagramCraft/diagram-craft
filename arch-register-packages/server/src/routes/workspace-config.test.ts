import { AR_COLOR_BLUE } from '@arch-register/api-types/colors';
import { describe, expect, it } from 'vitest';
import {
  buildLifecycleStateInputs,
  buildTeamMembershipInputs,
  buildWorkspaceOwnerInputs,
  parseWorkspaceRoleInput,
  sanitizeText
} from './workspace-config.js';

const now = new Date('2026-06-01T12:00:00.000Z');

describe('workspace config route helpers', () => {
  it('sanitizes unsafe text fragments', () => {
    expect(sanitizeText('  <Admin> javascript:alert(1) onclick=test() Team  ')).toBe(
      'Admin alert(1) test() Team'
    );
  });

  it('parses workspace role input with sanitized text, default tone, and deduped capabilities', () => {
    expect(
      parseWorkspaceRoleInput({
        name: '  <Team Admin>  ',
        description: ' javascript:docs owner ',
        capabilities: ['ws.view', 'people.teams', 'ws.view']
      })
    ).toEqual({
      name: 'Team Admin',
      description: 'docs owner',
      tone: AR_COLOR_BLUE,
      capabilities: ['ws.view', 'people.teams']
    });
  });

  it('rejects invalid workspace role capabilities', () => {
    expect(() =>
      parseWorkspaceRoleInput({
        name: 'Role',
        capabilities: ['ws.view', 'invalid.capability']
      })
    ).toThrowError('capabilities contains invalid values');
  });

  it('builds lifecycle states and resets sort order from array position', () => {
    expect(
      buildLifecycleStateInputs(
        'default',
        [
          { id: 'prod', label: 'Production', color: '#00ff00', sort_order: 99 },
          { id: 'deprecated', label: 'Deprecated', color: '#cccc00', sort_order: 1 }
        ],
        now
      )
    ).toEqual([
      {
        id: 'prod',
        workspace: 'default',
        label: 'Production',
        color: '#00ff00',
        sort_order: 0,
        created_at: now
      },
      {
        id: 'deprecated',
        workspace: 'default',
        label: 'Deprecated',
        color: '#cccc00',
        sort_order: 1,
        created_at: now
      }
    ]);
  });

  it('rejects duplicate lifecycle state ids', () => {
    expect(() =>
      buildLifecycleStateInputs(
        'default',
        [
          { id: 'prod', label: 'Production', color: '#00ff00' },
          { id: 'prod', label: 'Duplicate', color: '#000000' }
        ],
        now
      )
    ).toThrowError('Duplicate lifecycle state ids');
  });

  it('builds workspace owners with normalized optional fields', () => {
    expect(
      buildWorkspaceOwnerInputs(
        'default',
        [
          { id: 'Platform Engineering', color: '#112233', description: 'Core services' },
          { id: 'Design Systems', color: null }
        ],
        now
      )
    ).toEqual([
      {
        id: 'Platform Engineering',
        workspace: 'default',
        sort_order: 0,
        color: '#112233',
        description: 'Core services',
        created_at: now
      },
      {
        id: 'Design Systems',
        workspace: 'default',
        sort_order: 1,
        color: null,
        description: '',
        created_at: now
      }
    ]);
  });

  it('rejects duplicate owner ids', () => {
    expect(() =>
      buildWorkspaceOwnerInputs(
        'default',
        [{ id: 'Platform Engineering' }, { id: 'Platform Engineering' }],
        now
      )
    ).toThrowError('Duplicate owner ids');
  });

  it('builds validated team memberships', () => {
    expect(
      buildTeamMembershipInputs(
        'default',
        [
          {
            team_id: 'Platform Engineering',
            user_id: 'workspaceeditor',
            role: 'team_editor'
          }
        ],
        new Set(['Platform Engineering', 'Design Systems']),
        new Set(['workspaceeditor', 'workspaceviewer']),
        now
      )
    ).toEqual([
      {
        workspace: 'default',
        team_id: 'Platform Engineering',
        user_id: 'workspaceeditor',
        role: 'team_editor',
        created_at: now
      }
    ]);
  });

  it('rejects memberships with unknown teams, users, or roles', () => {
    expect(() =>
      buildTeamMembershipInputs(
        'default',
        [{ team_id: 'Missing Team', user_id: 'workspaceeditor', role: 'team_editor' }],
        new Set(['Platform Engineering']),
        new Set(['workspaceeditor']),
        now
      )
    ).toThrowError('team_id must reference an existing team');

    expect(() =>
      buildTeamMembershipInputs(
        'default',
        [{ team_id: 'Platform Engineering', user_id: 'missing-user', role: 'team_editor' }],
        new Set(['Platform Engineering']),
        new Set(['workspaceeditor']),
        now
      )
    ).toThrowError('user_id must reference an existing user');

    expect(() =>
      buildTeamMembershipInputs(
        'default',
        [{ team_id: 'Platform Engineering', user_id: 'workspaceeditor', role: 'invalid' }],
        new Set(['Platform Engineering']),
        new Set(['workspaceeditor']),
        now
      )
    ).toThrowError('role must be one of: team_admin, team_editor, team_reviewer');
  });
});
