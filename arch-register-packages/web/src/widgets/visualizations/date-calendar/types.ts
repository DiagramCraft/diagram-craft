import { hasWidgetRecordSource } from '../../../hooks/useEntityQueryText';
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
    /** Date field that decides which month/week a record lands in. */
    dateFieldId: withInitial(z.string().trim().min(1), ''),
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
  .refine(hasWidgetRecordSource, { message: 'Needs a query or an entity query' });

export type DateCalendarWidgetConfig = z.infer<typeof dateCalendarWidgetConfigSchema>;
