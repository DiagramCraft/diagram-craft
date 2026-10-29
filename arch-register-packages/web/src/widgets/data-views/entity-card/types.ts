import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';

export const entityCardWidgetConfigSchema = z.object({
  entityId: withInitial(z.string().min(1), ''),
  fields: z.string().optional()
});

export type EntityCardWidgetConfig = z.infer<typeof entityCardWidgetConfigSchema>;
