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
  id: z.string().describe('Response identifier'),
  entity_id: z.string().describe('Entity this response belongs to'),
  values: z
    .record(z.string(), z.union([z.string(), z.number()]))
    .describe('Recorded field values, keyed by assessment field id'),
  status: assessmentResponseStatusSchema,
  updated_at: z.string().describe('ISO 8601 last update timestamp'),
  updated_by: z.string().nullable().describe('User who last updated this response'),
  updated_by_name: z.string().nullable().describe('Display name of the user who last updated this response')
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
      .output(assessmentResponseSchema),
    exportCsv: oc
      .route({
        method: 'GET',
        path: '/{workspace}/projects/{id}/assessments/{assessmentId}/responses/export',
        inputStructure: 'detailed',
        outputStructure: 'detailed',
        summary: 'Export assessment results to CSV',
        description:
          'Exports the full results table for the assessment to a CSV file: one row per in-scope entity, one column per assessment field, plus standard entity columns.',
        tags: ['Assessments']
      })
      .input(z.object({ params: wsProjectAndAssessmentId }))
      .output(
        z.object({
          headers: z.record(z.string(), z.string()).describe('Response headers including Content-Disposition'),
          body: z.instanceof(Blob).describe('CSV file as binary blob')
        })
      )
  }
});

export type AssessmentResponseStatus = z.infer<typeof assessmentResponseStatusSchema>;
export type AssessmentResponse = z.infer<typeof assessmentResponseSchema>;
export type UpsertAssessmentResponseRequest = z.infer<typeof upsertAssessmentResponseBodySchema>;
