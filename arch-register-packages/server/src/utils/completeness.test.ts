import { describe, expect, it } from 'vitest';
import { buildAuthorizationContext, type TeamRole } from '@arch-register/permissions';
import { computeEntityCompleteness } from './completeness';
import { Entity, SchemaDbResult } from '../domain/catalog/db/catalogDatabase';

const now = new Date('2025-06-01T12:00:00.000Z');

const authCtxWithTeamRoles = (roles: Record<string, TeamRole[]>) =>
  buildAuthorizationContext({
    userId: 'user-1',
    globalRoles: [],
    workspaceRole: null,
    teamAssignments: Object.entries(roles).flatMap(([teamId, teamRoles]) =>
      teamRoles.map(role => ({ teamId, role }))
    ),
    schemas: [],
    entities: [],
    grants: []
  });

describe('computeEntityCompleteness', () => {
  it('counts required and expected fields, ignores optional fields, and treats false as filled', () => {
    const entity: Entity = {
      id: 'e-1',
      workspace: 'ws-1',
      public_id: 'ENT-1',
      slug: 'my-entity',
      namespace: 'ns',
      name: 'My Entity',
      description: '  ',
      owner: 'team-a',
      lifecycle: null,
      target_lifecycle: null,
      target_lifecycle_date: null,
      tags: [],
      links: [],
      schema_id: 'schema-1',
      data: {
        isCritical: false,
        notes: 'ready',
        optionalField: ''
      },
      project_id: null,
      created_at: now,
      updated_at: now,
      completeness: 0
    };

    const schema: SchemaDbResult = {
      id: 'schema-1',
      workspace: 'ws-1',
      name: 'Application',
      description: 'desc',
      fields: [
        { id: 'isCritical', name: 'Critical', type: 'boolean', requirementLevel: 'required' },
        { id: 'notes', name: 'Notes', type: 'text', requirementLevel: 'expected' },
        { id: 'optionalField', name: 'Optional', type: 'text', requirementLevel: 'optional' }
      ],
      color: null,
      icon: null,
      default_owner: null,
      key_prefix: 'APP',
      created_at: now,
      updated_at: now
    };

    expect(computeEntityCompleteness(entity, schema)).toBe(60);
  });

  it('excludes fields in a restricted group from both numerator and denominator', () => {
    const entity: Entity = {
      id: 'e-1',
      workspace: 'ws-1',
      public_id: 'ENT-1',
      slug: 'my-entity',
      namespace: 'ns',
      name: 'My Entity',
      description: 'A description',
      owner: 'team-a',
      lifecycle: null,
      target_lifecycle: null,
      target_lifecycle_date: null,
      tags: [],
      links: [],
      schema_id: 'schema-1',
      data: {
        isCritical: true,
        notes: ''
      },
      project_id: null,
      created_at: now,
      updated_at: now,
      completeness: 0
    };

    const schema: SchemaDbResult = {
      id: 'schema-1',
      workspace: 'ws-1',
      name: 'Application',
      description: 'desc',
      fields: [
        {
          id: 'isCritical',
          name: 'Critical',
          type: 'boolean',
          requirementLevel: 'required',
          groupId: 'restricted'
        },
        { id: 'notes', name: 'Notes', type: 'text', requirementLevel: 'expected' }
      ],
      groups: [
        { id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-restricted'] } }
      ],
      color: null,
      icon: null,
      default_owner: null,
      key_prefix: 'APP',
      created_at: now,
      updated_at: now
    };

    // No authCtx: unfiltered, true value — description, owner, isCritical filled out of 5.
    expect(computeEntityCompleteness(entity, schema)).toBe(60);

    // Caller without access to the restricted group: isCritical dropped from both the
    // numerator and denominator, so it neither inflates nor deflates the percentage, and its
    // occupancy can't be inferred — description, owner filled out of 4.
    const restrictedCallerCtx = authCtxWithTeamRoles({});
    expect(computeEntityCompleteness(entity, schema, restrictedCallerCtx)).toBe(50);

    // Caller with access to the restricted group's team: same as the unfiltered value.
    const permittedCallerCtx = authCtxWithTeamRoles({ 'team-restricted': ['team_editor'] });
    expect(computeEntityCompleteness(entity, schema, permittedCallerCtx)).toBe(60);
  });
});
