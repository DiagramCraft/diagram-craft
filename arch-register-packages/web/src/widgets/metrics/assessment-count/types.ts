import { assessmentWidgetModeSchema } from '../assessments/assessmentsWidgetLogic';
import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';

export const assessmentCountWidgetConfigSchema = z.object({
  mode: withInitial(assessmentWidgetModeSchema, 'active'),
  assessmentTypeId: z.string().optional(),
  /** Entity schema names; counts assessments scoped to any of them. */
  schemaNames: z.array(z.string()).optional(),
  /** Counts open assessments due within this many days, overdue ones included. */
  dueWithinDays: z.number().optional(),
  subtext: z.string().optional()
});

export type AssessmentCountWidgetConfig = z.infer<typeof assessmentCountWidgetConfigSchema>;
