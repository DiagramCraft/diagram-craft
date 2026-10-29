import { z } from 'zod';
import { needsAttentionSeveritySchema } from '../needs-attention/needsAttentionQueue';
import { withInitial } from '../../shared/configSchema';

export const changeCaseTableConfigSchema = z.object({
  /** Name of the entity schema the cases' subject entities must belong to. */
  schemaName: withInitial(z.string().min(1), ''),
  caseKinds: withInitial(z.array(z.string()).min(1), ['entity.change-case']),
  severity: withInitial(needsAttentionSeveritySchema, 'due-date'),
  /**
   * Only list cases in this status (`open`, `completed` or `cancelled`). Any other value —
   * including an unresolved or empty `$variable` from a dashboard sidebar — means no filter.
   */
  status: z.string().optional()
});

export type ChangeCaseTableConfig = z.infer<typeof changeCaseTableConfigSchema>;
