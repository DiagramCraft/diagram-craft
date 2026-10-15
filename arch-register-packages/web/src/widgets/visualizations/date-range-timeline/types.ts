import { hasWidgetRecordSource } from '../../../hooks/useEntityQueryText';
import { z } from 'zod';
import { entityQuerySchema } from '@arch-register/api-types/entityQueryIR';
import { withInitial } from '../../shared/configSchema';

export const dateRangeTimelineWidgetConfigSchema = z
  .object({
    /** Entity-query DSL text selecting the records to plot. */
    query: withInitial(z.string().optional(), ''),
    /** Structured alternative to `query`; may reference dashboard sidebar `$variables`. */
    entityQuery: entityQuerySchema.optional(),
    /** Root schema name `entityQuery`'s field names resolve against. */
    schemaName: z.string().optional(),
    startFieldId: withInitial(z.string().trim().min(1), ''),
    endFieldId: withInitial(z.string().trim().min(1), ''),
    /** Optional field shown under the name; a reference/containment field shows the target's name. */
    sublabelFieldId: z.string().optional(),
    /** Optional number/currency field shown inside each bar. */
    valueFieldId: z.string().optional(),
    /** Duration field (or number of days) giving a marker that many days before the end date, e.g. a notice period. */
    markerOffsetFieldId: z.string().optional(),
    /** Boolean field that must be true for the marker to be drawn. */
    markerWhenFieldId: z.string().optional(),
    /** Bar turns red when ended (or ending within `critWithinDays`) and orange within `warnWithinDays`. */
    critWithinDays: z.number().optional(),
    warnWithinDays: z.number().optional()
  })
  .refine(hasWidgetRecordSource, { message: 'Needs a query or an entity query' });

export type DateRangeTimelineWidgetConfig = z.infer<typeof dateRangeTimelineWidgetConfigSchema>;
