import { relationFacetFilterSchema } from './relationTableLogic';
import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';

export const relationTableWidgetConfigSchema = z.object({
  /** Name of the relation schema whose instances are listed. */
  relationSchemaName: withInitial(z.string().min(1), ''),
  /** Optional entity-query DSL filter, AND-ed with the schema; may reference sidebar `$variables`. */
  filter: z.string().optional(),
  /** Multi-select filters on relation fields (ids or names), e.g. `values: ['$protocols']` bound to
   *  a `facets` sidebar; empty `values` means no constraint. */
  facetFilters: z.array(relationFacetFilterSchema).optional(),
  /** Columns after the Flow (In → Out) column: relation field ids/names, or `_owner`, `_lifecycle`, `_updatedAt`. */
  fieldIds: withInitial(z.array(z.string()), []),
  /** Initial sort column (a `fieldIds` entry, or `_in`/`_out`); a header click re-sorts locally. */
  sort: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
  limit: withInitial(z.number().positive(), 100),
  /** Clicking a row opens a detail drawer for that relation. Default off. */
  rowDrawer: z.boolean().optional()
});

export type RelationTableWidgetConfig = z.infer<typeof relationTableWidgetConfigSchema>;
