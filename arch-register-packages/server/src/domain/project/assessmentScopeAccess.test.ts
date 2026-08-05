import { describe, expect, it } from 'vitest';
import { buildAuthorizationContext, type TeamRole } from '@arch-register/permissions';
import type { AssessmentDbResult } from './db/projectDatabase';
import type { SchemaDbResult } from '../catalog/db/catalogDatabase';
import {
  assertAssessmentScopeConditionsAuthorized,
  mergeVisibleAssessmentScopeConditions,
  restrictedAssessmentScopeConditions,
  visibleAssessmentScopeConditions
} from './assessmentScopeAccess';

const schema = {
  id: 'schema-service',
  fields: [{ id: 'secret', groupId: 'restricted' }],
  groups: [{ id: 'restricted', accessControl: { teamIds: ['team-security'] } }]
} as unknown as SchemaDbResult;

const assessment = {
  scope: ['schema-service'],
  scope_conditions: [
    { fieldId: 'secret', op: 'equals', value: 'classified' },
    { fieldId: '_owner', op: 'equals', value: 'team-service' }
  ]
} as Pick<AssessmentDbResult, 'scope' | 'scope_conditions'>;

const authCtx = (roles: { teamId: string; role: TeamRole }[] = []) =>
  buildAuthorizationContext({
    userId: 'user-1',
    globalRoles: [],
    workspaceRole: null,
    workspaceCapabilityCeiling: ['content.view'],
    teamAssignments: roles,
    schemas: [],
    entities: [],
    grants: []
  });

describe('assessment scope field-group authorization', () => {
  it('rejects a condition when the caller cannot view its field group', () => {
    expect(() =>
      assertAssessmentScopeConditionsAuthorized(
        assessment.scope,
        assessment.scope_conditions,
        [schema],
        authCtx()
      )
    ).toThrow('restricted field');
  });

  it.each(['team_reviewer', 'team_editor'] as const)(
    'allows a caller with %s access to create the condition',
    role => {
      expect(() =>
        assertAssessmentScopeConditionsAuthorized(
          assessment.scope,
          assessment.scope_conditions,
          [schema],
          authCtx([{ teamId: 'team-security', role }])
        )
      ).not.toThrow();
    }
  );

  it('omits only restricted predicates from assessment reads', () => {
    expect(visibleAssessmentScopeConditions(assessment, [schema], authCtx())).toEqual([
      { fieldId: '_owner', op: 'equals', value: 'team-service' }
    ]);
  });

  it('treats an unknown condition field as inaccessible instead of evaluating raw data', () => {
    const staleAssessment: Pick<AssessmentDbResult, 'scope' | 'scope_conditions'> = {
      ...assessment,
      scope_conditions: [
        { fieldId: 'removed-field', op: 'equals', value: 'classified' },
        { fieldId: '_owner', op: 'equals', value: 'team-service' }
      ]
    };

    expect(restrictedAssessmentScopeConditions(staleAssessment, [schema], authCtx())).toEqual([
      { fieldId: 'removed-field', op: 'equals', value: 'classified' }
    ]);
    expect(visibleAssessmentScopeConditions(staleAssessment, [schema], authCtx())).toEqual([
      { fieldId: '_owner', op: 'equals', value: 'team-service' }
    ]);
  });

  it('rejects a new condition whose field is unavailable', () => {
    expect(() =>
      assertAssessmentScopeConditionsAuthorized(
        ['schema-service'],
        [{ fieldId: 'removed-field', op: 'equals', value: 'classified' }],
        [schema],
        authCtx()
      )
    ).toThrow('unavailable field');
  });

  it('treats a condition as inaccessible when a scoped schema is unavailable', () => {
    const staleAssessment: Pick<AssessmentDbResult, 'scope' | 'scope_conditions'> = {
      scope: ['schema-missing'],
      scope_conditions: [{ fieldId: 'removed-field', op: 'equals', value: 'classified' }]
    };

    expect(restrictedAssessmentScopeConditions(staleAssessment, [], authCtx())).toEqual(
      staleAssessment.scope_conditions
    );
    expect(visibleAssessmentScopeConditions(staleAssessment, [], authCtx())).toEqual([]);
  });

  it('requires a custom condition field in every scoped schema', () => {
    const secondSchema = {
      id: 'schema-other',
      fields: [],
      groups: []
    } as unknown as SchemaDbResult;
    const multiSchemaAssessment: Pick<AssessmentDbResult, 'scope' | 'scope_conditions'> = {
      scope: ['schema-service', 'schema-other'],
      scope_conditions: [{ fieldId: 'secret', op: 'equals', value: 'classified' }]
    };

    expect(
      restrictedAssessmentScopeConditions(
        multiSchemaAssessment,
        [schema, secondSchema],
        authCtx([{ teamId: 'team-security', role: 'team_reviewer' }])
      )
    ).toEqual(multiSchemaAssessment.scope_conditions);
  });

  it('preserves hidden predicates when a caller updates visible conditions', () => {
    const requested = [{ fieldId: '_lifecycle', op: 'not_empty', value: '' }] as const;
    expect(
      mergeVisibleAssessmentScopeConditions(assessment, [...requested], [schema], authCtx())
    ).toEqual([...requested, { fieldId: 'secret', op: 'equals', value: 'classified' }]);
  });
});
