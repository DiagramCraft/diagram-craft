import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';

export const entityChangelogWidgetConfigSchema = z
  .object({
    entityId: z.string().optional(),
    schema: z.string().optional(),
    owner: z.string().optional(),
    lifecycle: z.string().optional(),
    limit: withInitial(z.string().optional(), '10'),
    since: withInitial(z.string().optional(), '30d')
  })
  .refine(config => !!(config.entityId || config.schema || config.owner || config.lifecycle), {
    message: 'Needs an entity or at least one filter'
  });

export type EntityChangelogWidgetConfig = z.infer<typeof entityChangelogWidgetConfigSchema>;
