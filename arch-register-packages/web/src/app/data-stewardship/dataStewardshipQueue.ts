import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import type {
  GovernanceAssignment,
  GovernanceCase
} from '@arch-register/api-types/governanceContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { useGovernanceCases, useGovernanceTasks } from '../../hooks/useGovernance';
import { entityDetailQuery } from '../../queries/entities';

/**
 * Governance case kinds Data Stewardship's "My work" (#3298) queue draws on — the case-reminder
 * machinery already shipped for datasets (#3067) plus the existing generic entity-change/
 * deprecation approval kinds. Verified against the real server-side constants
 * (`ENTITY_CHANGE_CASE_KIND`/`ENTITY_DEPRECATION_CASE_KIND`/`FIELD_DATE_REMINDER_CASE_KIND` in
 * `server/src/domain/catalog/entityChangeOperations.ts` /
 * `entityDeprecationOperations.ts` / `fieldDateReminderJob.ts`), not copied from
 * `GovernanceInboxScreen.tsx`'s own filters, which use the (likely stale) literals `'entity.change'`
 * / `'entity.change.bulk'`.
 *
 * The Claude Design reference's queue (`ds-data.jsx`'s `DS_QUEUE`) also has "Access request" and
 * "Data-subject request" kinds with no backing governance-case model anywhere in this codebase —
 * those are dropped rather than fabricated, same discipline `datasetCoverage.ts` and
 * `DataStewardshipStewardshipScreen.tsx` already apply to other unavailable mock fields.
 *
 * Bulk entity-change proposals (`entity.change-case.bulk`) are out of scope for this first cut:
 * their `subjectId` is a bulk-proposal id, not an entity id, so joining them to a dataset needs the
 * same extra bulk-proposal lookup `GovernanceInboxScreen.tsx` does — a follow-up, not silently
 * half-supported here.
 */
export const DS_QUEUE_CASE_KINDS = [
  'field-date-reminder',
  'entity.change-case',
  'entity.deprecation'
] as const;

export type DataStewardshipQueueScope = 'mine' | 'all' | 'late';
export type DataStewardshipQueuePriority = 'high' | 'medium' | 'low';

export type DataStewardshipQueueItem = {
  case: GovernanceCase;
  assignment: GovernanceAssignment | null;
  dataset: EntityRecord;
};

const isRelevantCase = (governanceCase: GovernanceCase): boolean =>
  governanceCase.subjectType === 'entity' &&
  (DS_QUEUE_CASE_KINDS as readonly string[]).includes(governanceCase.caseKind);

export const isCaseOverdue = (governanceCase: GovernanceCase, now: Date = new Date()): boolean =>
  governanceCase.dueAt != null && new Date(governanceCase.dueAt) < now;

/**
 * Priority bucket for a queue item — **derived**, not a real field: `governanceCaseSchema` has no
 * priority/severity of its own, only `dueAt`/`escalatedAt`. Mirrors the tone `DS_PRIO_TONE` gives
 * the design reference's mocked High/Medium/Low priority (`ds-data.jsx`), computed instead from how
 * close (or past) the case's due date is, and whether it has already been escalated.
 */
export const queueItemPriority = (
  governanceCase: GovernanceCase,
  now: Date = new Date()
): DataStewardshipQueuePriority => {
  if (governanceCase.escalatedAt != null) return 'high';
  if (governanceCase.dueAt == null) return 'low';
  const due = new Date(governanceCase.dueAt);
  if (due < now) return 'high';
  const daysUntilDue = (due.getTime() - now.getTime()) / 86400000;
  return daysUntilDue <= 7 ? 'medium' : 'low';
};

/**
 * The review queue backing Data Stewardship's "My work" section (#3298), scoped down from the
 * workspace-wide governance inbox (#3067) to cases against Data Entities. "mine" reuses
 * `governance.assignments.mine` (the same primitive `GovernanceInboxScreen.tsx`'s "Assigned to me"
 * tab uses); "all"/"late" use `governance.cases.list` (workspace-visible cases, not just the
 * current user's own assignments — there is no per-item assignee for these two scopes, see
 * `dataStewardshipQueue.ts`'s sibling doc comments and the plan for #3298).
 */
export const useDataStewardshipQueue = (
  workspaceSlug: string,
  dataEntitySchemaId: string | null,
  scope: DataStewardshipQueueScope,
  enabled = true
) => {
  const now = useMemo(() => new Date(), []);
  const tasks = useGovernanceTasks(
    workspaceSlug,
    { state: 'open' },
    enabled && !!dataEntitySchemaId && scope === 'mine'
  );
  const cases = useGovernanceCases(
    workspaceSlug,
    { status: 'open' },
    enabled && !!dataEntitySchemaId && scope !== 'mine'
  );

  const rawEntries: { case: GovernanceCase; assignment: GovernanceAssignment | null }[] =
    scope === 'mine'
      ? (tasks.data ?? []).map(task => ({ case: task.case, assignment: task.assignment }))
      : (cases.data ?? []).map(governanceCase => ({ case: governanceCase, assignment: null }));

  // Joins each case's `subjectId` against its full entity detail record to confirm the subject is
  // actually a Data Entity of the configured schema (`_schema.id` — the nested schema reference
  // `entities.get` returns, not the `_schemaId` filter-condition field id used elsewhere for
  // querying/faceting) and to get the dataset's name/publicId for display.
  const relevant = rawEntries.filter(entry => isRelevantCase(entry.case));
  const scoped =
    scope === 'late' ? relevant.filter(entry => isCaseOverdue(entry.case, now)) : relevant;

  const entityIds = [...new Set(scoped.map(entry => entry.case.subjectId))];
  const entityQueries = useQueries({
    queries: entityIds.map(entityId => entityDetailQuery(workspaceSlug, entityId))
  });
  const datasetById = new Map(entityIds.map((id, index) => [id, entityQueries[index]?.data]));

  const items: DataStewardshipQueueItem[] = scoped
    .map(entry => ({ ...entry, dataset: datasetById.get(entry.case.subjectId) }))
    .filter(
      (
        entry
      ): entry is {
        case: GovernanceCase;
        assignment: GovernanceAssignment | null;
        dataset: EntityRecord;
      } => entry.dataset != null && entry.dataset._schema?.id === dataEntitySchemaId
    );

  const isLoading = scope === 'mine' ? tasks.isLoading : cases.isLoading;

  return { items, isLoading };
};
