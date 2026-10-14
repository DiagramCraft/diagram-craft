import type { TElement } from 'platejs';
import { z } from 'zod';

export interface EntityStaleReportSlateElement extends TElement {}

export const entityStaleReportPropsSchema = z.object({
  /** Number of days without an update before an entity counts as stale. */
  staleAfterDays: z.number().int().optional()
});

export type EntityStaleReportProps = z.infer<typeof entityStaleReportPropsSchema>;
