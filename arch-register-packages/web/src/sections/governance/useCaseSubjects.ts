import { useQueries } from '@tanstack/react-query';
import type { GovernanceCase } from '@arch-register/api-types/governanceContract';
import { entityDetailQuery } from '../../queries/entities';
import { contentFileQuery } from '../../queries/content';
import { bulkEntityChangeQuery, entityChangeQuery } from '../../queries/entityChanges';
import {
  ENTITY_CHANGE_BULK_CASE_KIND,
  ENTITY_CHANGE_CASE_KIND
} from '../../utils/governanceCaseKinds';

const unique = (values: string[]) => [...new Set(values)];

/**
 * Loads what the My work lists need to describe each case's subject (entity, document, bulk and
 * single change proposals) and returns a `resolve` function that turns a case into its display
 * data. Fetches per distinct subject, so the same lookup is shared by every row.
 */
export const useCaseSubjects = (workspace: string, cases: GovernanceCase[]) => {
  const bulkCaseIds = unique(
    cases.filter(c => c.caseKind === ENTITY_CHANGE_BULK_CASE_KIND).map(c => c.subjectId)
  );
  const bulkQueries = useQueries({
    queries: bulkCaseIds.map(caseId => bulkEntityChangeQuery(workspace, caseId))
  });
  const bulkProposalsByCaseId = new Map(
    bulkCaseIds.map((caseId, index) => [caseId, bulkQueries[index]?.data])
  );

  const entityIds = unique([
    ...cases.filter(c => c.subjectType === 'entity').map(c => c.subjectId),
    ...[...bulkProposalsByCaseId.values()].flatMap(proposal => proposal?.entityIds ?? [])
  ]);
  const entityQueries = useQueries({
    queries: entityIds.map(entityId => entityDetailQuery(workspace, entityId))
  });
  const entitiesById = new Map(
    entityIds.map((entityId, index) => [entityId, entityQueries[index]?.data])
  );

  const documentIds = unique(cases.filter(c => c.subjectType === 'document').map(c => c.subjectId));
  const documentQueries = useQueries({
    queries: documentIds.map(fileId => contentFileQuery(workspace, fileId))
  });
  const documentsById = new Map(
    documentIds.map((fileId, index) => [fileId, documentQueries[index]?.data])
  );

  const entityChangeIds = unique(
    cases
      .filter(c => c.caseKind === ENTITY_CHANGE_CASE_KIND && c.subjectType === 'entity')
      .map(c => c.subjectId)
  );
  const proposalQueries = useQueries({
    queries: entityChangeIds.map(entityId => entityChangeQuery(workspace, entityId))
  });
  const proposalsByEntityId = new Map(
    entityChangeIds.map((entityId, index) => [entityId, proposalQueries[index]?.data])
  );

  const resolve = (kase: GovernanceCase) => {
    const isBulk = kase.caseKind === ENTITY_CHANGE_BULK_CASE_KIND;
    const bulkProposal = isBulk ? bulkProposalsByCaseId.get(kase.subjectId) : undefined;
    const bulkMembers = (bulkProposal?.entityIds ?? [])
      .map(entityId => entitiesById.get(entityId))
      .filter(
        (memberEntity): memberEntity is NonNullable<typeof memberEntity> => memberEntity != null
      );
    const subjectEntity =
      kase.subjectType === 'entity' ? entitiesById.get(kase.subjectId) : undefined;
    const subjectDocument =
      kase.subjectType === 'document' ? documentsById.get(kase.subjectId) : undefined;
    const assessmentName =
      kase.subjectType === 'assessment' ? (kase.payload['name'] as string | undefined) : undefined;
    const label = isBulk
      ? `${bulkProposal?.entityIds.length ?? 0} entities`
      : (subjectEntity?._name ?? subjectDocument?.name ?? assessmentName ?? kase.subjectId);
    const proposal = proposalsByEntityId.get(kase.subjectId);
    const latestRevision = isBulk ? bulkProposal?.revisions.at(-1) : proposal?.revisions.at(-1);
    return { isBulk, label, bulkMembers, proposal, latestRevision, note: latestRevision?.message };
  };

  // Withdrawing an entity-change proposal whose case had already completed (e.g. after a
  // 'request_changes' decision) updates the proposal, not the case — `cancelCaseIfOpen` is a
  // no-op on a case that's no longer open, so the case's status/outcome alone can't tell a
  // withdrawn proposal apart from one still awaiting revision. Fall back to the proposal's own
  // status for entity-change cases.
  const isProposalWithdrawn = (kase: GovernanceCase) =>
    kase.caseKind === ENTITY_CHANGE_CASE_KIND &&
    proposalsByEntityId.get(kase.subjectId)?.status === 'withdrawn';

  return { resolve, isProposalWithdrawn };
};

export type CaseSubject = ReturnType<ReturnType<typeof useCaseSubjects>['resolve']>;
