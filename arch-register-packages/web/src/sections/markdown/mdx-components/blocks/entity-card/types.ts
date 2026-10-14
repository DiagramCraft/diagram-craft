import { z } from 'zod';
import { withInitial } from '../../configSchema';

export const entityCardWidgetConfigSchema = z.object({
  entityId: withInitial(z.string().min(1), ''),
  fields: z.string().optional()
});

export type EntityCardWidgetConfig = z.infer<typeof entityCardWidgetConfigSchema>;
