import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { GovernanceCase } from '@arch-register/api-types/governanceContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { useGovernanceCases } from '../../hooks/useGovernance';
import { useWorkspaceMembers } from '../../hooks/useWorkspaceMembers';
import { entityDetailQuery } from '../../queries/entities';
import { queueItemPriority, type DataStewardshipQueuePriority } from './dataStewardshipQueue';

/**
 * The single-entity `entity.change-case` kind — the only one Data Stewardship's Change cases view
 * surfaces. Bulk proposals (`entity.change-case.bulk`) are out of scope for this first cut: their
 * `subjectId` is a bulk-proposal id, not an entity id, so joining them to a dataset needs the extra
 * bulk-proposal lookup `GovernanceInboxScreen.tsx` does — same call `dataStewardshipQueue.ts`
 * already made for #3298's My Work queue.
 */
export const CHANGE_CASE_KIND = 'entity.change-case';

export type DataStewardshipChangeCaseRow = {
  case: GovernanceCase;
  dataset: EntityRecord;
  requesterName: string | null;
  /** Derived, not a real field on `GovernanceCase` — see `queueItemPriority` (#3298). */
  risk: DataStewardshipQueuePriority;
};

/**
 * The Change cases view's row list (#3301): every workspace-visible `entity.change-case` case
 * whose subject (`case.subjectId` — the entity id itself for this single-entity case kind, per
 * `entityApprovalWorkflow`'s `canonicalSubjectId`, same field `dataStewardshipQueue.ts` joins
 * against) is a Data Entity of the configured schema. Unlike `useDataStewardshipQueue` (#3298's My
 * Work, scoped to *open* cases across three kinds and a `mine/all/late` split), this reads every
 * status for exactly one kind — a workspace-wide register view, not a personal queue.
 */
export const useDataStewardshipChangeCases = (
  workspaceSlug: string,
  dataEntitySchemaId: string | null
) => {
  const cases = useGovernanceCases(workspaceSlug, {}, dataEntitySchemaId != null);
  const members = useWorkspaceMembers(workspaceSlug);

  const relevantCases = useMemo(
    () =>
      (cases.data ?? []).filter(
        governanceCase =>
          governanceCase.caseKind === CHANGE_CASE_KIND && governanceCase.subjectType === 'entity'
      ),
    [cases.data]
  );

  const entityIds = useMemo(
    () => [...new Set(relevantCases.map(governanceCase => governanceCase.subjectId))],
    [relevantCases]
  );
  const entityQueries = useQueries({
    queries: entityIds.map(entityId => entityDetailQuery(workspaceSlug, entityId))
  });
  const datasetById = useMemo(
    () => new Map(entityIds.map((id, index) => [id, entityQueries[index]?.data])),
    [entityIds, entityQueries]
  );

  const memberNameById = useMemo(
    () => new Map((members.data ?? []).map(member => [member.user_id, member.display_name])),
    [members.data]
  );

  const rows: DataStewardshipChangeCaseRow[] = useMemo(
    () =>
      relevantCases
        .map(governanceCase => {
          const dataset = datasetById.get(governanceCase.subjectId);
          return dataset != null && dataset._schema?.id === dataEntitySchemaId
            ? {
                case: governanceCase,
                dataset,
                requesterName: governanceCase.initiatorUserId
                  ? memberNameById.get(governanceCase.initiatorUserId) ??
                    governanceCase.initiatorUserId
                  : null,
                risk: queueItemPriority(governanceCase)
              }
            : null;
        })
        .filter((row): row is DataStewardshipChangeCaseRow => row != null),
    [relevantCases, datasetById, dataEntitySchemaId, memberNameById]
  );

  return { rows, isLoading: cases.isLoading || members.isLoading };
};
