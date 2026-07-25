import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';
import { filterConditionSchema } from '@arch-register/api-types/viewContract';

const wsAndAssessmentId = ws.extend({
  assessmentId: z.string().describe('Assessment identifier')
});

const requirementLevelSchema = z
  .enum(['required', 'optional'])
  .describe('Whether a response to this field is required or optional');

const baseAssessmentFieldSchema = z.object({
  id: z.string().describe('Unique field identifier'),
  label: z.string().describe('Field label shown to the person completing the assessment'),
  requirementLevel: requirementLevelSchema
});

const ratingAssessmentFieldSchema = baseAssessmentFieldSchema.extend({
  type: z.literal('rating').describe('Numeric score field (1-5)')
});

const assessmentEnumOptionSchema = z.object({
  value: z.string().describe('Stored option value'),
  label: z.string().describe('Displayed option label')
});

const enumAssessmentFieldSchema = z.union([
  baseAssessmentFieldSchema.extend({
    type: z.literal('enum').describe('Single-select field'),
    enumId: z.string().describe('Workspace enumeration identifier used for the option list')
  }),
  baseAssessmentFieldSchema.extend({
    type: z.literal('enum').describe('Single-select field'),
    options: z.array(assessmentEnumOptionSchema).min(1).describe('Assessment-local option list')
  })
]);

const textAssessmentFieldSchema = baseAssessmentFieldSchema.extend({
  type: z.literal('text').describe('Free-text notes field')
});

const assessmentFieldSchema = z
  .union([ratingAssessmentFieldSchema, enumAssessmentFieldSchema, textAssessmentFieldSchema])
  .describe('Assessment field definition');

const assessmentModeSchema = z
  .enum(['fields', 'confirm'])
  .describe(
    'Whether entities are assessed by filling in fields, or by a single "confirmed accurate" action'
  );

const assessmentRecurrenceSchema = z
  .union([
    z.object({ type: z.literal('none') }),
    z.object({
      type: z.literal('weekly'),
      intervalWeeks: z.number().int().min(1).describe('Number of weeks between occurrences')
    }),
    z.object({
      type: z.literal('monthly'),
      intervalMonths: z.number().int().min(1).describe('Number of months between occurrences')
    })
  ])
  .describe('Recurrence rule; "none" means this is a one-off assessment');

const assessmentSchema = z.object({
  id: z.string().describe('Unique assessment identifier'),
  workspace: z.string().describe('Parent workspace identifier'),
  project_id: z.string().describe('Owning project identifier'),
  name: z.string().describe('Assessment name (must be unique within the project)'),
  description: z.string().describe('Assessment description'),
  status: z.enum(['draft', 'open', 'closed', 'archived']).describe('Assessment status'),
  mode: assessmentModeSchema,
  scope: z.array(z.string()).describe('Entity schema ids this assessment applies to'),
  scope_conditions: z
    .array(filterConditionSchema)
    .describe('Additional AND-combined entity filters this assessment scope applies'),
  fields: z.array(assessmentFieldSchema).describe('Assessment field definitions'),
  assigned_team_ids: z
    .array(z.string())
    .describe('Teams assigned to this assessment; surfaced as governance inbox tasks when open'),
  due_at: z
    .string()
    .nullable()
    .describe('Optional ISO 8601 due date applied when the assessment opens'),
  recurrence: assessmentRecurrenceSchema,
  response_window_days: z
    .number()
    .int()
    .min(1)
    .nullable()
    .describe('Days each occurrence stays open before its due date; required when recurring'),
  current_occurrence: z
    .number()
    .int()
    .min(1)
    .describe('The current recurrence cycle number, starting at 1'),
  next_occurrence_at: z
    .string()
    .nullable()
    .describe('ISO 8601 timestamp when this assessment will next automatically reopen'),
  response_count: z.number().int().min(0).describe('Number of entities with a recorded response'),
  completed_entity_count: z
    .number()
    .int()
    .min(0)
    .describe('Number of entities whose response has all required fields filled in'),
  team_acknowledge_status: z
    .array(
      z.object({
        team_id: z.string().describe('Assigned team identifier'),
        team_name: z.string().describe('Assigned team display name'),
        status: z
          .enum(['open', 'completed', 'superseded'])
          .describe('Whether the team has acknowledged this assessment'),
        resolved_at: z
          .string()
          .nullable()
          .describe('ISO 8601 timestamp the team acknowledged, if resolved')
      })
    )
    .describe(
      'Per-team acknowledge status for this assessment, derived from its governance case'
    ),
  created_at: z.string().describe('ISO 8601 creation timestamp'),
  updated_at: z.string().describe('ISO 8601 last update timestamp')
});

