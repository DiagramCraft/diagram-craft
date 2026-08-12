import { eventIterator, oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';
import {
  documentAiActionSchema,
  documentValueSchema
} from '@arch-register/api-types/documentContract';

export const runAiActionResponseSchema = z.object({
  actionId: z.string().describe('Identifier of the AI action that was run'),
  actionName: z.string().describe('Display name of the AI action'),
  prompt: z.string().describe('Predefined prompt of the AI action'),
  answer: z.string().describe('The AI-generated answer'),
  documentTitle: z.string().describe('Title of the document the action was run against'),
  nodeId: z.string().describe('Markdown node identifier the action was run against')
});

export const runAiActionEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('delta'), delta: z.string().describe('Incremental answer text') }),
  runAiActionResponseSchema.extend({
    type: z.literal('done').describe('Signals the run is complete with the full answer')
  })
]);

const aiActionTestToolCallSchema = z.object({
  name: z.string().describe('Read-only tool name'),
  status: z.enum(['completed', 'failed']).describe('Tool execution status'),
  error: z.string().nullable().describe('Actionable tool error, if any')
});

export const aiActionTestResultSchema = z.object({
  type: z.literal('done'),
  actionId: z.string(),
  actionName: z.string(),
  kind: z.enum(['interactive', 'metadata_generator']),
  prompt: z.string(),
  documentTitle: z.string(),
  nodeId: z.string(),
  provider: z.string(),
  model: z.string(),
  durationMs: z.number().int().nonnegative(),
  rawOutput: z.string(),
  parsedValue: documentValueSchema.nullable(),
  outputFieldId: z.string().nullable(),
  status: z.enum(['success', 'invalid_output', 'failed']),
  errors: z.array(z.string()),
  toolCalls: z.array(aiActionTestToolCallSchema)
});

export const aiActionTestEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('delta'), delta: z.string() }),
  aiActionTestResultSchema
]);

export const projectDocumentAiContract = {
  runDocumentAiAction: oc
    .route({
      method: 'POST',
      path: '/{workspace}/documents/{nodeId}/ai-actions/{actionId}/run',
      inputStructure: 'detailed',
      summary: 'Run an interactive AI action for a document',
      description:
        'Runs a document type-defined interactive AI action against the current document body, metadata, document type, and location context, using read-only tools, and streams the answer as it is generated. Does not modify the document, its metadata, or any entities.',
      tags: ['Projects']
    })
    .input(
      z.object({
        params: ws.extend({
          nodeId: z.string().describe('Markdown node identifier'),
          actionId: z.string().describe('AI action identifier')
        })
      })
    )
    .output(eventIterator(runAiActionEventSchema)),
  testDocumentAiAction: oc
    .route({
      method: 'POST',
      path: '/{workspace}/documents/{nodeId}/ai-actions/test',
      inputStructure: 'detailed',
      summary: 'Test a document type AI action',
      description:
        'Tests a draft document type AI action against an existing document using read-only tools and permissions without persisting any document, metadata, revision, or schedule changes.',
      tags: ['Projects']
    })
    .input(
      z.object({
        params: ws.extend({ nodeId: z.string().describe('Markdown document identifier') }),
        body: z.object({
          documentTypeId: z.string().describe('Document type being edited'),
          action: documentAiActionSchema.describe('Unsaved AI action draft')
        })
      })
    )
    .output(eventIterator(aiActionTestEventSchema))
};

export type RunAiActionResponse = z.infer<typeof runAiActionResponseSchema>;
export type RunAiActionEvent = z.infer<typeof runAiActionEventSchema>;
export type AiActionTestResult = z.infer<typeof aiActionTestResultSchema>;
export type AiActionTestEvent = z.infer<typeof aiActionTestEventSchema>;
