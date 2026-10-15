import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';

export const topEntitiesWidgetConfigSchema = z
  .object({
    /** Schema id. Either this or `schemaName` identifies the ranked entity type. */
    schema: withInitial(z.string().default(''), ''),
    /** Schema name, resolved against the live workspace schemas (used by seeded dashboards). */
    schemaName: z.string().optional().optional(),
    owner: z.string().optional(),
    lifecycle: z.string().optional(),
    /** Numeric field the entities are ranked by. */
    fieldId: withInitial(z.string(), ''),
    /**
     * Typed-relation field (id or name) on the schema; when set, entities are ranked by how many
     * relations of that field point from them, instead of by `fieldId`.
     */
    relationFieldName: z.string().optional(),
    direction: withInitial(z.enum(['asc', 'desc']), 'desc'),
    limit: withInitial(z.number().positive(), 5),
    /** Draw each row's share of the listed total as a bar under the name. */
    showShareBar: z.boolean().optional(),
    /** Show the "View in catalog" footer link. Default true. */
    showLink: z.boolean().optional()
  })
  .refine(config => config.schema.length > 0 || !!config.schemaName, {
    message: 'Needs a schema or a schema name'
  })
  .refine(config => config.fieldId.length > 0 || !!config.relationFieldName, {
    message: 'Needs a field or a relation field to rank by'
  });

export type TopEntitiesWidgetConfig = z.infer<typeof topEntitiesWidgetConfigSchema>;
