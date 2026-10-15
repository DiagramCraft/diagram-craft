import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';

export const countByFieldWidgetConfigSchema = z.object({
  schemaName: withInitial(z.string().min(1), ''),
  /** Field whose distinct values define the bar segments. */
  fieldId: withInitial(z.string().min(1), '')
});

export type CountByFieldWidgetConfig = z.infer<typeof countByFieldWidgetConfigSchema>;
