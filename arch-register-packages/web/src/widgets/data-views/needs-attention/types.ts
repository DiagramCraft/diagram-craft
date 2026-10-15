import { needsAttentionScopeSchema, needsAttentionSeveritySchema } from './needsAttentionQueue';
import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';

export const needsAttentionWidgetConfigSchema = z.object({
  /** Schema id. Either this or `schemaName` identifies the entity type the cases are against. */
  schema: withInitial(z.string(), ''),
  /** Schema name, resolved against the live workspace schemas (used by seeded dashboards). */
  schemaName: z.string().optional(),
  caseKinds: withInitial(z.array(z.string()).min(1), ['entity.change-case', 'entity.deprecation']),
  scope: withInitial(needsAttentionScopeSchema, 'workspace'),
  severity: withInitial(needsAttentionSeveritySchema, 'due-date'),
  limit: withInitial(z.number().positive(), 8)
});

export type NeedsAttentionWidgetConfig = z.infer<typeof needsAttentionWidgetConfigSchema>;
