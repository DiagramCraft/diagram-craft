import { z } from 'zod';
import { needsAttentionScopeSchema } from '../../data-views/needs-attention/needsAttentionQueue';
import { withInitial } from '../../shared/configSchema';

export const CASE_COUNT_TONES = ['none', 'warning', 'danger'] as const;

export const caseCountWidgetConfigSchema = z.object({
  /** Schema id. Either this or `schemaName` identifies the entity type the cases are against. */
  schema: withInitial(z.string().default(''), ''),
  /** Schema name, resolved against the live workspace schemas (used by seeded dashboards). */
  schemaName: z.string().optional(),
  /** Case kinds counted. */
  caseKinds: withInitial(
    z.array(z.string()).min(1).default(['entity.change-case', 'entity.deprecation']),
    ['entity.change-case', 'entity.deprecation']
  ),
  scope: withInitial(needsAttentionScopeSchema.default('workspace'), 'workspace'),
  /** Colour of the number when the count is above zero. */
  tone: withInitial(z.enum(CASE_COUNT_TONES).default('none'), 'none'),
  /** May contain `{count}` and `{due}` (cases due within `dueWithinDays`). */
  subtextTemplate: withInitial(
    z.string().default('{due} due within a week'),
    '{due} due within a week'
  ),
  dueWithinDays: withInitial(z.number().default(7), 7)
});

export type CaseCountWidgetConfig = z.infer<typeof caseCountWidgetConfigSchema>;
