import { useQuery } from '@tanstack/react-query';
import type { GovernanceCase } from '@arch-register/api-types/governanceContract';
import { governanceCaseSubjectsQuery } from '../../queries/governance';
import { ENTITY_CHANGE_BULK_CASE_KIND } from '../../utils/governanceCaseKinds';

/**
 * Loads what the My work lists need to describe each case's subject (entity, document, bulk and
 * single change proposals) in a single request and returns a `resolve` function that turns a case
 * into its display data.
 */
export const useCaseSubjects = (workspace: string, cases: GovernanceCase[]) => {
  const refs = cases.map(c => ({
    caseId: c.id,
    caseKind: c.caseKind,
    subjectType: c.subjectType,
    subjectId: c.subjectId
  }));
  const { data: subjectsByCaseId } = useQuery(governanceCaseSubjectsQuery(workspace, refs));

  const resolve = (kase: GovernanceCase) => {
    const isBulk = kase.caseKind === ENTITY_CHANGE_BULK_CASE_KIND;
    const subject = subjectsByCaseId?.[kase.id];
    const bulkMembers = (subject?.bulkMembers ?? []).map(member => ({
      _uid: member.uid,
      _publicId: member.publicId,
      _name: member.name
    }));
    const assessmentName =
      kase.subjectType === 'assessment' ? (kase.payload['name'] as string | undefined) : undefined;
    const label = isBulk
      ? `${subject?.bulkEntityCount ?? 0} entities`
      : (subject?.label ?? assessmentName ?? kase.subjectId);
    const proposal = subject?.proposal ?? undefined;
    const latestRevision = subject?.latestRevision ?? undefined;
    return { isBulk, label, bulkMembers, proposal, latestRevision, note: latestRevision?.message };
  };

  // Withdrawing an entity-change proposal whose case had already completed (e.g. after a
  // 'request_changes' decision) updates the proposal, not the case — `cancelCaseIfOpen` is a
  // no-op on a case that's no longer open, so the case's status/outcome alone can't tell a
  // withdrawn proposal apart from one still awaiting revision. Fall back to the proposal's own
  // status for entity-change cases.
  const isProposalWithdrawn = (kase: GovernanceCase) =>
    kase.caseKind !== ENTITY_CHANGE_BULK_CASE_KIND &&
    subjectsByCaseId?.[kase.id]?.proposal?.status === 'withdrawn';

  return { resolve, isProposalWithdrawn };
};

export type CaseSubject = ReturnType<ReturnType<typeof useCaseSubjects>['resolve']>;
