import { HTTPError } from 'h3';
import type {
  RelationConstraintErrorData,
  RelationConstraintViolation
} from '@arch-register/api-types/relationSchemaContract';

export const RELATION_CONSTRAINT_ERROR_CODE = 'RELATION_CONSTRAINT_VIOLATION' as const;
export const MAX_RELATION_CONSTRAINT_DIAGNOSTICS = 100;

export const relationConstraintMessage = (violation: RelationConstraintViolation): string => {
  if (violation.kind === 'endpoint_pair_unique') {
    return `Relation schema '${violation.relation_schema_id}' allows only one active relation for this ordered endpoint pair`;
  }

  return violation.kind === 'typed_relation_minimum'
    ? `${violation.field_name} requires at least ${violation.limit} relation(s)`
    : `${violation.field_name} allows at most ${violation.limit} relation(s)`;
};

export const relationConstraintError = (
  violations: RelationConstraintViolation[],
  options?: { hiddenViolationCount?: number; totalViolationCount?: number; status?: 400 | 409 }
): HTTPError => {
  const totalViolationCount = options?.totalViolationCount ?? violations.length;
  const visibleViolations = violations.slice(0, MAX_RELATION_CONSTRAINT_DIAGNOSTICS);
  const hiddenViolationCount = Math.max(
    options?.hiddenViolationCount ?? 0,
    totalViolationCount - visibleViolations.length
  );
  const data: RelationConstraintErrorData = {
    code: RELATION_CONSTRAINT_ERROR_CODE,
    violations: visibleViolations,
    total_violation_count: totalViolationCount,
    hidden_violation_count: hiddenViolationCount,
    truncated: hiddenViolationCount > 0
  };
  const first = visibleViolations[0];
  const message = first
    ? relationConstraintMessage(first)
    : 'The relation constraint could not be satisfied';

  return new HTTPError({
    status: options?.status ?? 409,
    statusText: 'Conflict',
    message,
    data
  });
};

export const throwRelationConstraintError = (
  violations: RelationConstraintViolation[],
  options?: { hiddenViolationCount?: number; totalViolationCount?: number; status?: 400 | 409 }
): never => {
  throw relationConstraintError(violations, options);
};
