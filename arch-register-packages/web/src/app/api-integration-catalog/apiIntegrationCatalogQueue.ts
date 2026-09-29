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
 * The join/filter/scope logic this queue used to implement independently now lives in the shared
 * `useNeedsAttentionQueue` (`../../sections/dashboard/widgets/needsAttentionQueue.ts`, #3466) — this
 * module only keeps the case-kind constant, since it's app-specific.
 */
export const IC_QUEUE_CASE_KINDS = ['entity.change-case', 'entity.deprecation'] as const;
