import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type { AssessmentDbResult } from './db/projectDatabase';
import type { SchemaDbResult } from '../catalog/db/catalogDatabase';
import { isFieldViewRestricted } from '../auth/fieldGroupAccessControl';
import { httpAssert } from '../../utils/httpAssert';

const conditionIsRestricted = (
  condition: FilterCondition,
  scope: string[],
  schemas: SchemaDbResult[],
  authCtx: WorkspaceAuthorizationContext | null
): boolean => {
  if (!authCtx) return false;

  return schemas
    .filter(schema => scope.includes(schema.id))
    .some(
      schema =>
        schema.fields.some(field => field.id === condition.fieldId) &&
        isFieldViewRestricted(authCtx, schema, condition.fieldId)
    );
};

export const restrictedAssessmentScopeConditions = (
  assessment: Pick<AssessmentDbResult, 'scope' | 'scope_conditions'>,
  schemas: SchemaDbResult[],
  authCtx: WorkspaceAuthorizationContext | null
): FilterCondition[] =>
  assessment.scope_conditions.filter(condition =>
    conditionIsRestricted(condition, assessment.scope, schemas, authCtx)
  );

export const visibleAssessmentScopeConditions = (
  assessment: Pick<AssessmentDbResult, 'scope' | 'scope_conditions'>,
  schemas: SchemaDbResult[],
  authCtx: WorkspaceAuthorizationContext | null
): FilterCondition[] =>
  assessment.scope_conditions.filter(
    condition => !conditionIsRestricted(condition, assessment.scope, schemas, authCtx)
  );

export const assertAssessmentScopeConditionsAuthorized = (
  scope: string[],
  conditions: FilterCondition[],
  schemas: SchemaDbResult[],
  authCtx: WorkspaceAuthorizationContext
) => {
  const restricted = conditions.filter(condition =>
    conditionIsRestricted(condition, scope, schemas, authCtx)
  );
  httpAssert.true(restricted.length === 0, {
    status: 403,
    statusText: 'Forbidden',
    message: `Assessment scope condition references a restricted field: ${restricted[0]?.fieldId}`
  });
};

export const mergeVisibleAssessmentScopeConditions = (
  existing: Pick<AssessmentDbResult, 'scope' | 'scope_conditions'>,
  requestedConditions: FilterCondition[],
  schemas: SchemaDbResult[],
  authCtx: WorkspaceAuthorizationContext
): FilterCondition[] => [
  ...requestedConditions,
  ...restrictedAssessmentScopeConditions(existing, schemas, authCtx)
];

export const assessmentScopeHasRestrictedConditions = (
  assessment: Pick<AssessmentDbResult, 'scope' | 'scope_conditions'>,
  schemas: SchemaDbResult[],
  authCtx: WorkspaceAuthorizationContext | null
): boolean => restrictedAssessmentScopeConditions(assessment, schemas, authCtx).length > 0;
