import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws } from '@arch-register/api-types/common';

const auditLogEntrySchema = z.object({
  id: z.string().describe('Unique audit log entry identifier'),
  workspace: z.string().describe('Workspace identifier'),
  timestamp: z.string().describe('ISO 8601 timestamp of the operation'),
  user_id: z.string().nullable().describe('User who performed the operation (null for system operations)'),
  user_display_name: z.string().nullable().describe('Display name of the user (null for system operations)'),
  operation: z.enum(['create', 'update', 'delete']).describe('Type of operation performed'),
  entity_type: z.enum(['workspace', 'entity_schema', 'entity', 'project', 'content_node']).describe('Type of entity affected'),
  entity_id: z.string().describe('Identifier of the affected entity'),
  public_id: z.string().nullable().describe('Public identifier of the entity (if applicable)'),
  entity_name: z.string().describe('Name of the affected entity'),
  entity_slug: z.string().nullable().describe('URL slug of the entity (if applicable)'),
  schema_id: z.string().nullable().describe('Schema identifier for entity operations'),
  changes: z.object({
    old: z.record(z.string(), z.unknown()).optional().describe('Previous values before the operation'),
    new: z.record(z.string(), z.unknown()).optional().describe('New values after the operation')
  }).describe('Detailed change information'),
  metadata: z.record(z.string(), z.unknown()).describe('Additional operation metadata')
});

const auditStatsSchema = z.object({
  total: z.number().describe('Total number of audit log entries'),
  byOperation: z.array(z.object({
    operation: z.string().describe('Operation type'),
    count: z.number().describe('Number of operations of this type')
  })).describe('Breakdown of operations by type'),
  byEntityType: z.array(z.object({
    entity_type: z.string().describe('Entity type'),
    count: z.number().describe('Number of operations on this entity type')
  })).describe('Breakdown of operations by entity type'),
  recentActivity: z.array(z.object({
    date: z.string().describe('Date (ISO 8601)'),
    count: z.number().describe('Number of operations on this date')
  })).describe('Recent activity timeline')
});

// ── Contract ──────────────────────────────────────────────────

export const auditContract = oc
  .tag('Audit')
  .router({
    audit: {
      list: oc
        .route({
          method: 'GET',
          path: '/{workspace}/audit',
          inputStructure: 'detailed',
          summary: 'List audit log entries',
          description: 'Retrieves audit log entries for the workspace with optional filtering by entity type, operation, date range, and other criteria. Results are paginated.',
          tags: ['Audit']
        })
        .input(
          z.object({
            params: ws,
            query: z.object({
              entityType: z.string().optional().describe('Filter by entity type (workspace, entity_schema, entity, project, content_node)'),
              entityId: z.string().optional().describe('Filter by specific entity ID'),
              schemaId: z.string().optional().describe('Filter by schema ID (for entity operations)'),
              owner: z.string().optional().describe('Filter by entity owner'),
              lifecycle: z.string().optional().describe('Filter by entity lifecycle state'),
              operation: z.string().optional().describe('Filter by operation type (create, update, delete)'),
              startDate: z.string().optional().describe('Filter by start date (ISO 8601)'),
              endDate: z.string().optional().describe('Filter by end date (ISO 8601)'),
              limit: z.preprocess(
                v => (v !== undefined ? Number(v) : undefined),
                z.number().int().positive().optional().describe('Maximum number of entries to return')
              ),
              offset: z.preprocess(
                v => (v !== undefined ? Number(v) : undefined),
                z.number().int().min(0).optional().describe('Number of entries to skip for pagination')
              )
            })
          })
        )
        .output(z.array(auditLogEntrySchema)),
      stats: oc
        .route({
          method: 'GET',
          path: '/{workspace}/audit/stats',
          inputStructure: 'detailed',
          summary: 'Get audit statistics',
          description: 'Retrieves statistical summary of audit log activity, including operation counts, entity type distribution, and recent activity timeline.',
          tags: ['Audit']
        })
        .input(z.object({ params: ws }))
        .output(auditStatsSchema)
    }
  });

// ── Exported Types ───────────────────────────────────────────

export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;
export type AuditStats = z.infer<typeof auditStatsSchema>;