import { hasWidgetRecordSource } from '../../../hooks/useEntityQueryText';
import { needsAttentionScopeSchema } from '../../data-views/needs-attention/needsAttentionQueue';
import { calendarPeriodSchema } from './dateCalendarLogic';
import { z } from 'zod';
import { entityQuerySchema } from '@arch-register/api-types/entityQueryIR';
import { withInitial } from '../../shared/configSchema';

export const dateCalendarWidgetConfigSchema = z
  .object({
    /** Entity-query DSL text selecting the records to place on the calendar. */
    query: withInitial(z.string().optional(), ''),
    /** Structured alternative to `query`; may reference dashboard sidebar `$variables`. */
    entityQuery: entityQuerySchema.optional(),
    /** Root schema name `entityQuery`'s field names resolve against. */
    schemaName: z.string().optional(),
    /**
     * Case source: instead of a query, place open governance cases (by their due date) against
     * entities of `schemaName` on the calendar. Each entry shows the entity it concerns.
     */
    cases: z
      .object({
        schemaName: z.string().min(1),
        caseKinds: z.array(z.string()).min(1),
        scope: needsAttentionScopeSchema.optional()
      })
      .optional(),
    /** Date field that decides which month/week a record lands in. */
    dateFieldId: withInitial(z.string().trim(), ''),
    period: calendarPeriodSchema.optional(),
    periodCount: z.number().optional(),
    /** Optional field shown under the name; a reference/containment field shows the target's name. */
    sublabelFieldId: z.string().optional(),
    /** Optional number/currency field shown on each entry and summed in each cell header. */
    valueFieldId: z.string().optional(),
    /** Entry border turns red when overdue (or within this many days) and orange within `warnWithinDays`. */
    critWithinDays: z.number().optional(),
    warnWithinDays: z.number().optional()
  })
  .refine(config => config.cases !== undefined || hasWidgetRecordSource(config), {
    message: 'Needs a query, an entity query or a case source'
  })
  .refine(config => config.cases !== undefined || config.dateFieldId.length > 0, {
    message: 'Needs a date field'
  });

export type DateCalendarWidgetConfig = z.infer<typeof dateCalendarWidgetConfigSchema>;
