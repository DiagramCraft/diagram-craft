import { oc } from '@orpc/contract';
import { z } from 'zod';

// ── Shared sub-schemas ────────────────────────────────────────

export const auditOperationSchema = z.enum(['create', 'update', 'delete']);

export const auditEntityTypeSchema = z.enum([
  'workspace',
  'entity_schema',
  'entity',
  'project',
  'project_file'
]);

export const auditLogEntrySchema = z.object({
  id: z.string(),
  workspace: z.string(),
  timestamp: z.string(),
  user_id: z.string().nullable(),
  user_display_name: z.string().nullable(),
  operation: auditOperationSchema,
  entity_type: auditEntityTypeSchema,
  entity_id: z.string(),
  entity_name: z.string(),
  entity_slug: z.string().nullable(),
  schema_id: z.string().nullable(),
  changes: z.object({
    old: z.record(z.string(), z.unknown()).optional(),
    new: z.record(z.string(), z.unknown()).optional()
  }),
  metadata: z.record(z.string(), z.unknown())
});

export const auditStatsSchema = z.object({
  total: z.number(),
  byOperation: z.array(z.object({ operation: z.string(), count: z.number() })),
  byEntityType: z.array(z.object({ entity_type: z.string(), count: z.number() })),
  recentActivity: z.array(z.object({ date: z.string(), count: z.number() }))
});

// ── Request schemas ───────────────────────────────────────────

export const listAuditLogRequestSchema = z.object({
  workspace: z.string(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  operation: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.preprocess(v => (v !== undefined ? Number(v) : undefined), z.number().int().positive().optional()),
  offset: z.preprocess(v => (v !== undefined ? Number(v) : undefined), z.number().int().min(0).optional())
});

export const getAuditStatsRequestSchema = z.object({
  workspace: z.string()
});

// ── Contract ──────────────────────────────────────────────────

export const auditContract = {
  audit: {
    list: oc
      .route({ method: 'GET', path: '/{workspace}/audit' })
      .input(listAuditLogRequestSchema)
      .output(z.array(auditLogEntrySchema)),
    stats: oc
      .route({ method: 'GET', path: '/{workspace}/audit/stats' })
      .input(getAuditStatsRequestSchema)
      .output(auditStatsSchema)
  }
};
