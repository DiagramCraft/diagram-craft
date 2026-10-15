import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';

/** The hub, its provider/consumer fields and the coverage relation: what both widgets compute from. */
export const relationPairsSourceShape = {
  /** Display name of the hub entity schema (e.g. `API`) that providers and consumers attach to. */
  hubSchemaName: withInitial(z.string().min(1), ''),
  /** Typed-relation field (id or name) on the hub schema listing its providers. */
  providerFieldName: withInitial(z.string().min(1), ''),
  /** Typed-relation field (id or name) on the hub schema listing its consumers. */
  consumerFieldName: withInitial(z.string().min(1), ''),
  /** Relation type (by name) whose instances between a provider and a consumer count as coverage. */
  coverageRelationSchemaName: withInitial(z.string().min(1), '')
};

export type RelationPairsSourceConfig = z.infer<z.ZodObject<typeof relationPairsSourceShape>>;

export const relationPairsCoverageWidgetConfigSchema = z.object({
  ...relationPairsSourceShape,
  /** Column headings; default to the schema/field names. */
  hubLabel: z.string().optional(),
  providerLabel: z.string().optional(),
  consumerLabel: z.string().optional(),
  coverageLabel: z.string().optional()
});

export type RelationPairsCoverageWidgetConfig = z.infer<
  typeof relationPairsCoverageWidgetConfigSchema
>;
