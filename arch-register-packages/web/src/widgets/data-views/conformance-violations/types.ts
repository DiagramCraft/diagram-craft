import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';

export const conformanceViolationsWidgetConfigSchema = z.object({
  schemaName: withInitial(z.string().min(1), ''),
  /** Only show violations raised by these checks (all checks when empty). */
  checkNames: z.array(z.string()).optional(),
  limit: withInitial(z.number().positive(), 8)
});

export type ConformanceViolationsWidgetConfig = z.infer<
  typeof conformanceViolationsWidgetConfigSchema
>;
