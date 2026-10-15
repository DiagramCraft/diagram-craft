import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';

export const upcomingByDateWidgetConfigSchema = z.object({
  /** Entity-query DSL text selecting the records to list. */
  query: withInitial(z.string().trim().min(1), ''),
  /** Date field the list is ordered by. */
  dateFieldId: withInitial(z.string().trim().min(1), ''),
  /** Only show records due within this many days. */
  windowDays: z.number().optional(),
  /** Also show records whose date has passed. */
  includeOverdue: z.boolean().optional(),
  limit: z.number().optional(),
  /** Optional field shown under the name; a reference/containment field shows the target's name. */
  sublabelFieldId: z.string().optional(),
  /** Optional number/currency field shown on the right. */
  valueFieldId: z.string().optional(),
  /** Countdown turns red within this many days (default 30) and orange within `warnWithinDays`. */
  critWithinDays: z.number().optional(),
  warnWithinDays: z.number().optional()
});

export type UpcomingByDateWidgetConfig = z.infer<typeof upcomingByDateWidgetConfigSchema>;
