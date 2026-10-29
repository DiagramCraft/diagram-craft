import { assessmentWidgetModeSchema } from './assessmentsWidgetLogic';
import { z } from 'zod';
import { withInitial } from '../../shared/configSchema';

export const assessmentsWidgetConfigSchema = z.object({
  mode: withInitial(assessmentWidgetModeSchema, 'active'),
  assessmentTypeId: z.string().optional(),
  /** Entity schema names; keeps assessments scoped to any of them. */
  schemaNames: z.array(z.string()).optional(),
  /** Shows a day-count due label ("18d" / "6d late") and the owning project, and hides undated
   *  assessments. */
  relativeDue: z.boolean().optional()
});

export type AssessmentsWidgetConfig = z.infer<typeof assessmentsWidgetConfigSchema>;
