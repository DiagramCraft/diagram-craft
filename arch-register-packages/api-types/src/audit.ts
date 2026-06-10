import type { z } from 'zod';
import type {
  auditEntityTypeSchema,
  auditLogEntrySchema,
  auditOperationSchema,
  auditStatsSchema
} from './auditContract.js';

// ── Audit Log Types ───────────────────────────────────────────

export type AuditOperation = z.infer<typeof auditOperationSchema>;

export type AuditEntityType = z.infer<typeof auditEntityTypeSchema>;

export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;

export type AuditStats = z.infer<typeof auditStatsSchema>;
