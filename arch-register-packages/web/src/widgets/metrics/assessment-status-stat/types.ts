import { ASSESSMENT_STATUSES } from '../../shared/data/assessmentSummaryLogic';
import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';

export const assessmentStatusStatConfigSchema = z.object({
  /** Name of the entity schema the assessments must target (`assessment.scope`). */
  schemaName: withInitial(z.string().min(1), ''),
  status: withInitial(z.enum(ASSESSMENT_STATUSES), 'overdue'),
  /** May contain `{count}`, `{total}` and `{notStarted}`. */
  subtextTemplate: z.string().optional()
});

export type AssessmentStatusStatConfig = z.infer<typeof assessmentStatusStatConfigSchema>;
