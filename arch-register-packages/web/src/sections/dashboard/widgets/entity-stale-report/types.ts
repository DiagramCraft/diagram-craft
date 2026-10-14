import type { TElement } from 'platejs';

export interface EntityStaleReportSlateElement extends TElement {}

export type EntityStaleReportProps = {
  /** Number of days without an update before an entity counts as stale. */
  staleAfterDays?: number;
};
