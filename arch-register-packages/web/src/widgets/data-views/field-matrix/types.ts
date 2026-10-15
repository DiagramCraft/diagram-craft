import { hasWidgetRecordSource } from '../../../hooks/useEntityQueryText';
import { fieldMatrixBandSchema } from './fieldMatrixLogic';
import { z } from 'zod';
import { entityQuerySchema } from '@arch-register/api-types/entityQueryIR';
import { withInitial } from '../../shared/configSchema';

export const fieldMatrixWidgetConfigSchema = z
  .object({
    /** Entity-query DSL text selecting the records to place. */
    query: withInitial(z.string().optional(), ''),
    /** Structured alternative to `query`; may reference dashboard sidebar `$variables`. */
    entityQuery: entityQuerySchema.optional(),
    /** Root schema name `entityQuery`'s field names resolve against. */
    schemaName: z.string().optional(),
    /** Numeric field whose value picks the row. */
    rowFieldId: withInitial(z.string().trim().min(1), ''),
    /** Row values, in display order (top to bottom). */
    rows: withInitial(z.array(z.number()).min(1), [3, 2, 1]),
    /** Numeric field whose value picks the column band. */
    valueFieldId: withInitial(z.string().trim().min(1), ''),
    /** Column bands, ascending by `min`. */
    bands: withInitial(z.array(fieldMatrixBandSchema).min(1), [
      { label: 'Low', min: 0, tone: 'good' },
      { label: 'High', min: 3, tone: 'bad' }
    ]),
    /** Emphasise cells in `hot` bands for rows at or above this value. */
    hotRowMin: z.number().optional(),
    /** Corner label, e.g. "criticality ↓ / risk →". */
    cornerLabel: z.string().optional(),
    /** Show the widget frame (border, title) around the matrix; defaults to true. */
    showFrame: z.boolean().optional()
  })
  .refine(hasWidgetRecordSource, { message: 'Needs a query or an entity query' });

export type FieldMatrixWidgetConfig = z.infer<typeof fieldMatrixWidgetConfigSchema>;
