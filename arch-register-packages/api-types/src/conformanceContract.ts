import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndUUID } from '@arch-register/api-types/common';
import { entityQuerySchema } from '@arch-register/api-types/entityQueryIR';
import {
  DOCUMENT_AI_READ_ONLY_TOOLS,
  documentAiToolIdSchema,
  type DocumentAiToolId
} from '@arch-register/api-types/documentContract';

const conformanceSeveritySchema = z.enum(['error', 'warning']);
const conformanceCheckStatusSchema = z.enum(['active', 'acknowledged', 'resolved', 'exempt']);

const conformanceGovernanceSchema = z.object({
  enabled: z.boolean(),
  resolution: z.enum(['acknowledge', 'resolve'])
});

const checkIdentitySchema = {
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  severity: conformanceSeveritySchema,
  enabled: z.boolean().default(true)
};

const scheduledValidationDefinitionSchema = z.object({
  type: z.literal('scheduled_validation'),
  schemaId: z.string().min(1),
  expression: z.string().min(1),
  message: z.string().min(1),
  fieldId: z.string().min(1).optional(),
  governance: conformanceGovernanceSchema.optional()
});

const queryPolicyDefinitionSchema = z.object({
  type: z.literal('query_policy'),
  query: entityQuerySchema,
  message: z.string().min(1),
  governance: conformanceGovernanceSchema.optional()
});

const aiPromptDefinitionSchema = z.object({
  type: z.literal('ai_prompt'),
  schemaId: z.string().min(1),
  prompt: z.string().min(1).max(12000),
  fieldIds: z.array(z.string().min(1)).min(1),
  tools: z.array(documentAiToolIdSchema).default([]),
  governance: conformanceGovernanceSchema.optional()
});

const conformanceCheckDefinitionSchema = z.discriminatedUnion('type', [
  scheduledValidationDefinitionSchema,
  queryPolicyDefinitionSchema,
  aiPromptDefinitionSchema
]);

const createCheckBodySchema = z
  .object({
    ...checkIdentitySchema,
    definition: conformanceCheckDefinitionSchema
  })
  .superRefine((value, context) => {
    if (value.definition.type === 'ai_prompt') {
      const uniqueTools = new Set(value.definition.tools);
      if (uniqueTools.size !== value.definition.tools.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['definition', 'tools'],
          message: 'AI tools must be unique'
        });
      }
    }
  });

const conformanceCheckSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  ...checkIdentitySchema,
  definition: conformanceCheckDefinitionSchema,
  revision: z.number().int().positive(),
  created_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
});

const updateCheckBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  severity: conformanceSeveritySchema.optional(),
  enabled: z.boolean().optional(),
  definition: conformanceCheckDefinitionSchema.optional()
});

const evaluationRunSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  check_id: z.string().nullable(),
  job_run_id: z.string().nullable(),
  status: z.enum(['running', 'succeeded', 'failed']),
  started_at: z.string(),
  completed_at: z.string().nullable(),
  checked_count: z.number().int().nonnegative(),
  violation_count: z.number().int().nonnegative(),
  error: z.string().nullable(),
  configuration: z.record(z.string(), z.unknown())
});

const exemptionSchema = z.object({
  id: z.string(),
  violation_id: z.string(),
  reason: z.string(),
  expires_at: z.string().nullable(),
  created_by: z.string().nullable(),
  created_at: z.string(),
  revoked_at: z.string().nullable()
});

const violationSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  check_id: z.string(),
  check_name: z.string(),
  entity_id: z.string(),
  entity_name: z.string().nullable(),
  schema_id: z.string().nullable(),
  owner_team_id: z.string().nullable(),
  source_type: z.enum(['scheduled_validation', 'query_policy', 'ai_prompt']),
  severity: conformanceSeveritySchema,
  message: z.string(),
  evidence: z.record(z.string(), z.unknown()),
  status: conformanceCheckStatusSchema,
  first_seen_at: z.string(),
  last_seen_at: z.string(),
  resolved_at: z.string().nullable(),
  exemption: exemptionSchema.nullable()
});

const violationListQuerySchema = z.object({
  checkId: z.string().optional(),
  schemaId: z.string().optional(),
  ownerId: z.string().optional(),
  status: conformanceCheckStatusSchema.optional(),
  severity: conformanceSeveritySchema.optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0)
});

