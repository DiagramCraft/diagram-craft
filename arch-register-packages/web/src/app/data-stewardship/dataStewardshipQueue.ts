import type {
  GovernanceAssignment,
  GovernanceCase
} from '@arch-register/api-types/governanceContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import {
  deriveDueDatePriority,
  isCaseOverdue,
  useNeedsAttentionQueue,
  type NeedsAttentionPriority
} from '../../sections/dashboard/widgets/needsAttentionQueue';

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
export type DataStewardshipQueuePriority = NeedsAttentionPriority;

export type DataStewardshipQueueItem = {
  case: GovernanceCase;
  assignment: GovernanceAssignment | null;
  dataset: EntityRecord;
};

export { isCaseOverdue };

/** Re-exported under this app's own name — kept alongside `useDataStewardshipQueue` since the
 * "My work" screen's queue cards and calendar both derive priority from a case directly. */
export const queueItemPriority = deriveDueDatePriority;

/**
 * The review queue backing Data Stewardship's "My work" section (#3298), scoped down from the
 * workspace-wide governance inbox (#3067) to cases against Data Entities. "mine" reuses
 * `governance.assignments.mine` (the same primitive `GovernanceInboxScreen.tsx`'s "Assigned to me"
 * tab uses); "all"/"late" use `governance.cases.list` (workspace-visible cases, not just the
 * current user's own assignments — there is no per-item assignee for these two scopes, see
 * `dataStewardshipQueue.ts`'s sibling doc comments and the plan for #3298).
 *
 * Thin wrapper over the shared `useNeedsAttentionQueue` (#3466) — this module now only keeps the
 * app-specific case-kind set, scope-name mapping, and result shape (`dataset` instead of `entity`).
 */
export const useDataStewardshipQueue = (
  workspaceSlug: string,
  dataEntitySchemaId: string | null,
  scope: DataStewardshipQueueScope,
  enabled = true
): { items: DataStewardshipQueueItem[]; isLoading: boolean } => {
  const queue = useNeedsAttentionQueue(
    workspaceSlug,
    {
      schemaId: dataEntitySchemaId,
      caseKinds: DS_QUEUE_CASE_KINDS,
      scope: scope === 'all' ? 'workspace' : scope
    },
    enabled
  );

  return {
    items: queue.items.map(item => ({
      case: item.case,
      assignment: item.assignment,
      dataset: item.entity
    })),
    isLoading: queue.isLoading
  };
};
