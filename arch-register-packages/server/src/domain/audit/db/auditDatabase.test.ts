import { describe, expect, it } from 'vitest';
import { auditMappers } from './auditDatabase';

const row = {
  id: 'audit-1',
  workspace: 'workspace-1',
  timestamp: '2026-09-17T10:00:00.000Z',
  user_id: null,
  user_display_name: null,
  operation: 'update',
  entity_type: 'entity',
  entity_id: 'entity-1',
  entity_name: 'Entity 1',
  entity_slug: null,
  schema_id: null,
  changes: JSON.stringify({ old: { name: 'old' }, new: { name: 'new' } }),
  metadata: JSON.stringify({ source: 'test' }),
  dedupe_key: null
};

describe('audit database mappers', () => {
  it('maps valid audit rows and summaries', () => {
    const mapped = auditMappers.auditLog(row);
    expect(mapped.changes).toEqual({ old: { name: 'old' }, new: { name: 'new' } });
    expect(mapped.metadata).toEqual({ source: 'test' });
    expect(auditMappers.auditLogSummary(row)).toMatchObject({
      operation: 'update',
      entity_type: 'entity'
    });
  });

  it('rejects invalid enum values instead of widening the domain type', () => {
    expect(() => auditMappers.auditLog({ ...row, operation: 'rename' })).toThrow(
      'audit_log.operation'
    );
    expect(() => auditMappers.auditLog({ ...row, entity_type: 'unknown' })).toThrow(
      'audit_log.entity_type'
    );
  });

  it('rejects JSON values that are not objects', () => {
    expect(() => auditMappers.auditLog({ ...row, changes: 'null' })).toThrow('audit_log.changes');
    expect(() => auditMappers.auditLog({ ...row, metadata: '[]' })).toThrow('audit_log.metadata');
  });
});
