import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import type {
  GovernanceAssignment,
  GovernanceCase
} from '@arch-register/api-types/governanceContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { useGovernanceCases, useGovernanceTasks } from '../../../hooks/useGovernance';
import { entityDetailQuery } from '../../../queries/entities';

/**
 * The join/filter/severity logic shared by every "needs attention" governance-case queue in the
 * app: open (or, for `'mine'`, assigned) cases against entities of one schema, restricted to a set
 * of case kinds. Extracted from API & Integration Catalog's and Data Stewardship's independently
 * built queues (#3466) — both joined each case's `subjectId` against its full entity detail via
 * `entityDetailQuery` and filtered to `entity._schema?.id === schemaId` the same way.
 */
export type NeedsAttentionScope = 'workspace' | 'mine' | 'late';

/**
 * `'none'` — no derived priority (a bare list of open cases). `'due-date'` — priority derived from
 * a case's `dueAt`/`escalatedAt`, since `governanceCaseSchema` has no priority/severity field of
 * its own.
 */
export type NeedsAttentionSeverity = 'none' | 'due-date';

export type NeedsAttentionPriority = 'high' | 'medium' | 'low';

export type NeedsAttentionQueueItem = {
  case: GovernanceCase;
  assignment: GovernanceAssignment | null;
  entity: EntityRecord;
};

export const isCaseOverdue = (governanceCase: GovernanceCase, now: Date = new Date()): boolean =>
  governanceCase.dueAt != null && new Date(governanceCase.dueAt) < now;

/**
 * Priority bucket for a queue item — **derived**, not a real field: `high` if escalated or
 * overdue, `medium` if due within 7 days, otherwise `low`.
 */
export const deriveDueDatePriority = (
  governanceCase: GovernanceCase,
  now: Date = new Date()
): NeedsAttentionPriority => {
  if (governanceCase.escalatedAt != null) return 'high';
  if (governanceCase.dueAt == null) return 'low';
  const due = new Date(governanceCase.dueAt);
  if (due < now) return 'high';
  const daysUntilDue = (due.getTime() - now.getTime()) / 86400000;
  return daysUntilDue <= 7 ? 'medium' : 'low';
};

export type NeedsAttentionQueueConfig = {
  schemaId: string | null;
  caseKinds: readonly string[];
  scope: NeedsAttentionScope;
};

const isRelevantCase = (governanceCase: GovernanceCase, caseKinds: readonly string[]): boolean =>
  governanceCase.subjectType === 'entity' && caseKinds.includes(governanceCase.caseKind);

/**
 * The workspace-wide (or, for `scope: 'mine'`, personal) queue of open governance cases against
 * entities of `schemaId`, restricted to `caseKinds`. Unifies the query-selection, case-kind
 * filtering, overdue filtering (`scope: 'late'`), and entity join that API & Integration Catalog's
 * and Data Stewardship's own queues each implemented separately.
 */
export const useNeedsAttentionQueue = (
  workspaceSlug: string,
  { schemaId, caseKinds, scope }: NeedsAttentionQueueConfig,
  enabled = true
): { items: NeedsAttentionQueueItem[]; isLoading: boolean; isError: boolean } => {
  const now = useMemo(() => new Date(), []);

  const tasks = useGovernanceTasks(
    workspaceSlug,
    { state: 'open' },
    enabled && !!schemaId && scope === 'mine'
  );
  const cases = useGovernanceCases(
    workspaceSlug,
    { status: 'open', subjectType: 'entity' },
    enabled && !!schemaId && scope !== 'mine'
  );

  const rawEntries: { case: GovernanceCase; assignment: GovernanceAssignment | null }[] =
    scope === 'mine'
      ? (tasks.data ?? []).map(task => ({ case: task.case, assignment: task.assignment }))
      : (cases.data ?? []).map(governanceCase => ({ case: governanceCase, assignment: null }));

  const relevant = rawEntries.filter(entry => isRelevantCase(entry.case, caseKinds));
  const scoped = scope === 'late' ? relevant.filter(entry => isCaseOverdue(entry.case, now)) : relevant;

  const entityIds = [...new Set(scoped.map(entry => entry.case.subjectId))];
  const entityQueries = useQueries({
    queries: entityIds.map(entityId => entityDetailQuery(workspaceSlug, entityId))
  });
  const entityById = new Map(entityIds.map((id, index) => [id, entityQueries[index]?.data]));

  const items: NeedsAttentionQueueItem[] = scoped
    .map(entry => ({ ...entry, entity: entityById.get(entry.case.subjectId) }))
    .filter(
      (entry): entry is NeedsAttentionQueueItem =>
        entry.entity != null && entry.entity._schema?.id === schemaId
    );

  const isLoading = scope === 'mine' ? tasks.isLoading : cases.isLoading;
  const isError = scope === 'mine' ? tasks.isError : cases.isError;

  return { items, isLoading, isError };
};
