import { ASSESSMENT_STATUSES } from '../../shared/data/assessmentSummaryLogic';
import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';

export const assessmentProgressTableConfigSchema = z.object({
  /** Name of the entity schema the assessments must target (`assessment.scope`). */
  schemaName: withInitial(z.string().min(1), ''),
  /** Optional: only list assessments in this derived status. */
  status: z.enum(ASSESSMENT_STATUSES).optional()
});

export type AssessmentProgressTableConfig = z.infer<typeof assessmentProgressTableConfigSchema>;
