/**
 * Human-readable presentation for governance case kinds, shared by `GovernanceInboxScreen.tsx`
 * and Data Stewardship's "My work" queue (#3298) — extracted out of `GovernanceInboxScreen.tsx`
 * once a second screen needed the identical logic, rather than duplicating it.
 */
export const humanizeCaseKind = (value: string): string =>
  value.replace(/[._-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase());

export const caseKindLabel = (caseKind: string, payload: Record<string, unknown>): string => {
  if (caseKind === 'field-date-reminder') {
    const fieldName = payload['fieldName'];
    return typeof fieldName === 'string' ? `Date reminder · ${fieldName}` : 'Date reminder';
  }
  return humanizeCaseKind(caseKind);
};
