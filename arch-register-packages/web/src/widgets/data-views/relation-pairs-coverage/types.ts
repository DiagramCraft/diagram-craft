import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';

export const relationPairsCoverageWidgetConfigSchema = z.object({
  /** Display name of the hub entity schema (e.g. `API`) that providers and consumers attach to. */
  hubSchemaName: withInitial(z.string().min(1), ''),
  /** Typed-relation field (id or name) on the hub schema listing its providers. */
  providerFieldName: withInitial(z.string().min(1), ''),
  /** Typed-relation field (id or name) on the hub schema listing its consumers. */
  consumerFieldName: withInitial(z.string().min(1), ''),
  /** Relation type (by name) whose instances between a provider and a consumer count as coverage. */
  coverageRelationSchemaName: withInitial(z.string().min(1), ''),
  /** `table` lists every pair; `stat` shows a single tile with the number of pairs lacking coverage. */
  display: z.enum(['table', 'stat']).optional(),
  /** Column headings; default to the schema/field names. */
  hubLabel: z.string().optional(),
  providerLabel: z.string().optional(),
  consumerLabel: z.string().optional(),
  coverageLabel: z.string().optional()
});

export type RelationPairsCoverageWidgetConfig = z.infer<
  typeof relationPairsCoverageWidgetConfigSchema
>;
