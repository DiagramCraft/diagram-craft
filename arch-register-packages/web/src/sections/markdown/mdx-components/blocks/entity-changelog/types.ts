import type { TElement } from 'platejs';
import { z } from 'zod';

export interface EntityChangelogSlateElement extends TElement {
  entityId?: string;
  schema?: string;
  owner?: string;
  lifecycle?: string;
  limit?: string;
  since?: string;
}

export const entityChangelogWidgetConfigSchema = z
  .object({
    entityId: z.string().optional(),
    schema: z.string().optional(),
    owner: z.string().optional(),
    lifecycle: z.string().optional(),
    limit: z.string().optional(),
    since: z.string().optional()
  })
  .refine(config => !!(config.entityId || config.schema || config.owner || config.lifecycle), {
    message: 'Needs an entity or at least one filter'
  });

export type EntityChangelogWidgetConfig = z.infer<typeof entityChangelogWidgetConfigSchema>;