const violationPageSchema = z.object({
  items: z.array(violationSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative()
});

const runRequestSchema = z.object({ checkId: z.string().optional() });

const exemptionRequestSchema = z.object({
  reason: z.string().min(1).max(2000),
  expiresAt: z.string().datetime().nullable().optional()
});

const conformanceSummarySchema = z.object({
  active: z.number().int().nonnegative(),
  acknowledged: z.number().int().nonnegative(),
  warnings: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
  exempt: z.number().int().nonnegative(),
  resolvedRecently: z.number().int().nonnegative(),
  lastRunAt: z.string().nullable(),
  byCheck: z.array(z.object({ id: z.string(), name: z.string(), count: z.number().int().nonnegative() })),
  bySchema: z.array(z.object({ id: z.string(), name: z.string(), count: z.number().int().nonnegative() }))
});

export const conformanceContract = oc.tag('Conformance').router({
  conformance: {
    checks: {
      list: oc
        .route({
          method: 'GET',
          path: '/{workspace}/conformance/checks',
          inputStructure: 'detailed',
          summary: 'List conformance checks',
          description: 'Lists centrally managed scheduled validation, policy, and AI checks.',
          tags: ['Conformance']
        })
        .input(z.object({ params: ws }))
        .output(z.array(conformanceCheckSchema)),
      create: oc
        .route({
          method: 'POST',
          path: '/{workspace}/conformance/checks',
          inputStructure: 'detailed',
          summary: 'Create a conformance check',
          description: 'Creates a centrally managed conformance check.',
          tags: ['Conformance']
        })
        .input(z.object({ params: ws, body: createCheckBodySchema }))
        .output(conformanceCheckSchema),
      update: oc
        .route({
          method: 'PATCH',
          path: '/{workspace}/conformance/checks/{id}',
          inputStructure: 'detailed',
          summary: 'Update a conformance check',
          description: 'Updates a centrally managed conformance check and records a new revision.',
          tags: ['Conformance']
        })
        .input(z.object({ params: wsAndUUID, body: updateCheckBodySchema }))
        .output(conformanceCheckSchema),
      remove: oc
        .route({
          method: 'DELETE',
          path: '/{workspace}/conformance/checks/{id}',
          inputStructure: 'detailed',
          summary: 'Delete a conformance check',
          description: 'Deletes a centrally managed conformance check and its violations.',
          tags: ['Conformance']
        })
        .input(z.object({ params: wsAndUUID }))
        .output(z.object({ success: z.boolean() }))
    },
    runs: {
      list: oc
        .route({
          method: 'GET',
          path: '/{workspace}/conformance/runs',
          inputStructure: 'detailed',
          summary: 'List conformance evaluation runs',
          description: 'Lists persistent evaluation runs for the workspace.',
          tags: ['Conformance']
        })
        .input(z.object({ params: ws }))
        .output(z.array(evaluationRunSchema)),
      start: oc
        .route({
          method: 'POST',
          path: '/{workspace}/conformance/runs',
          inputStructure: 'detailed',
          summary: 'Run conformance checks now',
          description: 'Starts an asynchronous workspace-wide or single-check evaluation.',
          tags: ['Conformance']
        })
        .input(z.object({ params: ws, body: runRequestSchema }))
        .output(evaluationRunSchema)
    },
    violations: {
      list: oc
        .route({
          method: 'GET',
          path: '/{workspace}/conformance/violations',
          inputStructure: 'detailed',
          summary: 'List conformance violations',
          description: 'Lists current, resolved, and exempt conformance violations.',
          tags: ['Conformance']
        })
        .input(z.object({ params: ws, query: violationListQuerySchema }))
        .output(violationPageSchema),
      exempt: oc
        .route({
          method: 'POST',
          path: '/{workspace}/conformance/violations/{id}/exempt',
          inputStructure: 'detailed',
          summary: 'Exempt a conformance violation',
          description: 'Creates an auditable, optionally time-bound exemption.',
          tags: ['Conformance']
        })
        .input(z.object({ params: wsAndUUID, body: exemptionRequestSchema }))
        .output(violationSchema)
    },
    summary: oc
      .route({
        method: 'GET',
        path: '/{workspace}/conformance/summary',
        inputStructure: 'detailed',
        summary: 'Get conformance summary',
        description: 'Returns current violation counts and the last evaluation timestamp.',
        tags: ['Conformance']
      })
      .input(z.object({ params: ws }))
      .output(conformanceSummarySchema)
  }
});

export type ConformanceSeverity = z.infer<typeof conformanceSeveritySchema>;
export type ConformanceCheckStatus = z.infer<typeof conformanceCheckStatusSchema>;
export type ConformanceGovernanceConfig = z.infer<typeof conformanceGovernanceSchema>;
export type ConformanceCheckDefinition = z.infer<typeof conformanceCheckDefinitionSchema>;
export type ConformanceCheck = z.infer<typeof conformanceCheckSchema>;
export type CreateConformanceCheck = z.infer<typeof createCheckBodySchema>;
export type UpdateConformanceCheck = z.infer<typeof updateCheckBodySchema>;
export type ConformanceEvaluationRun = z.infer<typeof evaluationRunSchema>;
export type ConformanceViolation = z.infer<typeof violationSchema>;
export type ConformanceViolationListQuery = z.infer<typeof violationListQuerySchema>;
export type ConformanceSummary = z.infer<typeof conformanceSummarySchema>;
export type ConformanceExemptionRequest = z.infer<typeof exemptionRequestSchema>;
export type ConformanceAiToolId = DocumentAiToolId;
export { DOCUMENT_AI_READ_ONLY_TOOLS };
