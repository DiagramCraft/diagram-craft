import { oc } from '@orpc/contract';
import { z } from 'zod';
import { wsAndId } from '@arch-register/api-types/common';
import { filterConditionSchema } from '@arch-register/api-types/viewContract';

const wsProjectAndAssessmentId = wsAndId.extend({
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

const enumAssessmentFieldSchema = baseAssessmentFieldSchema.extend({
  type: z.literal('enum').describe('Single-select field'),
  enumId: z.string().describe('Workspace enumeration identifier used for the option list')
});

const textAssessmentFieldSchema = baseAssessmentFieldSchema.extend({
  type: z.literal('text').describe('Free-text notes field')
});

const assessmentFieldSchema = z
  .discriminatedUnion('type', [
    ratingAssessmentFieldSchema,
    enumAssessmentFieldSchema,
    textAssessmentFieldSchema
  ])
  .describe('Assessment field definition');

const assessmentSchema = z.object({
  id: z.string().describe('Unique assessment identifier'),
  workspace: z.string().describe('Parent workspace identifier'),
  project_id: z.string().describe('Parent project identifier'),
  name: z.string().describe('Assessment name (must be unique within the project)'),
  description: z.string().describe('Assessment description'),
  status: z.enum(['draft', 'open', 'closed', 'archived']).describe('Assessment status'),
  scope: z.array(z.string()).describe('Entity schema ids this assessment applies to'),
  scope_conditions: z
    .array(filterConditionSchema)
    .describe('Additional AND-combined entity filters this assessment scope applies'),
  fields: z.array(assessmentFieldSchema).describe('Assessment field definitions'),
  response_count: z.number().int().min(0).describe('Number of entities with a recorded response'),
  completed_entity_count: z
    .number()
    .int()
    .min(0)
    .describe('Number of entities whose response has all required fields filled in'),
  created_at: z.string().describe('ISO 8601 creation timestamp'),
  updated_at: z.string().describe('ISO 8601 last update timestamp')
});

const assessmentBodySchema = z.object({
  name: z.string().describe('Assessment name (must be unique within the project)'),
  description: z.preprocess(
    value => (value === undefined ? undefined : typeof value === 'string' ? value : ''),
    z.string().optional().describe('Assessment description')
  ),
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
  )
});

const updateAssessmentStatusBodySchema = z.object({
  status: z.enum(['draft', 'open', 'closed', 'archived']).describe('New assessment status')
});

export const assessmentContract = oc.tag('Assessments').router({
  assessments: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/projects/{id}/assessments',
        inputStructure: 'detailed',
        summary: 'List project assessments',
        description: 'Retrieves all assessment templates defined for the project.',
        tags: ['Assessments']
      })
      .input(z.object({ params: wsAndId }))
      .output(z.array(assessmentSchema)),
    get: oc
      .route({
        method: 'GET',
        path: '/{workspace}/projects/{id}/assessments/{assessmentId}',
        inputStructure: 'detailed',
        summary: 'Get assessment details',
        description: 'Retrieves a specific assessment template by ID.',
        tags: ['Assessments']
      })
      .input(z.object({ params: wsProjectAndAssessmentId }))
      .output(assessmentSchema),
    create: oc
      .route({
        method: 'POST',
        path: '/{workspace}/projects/{id}/assessments',
        inputStructure: 'detailed',
        summary: 'Create assessment',
        description: 'Creates a new assessment template within the project.',
        tags: ['Assessments']
      })
      .input(z.object({ params: wsAndId, body: assessmentBodySchema }))
      .output(assessmentSchema),
    update: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/projects/{id}/assessments/{assessmentId}',
        inputStructure: 'detailed',
        summary: 'Update assessment',
        description: 'Updates an existing assessment template.',
        tags: ['Assessments']
      })
      .input(z.object({ params: wsProjectAndAssessmentId, body: assessmentBodySchema }))
      .output(assessmentSchema),
    updateStatus: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/projects/{id}/assessments/{assessmentId}/status',
        inputStructure: 'detailed',
        summary: 'Update assessment status',
        description: 'Sets the assessment status to draft, open, closed, or archived without deleting its data.',
        tags: ['Assessments']
      })
      .input(z.object({ params: wsProjectAndAssessmentId, body: updateAssessmentStatusBodySchema }))
      .output(assessmentSchema),
    remove: oc
      .route({
        method: 'DELETE',
        path: '/{workspace}/projects/{id}/assessments/{assessmentId}',
        inputStructure: 'detailed',
        summary: 'Delete assessment',
        description: 'Permanently deletes an assessment template. Fails if it has any recorded responses.',
        tags: ['Assessments']
      })
      .input(z.object({ params: wsProjectAndAssessmentId }))
      .output(
        z.object({
          success: z.boolean().describe('Whether the deletion was successful'),
          message: z.string().describe('Status message or error details')
        })
      )
  }
});

export type AssessmentField = z.infer<typeof assessmentFieldSchema>;
export type Assessment = z.infer<typeof assessmentSchema>;
export type CreateAssessmentRequest = z.infer<typeof assessmentBodySchema>;
export type UpdateAssessmentRequest = CreateAssessmentRequest;
export type UpdateAssessmentStatusRequest = z.infer<typeof updateAssessmentStatusBodySchema>;
