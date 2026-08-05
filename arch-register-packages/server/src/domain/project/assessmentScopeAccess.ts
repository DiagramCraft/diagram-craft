import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type { AssessmentDbResult } from './db/projectDatabase';
import type { SchemaDbResult } from '../catalog/db/catalogDatabase';
import { isFieldViewRestricted } from '../auth/fieldGroupAccessControl';
import { httpAssert } from '../../utils/httpAssert';

// These are the entity-level fields that matchesFilterCondition evaluates without consulting a
// schema. Everything else must resolve to a declared field in every schema in the assessment
// scope before an authenticated caller may use it to determine membership.
const ASSESSMENT_SCOPE_BUILTIN_FIELD_IDS = new Set([
  '_schemaId',
  '_lifecycle',
  '_owner',
  '_name',
  '_slug',
  '_description',
  '_namespace',
  '_completeness',
  '_updatedAt',
  '_effectiveActivityAt',
  '_tags'
]);

const conditionIsRestricted = (
  condition: FilterCondition,
  scope: string[],
  schemas: SchemaDbResult[],
  authCtx: WorkspaceAuthorizationContext | null
): boolean => {
  if (!authCtx) return false;

  if (ASSESSMENT_SCOPE_BUILTIN_FIELD_IDS.has(condition.fieldId)) return false;

  const scopedSchemas = scope.map(schemaId => schemas.find(schema => schema.id === schemaId));
  if (scopedSchemas.length === 0 || scopedSchemas.some(schema => schema == null)) return true;
  const resolvedSchemas = scopedSchemas.filter(
    (schema): schema is SchemaDbResult => schema != null
  );

  return resolvedSchemas.some(
    schema =>
      !schema.fields.some(field => field.id === condition.fieldId) ||
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
    message: `Assessment scope condition references a restricted field or an unavailable field: ${restricted[0]?.fieldId}`
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
