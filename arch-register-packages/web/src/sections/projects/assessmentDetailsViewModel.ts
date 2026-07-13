import {
  computeAssessmentStatus,
  type AssessmentEntityStatus
} from '@arch-register/api-types/assessmentStatus';
import type { AssessmentField } from '@arch-register/api-types/assessmentContract';
import type { AssessmentResponse } from '@arch-register/api-types/assessmentResponseContract';
import type { EntitySummary } from '@arch-register/api-types/entityContract';
import {
  matchesAssessmentFilterConditions,
  type AssessmentFilterCondition
} from './components/AssessmentFilterBuilder';

export type AssessmentStatusFilter = 'all' | AssessmentEntityStatus;

export const deriveAssessmentDetails = ({
  entities,
  responses,
  fields,
  statusFilter,
  search,
  conditions
}: {
  entities: EntitySummary[];
  responses: AssessmentResponse[];
  fields: AssessmentField[];
  statusFilter: AssessmentStatusFilter;
  search: string;
  conditions: AssessmentFilterCondition[];
}) => {
  const responseByEntity = new Map(responses.map(response => [response.entity_id, response]));
  const statusFor = (entityId: string) =>
    responseByEntity.get(entityId)?.status ?? computeAssessmentStatus(fields, undefined);
  const counts: Record<AssessmentStatusFilter, number> = {
    all: entities.length,
    not_started: 0,
    in_progress: 0,
    complete: 0
  };
  entities.forEach(entity => counts[statusFor(entity._uid)]++);
  const normalizedSearch = search.toLowerCase();
  const filtered = entities.filter(entity => {
    if (statusFilter !== 'all' && statusFor(entity._uid) !== statusFilter) return false;
    if (normalizedSearch && !entity._name.toLowerCase().includes(normalizedSearch)) return false;
    return (
      conditions.length === 0 ||
      matchesAssessmentFilterConditions(
        entity,
        responseByEntity.get(entity._uid)?.values ?? {},
        conditions
      )
    );
  });
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
    filtered,
    inScopeResponses,
    assessors: [...assessorNames].map(([userId, name]) => ({ userId, name }))
  };
};
