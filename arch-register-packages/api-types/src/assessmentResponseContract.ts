import { oc } from '@orpc/contract';
import { z } from 'zod';
import { wsAndId } from '@arch-register/api-types/common';

const wsProjectAndAssessmentId = wsAndId.extend({
  assessmentId: z.string().describe('Assessment identifier')
});

const wsProjectAssessmentAndEntityId = wsProjectAndAssessmentId.extend({
  entityId: z.string().describe('Entity identifier')
});

const assessmentResponseStatusSchema = z
  .enum(['not_started', 'in_progress', 'complete'])
  .describe('Completion status derived from the assessment\'s required fields');

const assessmentResponseSchema = z.object({
  entity_id: z.string().describe('Entity this response belongs to'),
  values: z
    .record(z.string(), z.union([z.string(), z.number()]))
    .describe('Recorded field values, keyed by assessment field id'),
  status: assessmentResponseStatusSchema,
  updated_at: z.string().describe('ISO 8601 last update timestamp')
});

const upsertAssessmentResponseBodySchema = z.object({
  values: z
    .record(z.string(), z.union([z.string(), z.number(), z.null()]))
    .describe('Field values to merge into the response; null clears a field')
});

export const assessmentResponseContract = oc.tag('Assessments').router({
  assessmentResponses: {
    list: oc
      .route({
        method: 'GET',
        path: '/{workspace}/projects/{id}/assessments/{assessmentId}/responses',
        inputStructure: 'detailed',
        summary: 'List assessment responses',
        description: 'Retrieves all recorded responses for the assessment, one per entity.',
        tags: ['Assessments']
      })
      .input(z.object({ params: wsProjectAndAssessmentId }))
      .output(z.array(assessmentResponseSchema)),
    upsert: oc
      .route({
        method: 'PUT',
        path: '/{workspace}/projects/{id}/assessments/{assessmentId}/responses/{entityId}',
        inputStructure: 'detailed',
        summary: 'Record an assessment response',
        description:
          'Merges the given field values into the entity\'s response for this assessment. A null value clears that field.',
        tags: ['Assessments']
      })
      .input(
        z.object({ params: wsProjectAssessmentAndEntityId, body: upsertAssessmentResponseBodySchema })
      )
      .output(assessmentResponseSchema)
  }
});

export type AssessmentResponseStatus = z.infer<typeof assessmentResponseStatusSchema>;
export type AssessmentResponse = z.infer<typeof assessmentResponseSchema>;
export type UpsertAssessmentResponseRequest = z.infer<typeof upsertAssessmentResponseBodySchema>;
