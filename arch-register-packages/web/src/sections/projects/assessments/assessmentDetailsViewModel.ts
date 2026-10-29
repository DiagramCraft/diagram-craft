import {
  computeAssessmentStatus,
  type AssessmentEntityStatus,
  type AssessmentMode
} from '@arch-register/api-types/assessmentStatus';
import type { AssessmentField } from '@arch-register/api-types/assessmentContract';
import { getAssessmentEnumOptions } from '@arch-register/api-types/assessmentFieldOptions';
import type { AssessmentResponse } from '@arch-register/api-types/assessmentResponseContract';
import type { EntitySummary } from '@arch-register/api-types/entityContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import {
  matchesAssessmentFilterConditions,
  type AssessmentFilterCondition
} from './assessmentFilterConditions';

export type AssessmentStatusFilter = 'all' | AssessmentEntityStatus;

export type AssessmentOverview = ReturnType<typeof deriveAssessmentOverview>;

/** Per-entity statuses, status counts and assessors — independent of any table filter. */
export const deriveAssessmentOverview = ({
  entities,
  responses,
  fields,
  mode
}: {
  entities: EntitySummary[];
  responses: AssessmentResponse[];
  fields: AssessmentField[];
  mode: AssessmentMode;
}) => {
  const responseByEntity = new Map(responses.map(response => [response.entity_id, response]));
  const statusFor = (entityId: string) =>
    responseByEntity.get(entityId)?.status ?? computeAssessmentStatus(fields, undefined, mode);
  const counts: Record<AssessmentStatusFilter, number> = {
    all: entities.length,
    not_started: 0,
    in_progress: 0,
    complete: 0
  };
  entities.forEach(entity => counts[statusFor(entity._uid)]++);
  const entityIds = new Set(entities.map(entity => entity._uid));
  const inScopeResponses = responses.filter(response => entityIds.has(response.entity_id));
  const assessorNames = new Map<string, string | null>();
  inScopeResponses.forEach(response => {
    if (response.updated_by) assessorNames.set(response.updated_by, response.updated_by_name);
  });
  return {
    responseByEntity,
    statusFor,
    counts,
    inScopeResponses,
    assessors: [...assessorNames].map(([userId, name]) => ({ userId, name }))
  };
};

/** The entities shown in the responses table for the current status, search and conditions. */
export const filterAssessmentEntities = ({
  entities,
  overview,
  statusFilter,
  search,
  conditions
}: {
  entities: EntitySummary[];
  overview: Pick<AssessmentOverview, 'responseByEntity' | 'statusFor'>;
  statusFilter: AssessmentStatusFilter;
  search: string;
  conditions: AssessmentFilterCondition[];
}) => {
  const normalizedSearch = search.toLowerCase();
  return entities.filter(entity => {
    if (statusFilter !== 'all' && overview.statusFor(entity._uid) !== statusFilter) return false;
    if (normalizedSearch && !entity._name.toLowerCase().includes(normalizedSearch)) return false;
    return (
      conditions.length === 0 ||
      matchesAssessmentFilterConditions(
        entity,
        overview.responseByEntity.get(entity._uid)?.values ?? {},
        conditions
      )
    );
  });
};

const STATUS_ORDER: Record<AssessmentEntityStatus, number> = {
  not_started: 0,
  in_progress: 1,
  complete: 2
};

type EntityComparator = (a: EntitySummary, b: EntitySummary) => number;

/** Sort comparators for the responses table, keyed by column (`_name`, … or an assessment field id). */
export const buildAssessmentComparators = ({
  fields,
  enums,
  overview,
  schemaNameFor
}: {
  fields: AssessmentField[];
  enums: WorkspaceEnum[];
  overview: Pick<AssessmentOverview, 'responseByEntity' | 'statusFor'>;
  schemaNameFor: (entity: EntitySummary) => string;
}): Record<string, EntityComparator> => {
  const fieldComparator =
    (field: AssessmentField): EntityComparator =>
    (a, b) => {
      const aValue = overview.responseByEntity.get(a._uid)?.values[field.id];
      const bValue = overview.responseByEntity.get(b._uid)?.values[field.id];
      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return 1;
      if (bValue === undefined) return -1;

      if (field.type === 'rating') return (aValue as number) - (bValue as number);
      if (field.type === 'enum') {
        const options = getAssessmentEnumOptions(field, enums);
        const aLabel = options.find(o => o.value === aValue)?.label ?? String(aValue);
        const bLabel = options.find(o => o.value === bValue)?.label ?? String(bValue);
        return aLabel.localeCompare(bLabel);
      }
      return String(aValue).localeCompare(String(bValue));
    };

  const comparators: Record<string, EntityComparator> = {
    _name: (a, b) => a._name.localeCompare(b._name),
    _owner: (a, b) => (a._owner?.name ?? '').localeCompare(b._owner?.name ?? ''),
    _schema: (a, b) => schemaNameFor(a).localeCompare(schemaNameFor(b)),
    _status: (a, b) =>
      STATUS_ORDER[overview.statusFor(a._uid)] - STATUS_ORDER[overview.statusFor(b._uid)]
  };
  for (const field of fields) comparators[field.id] = fieldComparator(field);
  return comparators;
};
