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
    fieldId: withInitial(z.string().min(1), ''),
    direction: withInitial(z.enum(['asc', 'desc']), 'desc'),
    limit: withInitial(z.number().positive(), 5),
    /** Draw each row's share of the listed total as a bar under the name. */
    showShareBar: z.boolean().optional(),
    /** Show the "View in catalog" footer link. Default true. */
    showLink: z.boolean().optional()
  })
  .refine(config => config.schema.length > 0 || !!config.schemaName, {
    message: 'Needs a schema or a schema name'
  });

export type TopEntitiesWidgetConfig = z.infer<typeof topEntitiesWidgetConfigSchema>;
