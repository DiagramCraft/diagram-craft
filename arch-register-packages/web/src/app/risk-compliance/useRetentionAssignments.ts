import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { entitiesQuery } from '../../queries/entities';
import { useRelations } from '../../hooks/useRelations';
import type { RetentionConfig, RetentionFieldIds } from './riskComplianceQueries';

export type RetentionAssignmentRow = {
  uid: string;
  publicId: string;
  governedEntityId: string;
  governedEntityName: string;
  policyId: string | null;
  policyName: string;
  /** Formatted "duration time_unit" (e.g. "3 years"), or null if the policy is missing or its
   *  duration/time unit aren't set — a plain fact about the policy, not a computed expiry. */
  policyPeriod: string | null;
  activatedFrom: string | null;
  /** Which of policy / duration / time unit / activation date is missing or invalid — a
   *  data-completeness signal (can this assignment even be evaluated), independent of any
   *  per-record disposal timing, which this model has no way to represent (see this screen's own
   *  doc comment in `RiskComplianceRetentionScreen.tsx`). */
  missing: string[];
};

export type RetentionPolicyRow = EntityRecord & { governedCount: number };

const isRetentionTimeUnit = (value: unknown): value is 'days' | 'months' | 'years' =>
  value === 'days' || value === 'months' || value === 'years';

/**
 * Fetches every Retention Policy and Assignment relation in the workspace and joins them into
 * per-assignment rows. An assignment's governing policy is looked up by the relation's `_out.id`
 * (the policy entity's
 * `_uid`, per `useRelations.ts`'s endpoint shape), and its duration/time-unit/activation-date
 * values are read off the per-workspace field ids resolved by `resolveRetentionFieldIds` (not the
 * literal `duration`/`time_unit`/`activated_from` ids, which are only the *defaults* a
 * workspace's capability binding may have remapped).
 *
 * Deliberately doesn't compute a per-assignment expiry date: `retention-assignment` links a
 * policy to a Data Entity *category* (e.g. "Customer Credentials"), not to an individual record,
 * so `activated_from + duration` would only ever be "how long this policy has nominally applied
 * to this category" — not "when the records in it are due for disposal", since those records
 * don't all share one creation date. Only `policyPeriod` (a plain fact from the policy) and
 * `missing` (can this assignment even be evaluated at all) are reported.
 */
export const useRetentionAssignments = (
  workspaceSlug: string,
  config: RetentionConfig | null,
  fieldIds: RetentionFieldIds | null
) => {
  const enabled = config != null;
  const policies = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: config?.policySchemaId, view: 'full', limit: 500 },
      enabled
    )
  );
  const assignments = useRelations(
    workspaceSlug,
    { schemaId: config?.assignmentSchemaId ?? undefined, limit: 1000 },
    { enabled }
  );

  const policyItems = policies.data?.items ?? [];
  const policiesById = useMemo(
    () => new Map(policyItems.map(policy => [policy._uid, policy])),
    [policyItems]
  );

  const rows = useMemo<RetentionAssignmentRow[]>(() => {
    if (!fieldIds) return [];
    return assignments.data.map(relation => {
      const policy = policiesById.get(relation._out.id);
      const duration = policy ? policy[fieldIds.durationFieldId] : null;
      const timeUnit = policy ? policy[fieldIds.timeUnitFieldId] : null;
      const activatedFrom = relation[fieldIds.activatedFromFieldId];

      const missing: string[] = [];
      if (!policy) missing.push('policy');
      if (typeof duration !== 'number') missing.push('duration');
      if (!isRetentionTimeUnit(timeUnit)) missing.push('time unit');
      if (typeof activatedFrom !== 'string' || !activatedFrom) missing.push('activation date');

      const policyPeriod =
        typeof duration === 'number' && isRetentionTimeUnit(timeUnit)
          ? `${duration} ${timeUnit}`
          : null;

      return {
        uid: relation._uid,
        publicId: relation._uid,
        governedEntityId: relation._in.id,
        governedEntityName: relation._in.name,
        policyId: policy?._uid ?? null,
        policyName: relation._out.name,
        policyPeriod,
        activatedFrom: typeof activatedFrom === 'string' ? activatedFrom : null,
        missing
      };
    });
  }, [assignments.data, policiesById, fieldIds]);

  const governedCountByPolicyId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (!row.policyId) continue;
      counts.set(row.policyId, (counts.get(row.policyId) ?? 0) + 1);
    }
    return counts;
  }, [rows]);

  const policyRows = useMemo<RetentionPolicyRow[]>(
    () =>
      policyItems.map(policy => ({
        ...policy,
        governedCount: governedCountByPolicyId.get(policy._uid) ?? 0
      })),
    [policyItems, governedCountByPolicyId]
  );

  return {
    rows,
    policyRows,
    isLoading: policies.isLoading || assignments.isLoading
  };
};
