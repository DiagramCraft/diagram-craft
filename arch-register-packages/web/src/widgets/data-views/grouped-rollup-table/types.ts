import { hasWidgetRecordSource } from '../../../hooks/useEntityQueryText';
import { z } from 'zod';
import { entityQuerySchema } from '@arch-register/api-types/entityQueryIR';
import { withInitial } from '../../shared/configSchema';

export const groupedRollupTableWidgetConfigSchema = z
  .object({
    /** Entity-query DSL text selecting the records to roll up. */
    query: withInitial(z.string().optional(), ''),
    /** Structured alternative to `query`; may reference dashboard sidebar `$variables`. */
    entityQuery: entityQuerySchema.optional(),
    /** Root schema name `entityQuery`'s field names resolve against. */
    schemaName: z.string().optional(),
    /** Field to group by. Blank lists one row per record. */
    groupFieldId: z.string().optional(),
    /** Number or currency field summed per row. */
    valueFieldId: withInitial(z.string().trim().min(1), ''),
    /** Column header for the group/name column. */
    groupLabel: z.string().optional(),
    /** Column header for the value column. */
    valueLabel: z.string().optional(),
    /** Draw each row's value relative to the largest row. */
    showBar: z.boolean().optional(),
    /** Show each row's share of the total as a percentage. */
    showPercent: z.boolean().optional(),
    /** Show how many records each row covers. */
    showCount: z.boolean().optional(),
    /** Show a total row at the bottom. */
    showTotal: z.boolean().optional(),
    limit: z.number().positive().optional()
  })
  .refine(hasWidgetRecordSource, { message: 'Needs a query or an entity query' });

export type GroupedRollupTableWidgetConfig = z.infer<typeof groupedRollupTableWidgetConfigSchema>;
