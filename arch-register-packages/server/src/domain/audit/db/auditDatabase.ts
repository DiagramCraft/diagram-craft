import type { AuditLogEntry } from '../../../types';

export type CreateAuditLogInput = Omit<AuditLogEntry, 'id'>;

export type AuditDatabase = {
  listAuditLogs(ws: string): Promise<AuditLogEntry[]>;
  createAuditLog(input: CreateAuditLogInput): Promise<AuditLogEntry>;
};
