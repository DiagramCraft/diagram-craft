import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';

export const entityTableWidgetConfigSchema = z.object({
  schema: z.string().optional(),
  owner: z.string().optional(),
  lifecycle: z.string().optional(),
  limit: withInitial(z.number().int().optional(), 10)
});

export type EntityTableWidgetConfig = z.infer<typeof entityTableWidgetConfigSchema>;
