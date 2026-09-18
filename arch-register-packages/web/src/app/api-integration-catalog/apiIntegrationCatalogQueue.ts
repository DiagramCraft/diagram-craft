import { useQueries } from '@tanstack/react-query';
import type { GovernanceCase } from '@arch-register/api-types/governanceContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { useGovernanceCases } from '../../hooks/useGovernance';
import { entityDetailQuery } from '../../queries/entities';

/**
 * Governance case kinds the Overview section's "Needs attention" queue draws on — the same generic
 * entity-change/deprecation approval machinery Data Stewardship's "My work" queue reuses (see
 * `../data-stewardship/dataStewardshipQueue.ts`'s doc comment for the server-side constants this is
 * verified against: `ENTITY_CHANGE_CASE_KIND`/`ENTITY_DEPRECATION_CASE_KIND` in
 * `server/src/domain/catalog/entityChangeOperations.ts` / `entityDeprecationOperations.ts`).
 *
 * Unlike Data Stewardship's queue, `field-date-reminder` isn't included: that machinery reminds
 * about a due date on a *dataset* field (#3067), and has no analog on API entities.
 *
 * An empty queue reads the same whether no approval workflow is configured for `api`-schema
 * entities at all, or one is configured and there's simply nothing open right now — there's no
 * client-visible endpoint reporting whether a `entity.change-case`/`entity.deprecation` workflow is
 * configured for a given schema (workspace settings' workflow editor is a write-only admin surface,
 * not a query this dashboard can reuse), so this can't honestly be distinguished. Same
 * characteristic as `DataStewardshipMyWorkScreen.tsx`'s "My work" queue.
 */
export const IC_QUEUE_CASE_KINDS = ['entity.change-case', 'entity.deprecation'] as const;

export type ApiIntegrationCatalogQueueItem = {
  case: GovernanceCase;
  api: EntityRecord;
};

const isRelevantCase = (governanceCase: GovernanceCase): boolean =>
  governanceCase.subjectType === 'entity' &&
  (IC_QUEUE_CASE_KINDS as readonly string[]).includes(governanceCase.caseKind);

/**
 * Open entity-change and deprecation cases against `api`-schema entities — the workspace-wide
 * "needs attention" queue for the Overview section's dashboard, not a personal worklist (there's no
 * "assigned to me" scope here, unlike Data Stewardship's My Work). Joins each case's `subjectId`
 * against its full entity detail to confirm the subject is actually an API (`_schema.id` matches
 * `apiSchemaId`) and to get its name/publicId for display — mirrors
 * `../data-stewardship/dataStewardshipQueue.ts`'s `useDataStewardshipQueue`.
 */
export const useApiIntegrationCatalogQueue = (
  workspaceSlug: string,
  apiSchemaId: string | null,
  enabled = true
): { items: ApiIntegrationCatalogQueueItem[]; isLoading: boolean } => {
  const cases = useGovernanceCases(
    workspaceSlug,
    { status: 'open', subjectType: 'entity' },
    enabled && !!apiSchemaId
  );

  const relevant = (cases.data ?? []).filter(isRelevantCase);
  const entityIds = [...new Set(relevant.map(governanceCase => governanceCase.subjectId))];
  const entityQueries = useQueries({
    queries: entityIds.map(entityId => entityDetailQuery(workspaceSlug, entityId))
  });
  const apiById = new Map(entityIds.map((id, index) => [id, entityQueries[index]?.data]));

  const items: ApiIntegrationCatalogQueueItem[] = relevant
    .map(governanceCase => ({ case: governanceCase, api: apiById.get(governanceCase.subjectId) }))
    .filter(
      (entry): entry is ApiIntegrationCatalogQueueItem =>
        entry.api != null && entry.api._schema?.id === apiSchemaId
    );

  return { items, isLoading: cases.isLoading };
};
