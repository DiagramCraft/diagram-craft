import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';

export const ratioBarListWidgetConfigSchema = z.object({
  schemaName: withInitial(z.string().min(1), ''),
  /** Field whose value defines a bar (one bar per distinct value). */
  groupByFieldId: withInitial(z.string().min(1), ''),
  /** A bar's filled share is the entities with `numeratorFieldId = numeratorValue`. */
  numeratorFieldId: withInitial(z.string().min(1), ''),
  numeratorValue: withInitial(z.string().min(1), '')
});

export type RatioBarListWidgetConfig = z.infer<typeof ratioBarListWidgetConfigSchema>;