const assessmentBodySchema = z
  .object({
    project_id: z.string().describe('Owning project identifier'),
    name: z.string().describe('Assessment name (must be unique within the project)'),
    description: z.preprocess(
      value => (value === undefined ? undefined : typeof value === 'string' ? value : ''),
      z.string().optional().describe('Assessment description')
    ),
    mode: assessmentModeSchema.optional().default('fields'),
    scope: z.preprocess(
      value => (Array.isArray(value) ? value : undefined),
      z.array(z.string()).optional().describe('Entity schema ids this assessment applies to')
    ),
    scope_conditions: z.preprocess(
      value => (Array.isArray(value) ? value : undefined),
      z
        .array(filterConditionSchema)
        .optional()
        .describe('Additional AND-combined entity filters this assessment scope applies')
    ),
    fields: z.preprocess(
      value => (Array.isArray(value) ? value : undefined),
      z.array(assessmentFieldSchema).optional().describe('Assessment field definitions')
    ),
    assigned_team_ids: z.preprocess(
      value => (Array.isArray(value) ? value : undefined),
      z
        .array(z.string())
        .optional()
        .describe('Teams assigned to this assessment; surfaced as governance inbox tasks when open')
    ),
    due_at: z
      .string()
      .nullable()
      .optional()
      .describe('Optional ISO 8601 due date applied when the assessment opens'),
    recurrence: assessmentRecurrenceSchema.optional().default({ type: 'none' }),
    response_window_days: z
      .number()
      .int()
      .min(1)
      .nullable()
      .optional()
      .describe('Days each occurrence stays open before its due date; required when recurring')
  })
  .refine(body => body.mode !== 'confirm' || !body.fields || body.fields.length === 0, {
    message: 'Confirm-only assessments cannot define fields',
    path: ['fields']
  })
  .refine(
    body => (body.recurrence?.type ?? 'none') === 'none' || (body.response_window_days ?? 0) > 0,
    {
      message: 'Recurring assessments require a positive response_window_days',
      path: ['response_window_days']
    }
  );

const updateAssessmentStatusBodySchema = z.object({
  status: z.enum(['draft', 'open', 'closed', 'archived']).describe('New assessment status')
});

export const assessmentContract = oc.tag('Assessments').router({
  assessments: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/assessments',
        inputStructure: 'detailed',
        summary: 'List project assessments',
        description: 'Retrieves all assessment templates defined for the project.',
        tags: ['Assessments']
      })
      .input(z.object({ params: ws }))
      .output(z.array(assessmentSchema)),
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/assessments/{assessmentId}',
        inputStructure: 'detailed',
        summary: 'Get assessment details',
        description: 'Retrieves a specific assessment template by ID.',
        tags: ['Assessments']
      })
      .input(z.object({ params: wsAndAssessmentId }))
      .output(assessmentSchema),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/assessments',
        inputStructure: 'detailed',
        summary: 'Create assessment',
        description: 'Creates a new assessment template within the project.',
        tags: ['Assessments']
      })
      .input(z.object({ params: ws, body: assessmentBodySchema }))
      .output(assessmentSchema),
    update: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/assessments/{assessmentId}',
        inputStructure: 'detailed',
        summary: 'Update assessment',
        description: 'Updates an existing assessment template.',
        tags: ['Assessments']
      })
      .input(z.object({ params: wsAndAssessmentId, body: assessmentBodySchema }))
      .output(assessmentSchema),
    updateStatus: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/assessments/{assessmentId}/status',
        inputStructure: 'detailed',
        summary: 'Update assessment status',
        description:
          'Sets the assessment status to draft, open, closed, or archived without deleting its data.',
        tags: ['Assessments']
      })
      .input(z.object({ params: wsAndAssessmentId, body: updateAssessmentStatusBodySchema }))
      .output(assessmentSchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/assessments/{assessmentId}',
        inputStructure: 'detailed',
        summary: 'Delete assessment',
        description:
          'Permanently deletes an assessment template. Fails if it has any recorded responses.',
        tags: ['Assessments']
      })
      .input(z.object({ params: wsAndAssessmentId }))
      .output(
        z.object({
          success: z.boolean().describe('Whether the deletion was successful'),
          message: z.string().describe('Status message or error details')
        })
      )
  }
});

export type AssessmentRecurrence = z.infer<typeof assessmentRecurrenceSchema>;
export type AssessmentField = z.infer<typeof assessmentFieldSchema>;
export type AssessmentEnumOption = z.infer<typeof assessmentEnumOptionSchema>;
export type AssessmentEnumField = z.infer<typeof enumAssessmentFieldSchema>;
export type Assessment = z.infer<typeof assessmentSchema>;
export type CreateAssessmentRequest = z.infer<typeof assessmentBodySchema>;
export type UpdateAssessmentRequest = CreateAssessmentRequest;
export type UpdateAssessmentStatusRequest = z.infer<typeof updateAssessmentStatusBodySchema>;
