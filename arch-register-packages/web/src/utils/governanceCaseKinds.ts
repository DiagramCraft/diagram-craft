/**
 * Case kinds the web app special-cases. Mirrors the server's `*_CASE_KIND` constants (see
 * `entityChangeOperations.ts`, `relationChangeOperations.ts`, `documentWorkflowOperations.ts`);
 * keep them in one place so a rename can't leave a stale string literal behind.
 */
export const ENTITY_CHANGE_CASE_KIND = 'entity.change-case';
export const ENTITY_CHANGE_BULK_CASE_KIND = 'entity.change-case.bulk';
export const RELATION_CHANGE_CASE_KIND = 'relation.change-case';
export const DOCUMENT_STATUS_CASE_KIND = 'document.status';

/**
 * Cases of these kinds can be sent back for revision rather than only approved/rejected outright.
 * Shared by the My work lists and the case drawer so both offer "Request changes" identically.
 */
export const REQUEST_CHANGES_CASE_KINDS: ReadonlySet<string> = new Set([
  ENTITY_CHANGE_CASE_KIND,
  ENTITY_CHANGE_BULK_CASE_KIND,
  RELATION_CHANGE_CASE_KIND,
  DOCUMENT_STATUS_CASE_KIND
]);

/** Entity change proposals (single or bulk), which carry their own proposal lifecycle. */
export const isEntityChangeCaseKind = (caseKind: string): boolean =>
  caseKind === ENTITY_CHANGE_CASE_KIND || caseKind === ENTITY_CHANGE_BULK_CASE_KIND;
