import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';

const auditLogEntrySchema = z.object({
  id: z.string(),
  workspace: z.string(),
  timestamp: z.string(),
  user_id: z.string().nullable(),
  user_display_name: z.string().nullable(),
  operation: z.enum(['create', 'update', 'delete']),
  entity_type: z.enum(['workspace', 'entity_schema', 'entity', 'project', 'content_node']),
  entity_id: z.string(),
  public_id: z.string().nullable(),
  entity_name: z.string(),
  entity_slug: z.string().nullable(),
  schema_id: z.string().nullable(),
  changes: z.object({
    old: z.record(z.string(), z.unknown()).optional(),
    new: z.record(z.string(), z.unknown()).optional()
  }),
  metadata: z.record(z.string(), z.unknown())
});

const auditStatsSchema = z.object({
  total: z.number(),
  byOperation: z.array(z.object({ operation: z.string(), count: z.number() })),
  byEntityType: z.array(z.object({ entity_type: z.string(), count: z.number() })),
  recentActivity: z.array(z.object({ date: z.string(), count: z.number() }))
});

// ── Contract ──────────────────────────────────────────────────

export const auditContract = {
  audit: {
    list: oc
      .route({ method: 'GET', path: '/{workspace}/audit', inputStructure: 'detailed' })
      .input(
        z.object({
          params: ws,
          query: z.object({
            entityType: z.string().optional(),
            entityId: z.string().optional(),
            operation: z.string().optional(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
            limit: z.preprocess(
              v => (v !== undefined ? Number(v) : undefined),
              z.number().int().positive().optional()
            ),
            offset: z.preprocess(
              v => (v !== undefined ? Number(v) : undefined),
              z.number().int().min(0).optional()
            )
          })
        })
      )
      .output(z.array(auditLogEntrySchema)),
    stats: oc
      .route({ method: 'GET', path: '/{workspace}/audit/stats', inputStructure: 'detailed' })
      .input(z.object({ params: ws }))
      .output(auditStatsSchema)
  }
};

// ── Exported Types ───────────────────────────────────────────

export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;
export type AuditStats = z.infer<typeof auditStatsSchema>;
