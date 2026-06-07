import { describe, it, expect } from 'vitest';
import { filterAndPaginateAuditLogs, computeAuditStats, toApiAuditLogEntry } from './audit-helpers.js';
import type { AuditLogEntry } from '../types.js';

const makeEntry = (overrides: Partial<AuditLogEntry> & { id: string }): AuditLogEntry => ({
  workspace: 'ws-1',
  timestamp: new Date('2026-05-27T10:00:00.000Z'), // 10 days before 2026-06-06
  user_id: 'u-1',
  operation: 'create',
  entity_type: 'entity',
  entity_id: 'e-1',
  entity_name: 'My Entity',
  entity_slug: 'my-entity',
  schema_id: 's-1',
  changes: {},
  metadata: {},
  ...overrides
});

// Three test entries covering different dimensions
const entryA = makeEntry({ id: 'a', operation: 'create', entity_type: 'entity', entity_id: 'e-1', timestamp: new Date('2026-05-27T10:00:00.000Z') });
const entryB = makeEntry({ id: 'b', operation: 'update', entity_type: 'entity', entity_id: 'e-2', timestamp: new Date('2026-05-17T10:00:00.000Z') });
const entryC = makeEntry({ id: 'c', operation: 'delete', entity_type: 'project', entity_id: 'p-1', timestamp: new Date('2026-04-27T10:00:00.000Z') });

const allRows = [entryA, entryB, entryC];

const baseFilters = {
  entityType: null,
  entityId: null,
  operation: null,
  startDate: null,
  endDate: null,
  limit: 50,
  offset: 0
};

// ── filterAndPaginateAuditLogs ─────────────────────────────────

describe('filterAndPaginateAuditLogs', () => {
  it('returns all rows when no filters are applied', () => {
    const result = filterAndPaginateAuditLogs(allRows, baseFilters);
    expect(result).toHaveLength(3);
  });

  it('filters by entityType', () => {
    const result = filterAndPaginateAuditLogs(allRows, { ...baseFilters, entityType: 'entity' });
    expect(result).toHaveLength(2);
    expect(result.every(r => r.entity_type === 'entity')).toBe(true);
  });

  it('filters by entityId', () => {
    const result = filterAndPaginateAuditLogs(allRows, { ...baseFilters, entityId: 'e-1' });
    expect(result).toHaveLength(1);
    expect(result[0]!.entity_id).toBe('e-1');
  });

  it('filters by operation', () => {
    const result = filterAndPaginateAuditLogs(allRows, { ...baseFilters, operation: 'delete' });
    expect(result).toHaveLength(1);
    expect(result[0]!.operation).toBe('delete');
  });

  it('filters by startDate (excludes rows before)', () => {
    // 15 days before 2026-06-06 is 2026-05-22 — should include only entryA (May 27)
    const result = filterAndPaginateAuditLogs(allRows, { ...baseFilters, startDate: '2026-05-22T00:00:00.000Z' });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('a');
  });

  it('filters by endDate (excludes rows after)', () => {
    // Should include entryB (May 17) and entryC (Apr 27)
    const result = filterAndPaginateAuditLogs(allRows, { ...baseFilters, endDate: '2026-05-20T00:00:00.000Z' });
    expect(result).toHaveLength(2);
    expect(result.map(r => r.id)).toContain('b');
    expect(result.map(r => r.id)).toContain('c');
  });

  it('filters by startDate and endDate together (closed range)', () => {
    // Window that includes only entryB (May 17)
    const result = filterAndPaginateAuditLogs(allRows, {
      ...baseFilters,
      startDate: '2026-05-14T00:00:00.000Z',
      endDate: '2026-05-20T00:00:00.000Z'
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('b');
  });

  it('applies limit', () => {
    const result = filterAndPaginateAuditLogs(allRows, { ...baseFilters, limit: 1 });
    expect(result).toHaveLength(1);
  });

  it('applies offset', () => {
    const result = filterAndPaginateAuditLogs(allRows, { ...baseFilters, offset: 1, limit: 50 });
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('b');
  });

  it('applies limit and offset together', () => {
    const result = filterAndPaginateAuditLogs(allRows, { ...baseFilters, limit: 1, offset: 1 });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('b');
  });

  it('returns empty array when no row matches the filter', () => {
    const result = filterAndPaginateAuditLogs(allRows, { ...baseFilters, entityId: 'nonexistent' });
    expect(result).toHaveLength(0);
  });
});

// ── computeAuditStats ──────────────────────────────────────────

// Fix "now" to 2026-06-06T00:00:00.000Z for deterministic 30-day threshold
const NOW_MS = new Date('2026-06-06T00:00:00.000Z').getTime();

describe('computeAuditStats', () => {
  it('returns zeroed stats for empty input', () => {
    const result = computeAuditStats([], NOW_MS);
    expect(result).toEqual({ total: 0, byOperation: [], byEntityType: [], recentActivity: [] });
  });

  it('total equals input length', () => {
    expect(computeAuditStats(allRows, NOW_MS).total).toBe(3);
  });

  it('byOperation counts each operation and sorts descending', () => {
    // Add an extra create so create×2, update×1, delete×1 — verifies sort
    const extra = makeEntry({ id: 'd', operation: 'create', entity_type: 'entity', entity_id: 'e-3' });
    const result = computeAuditStats([...allRows, extra], NOW_MS);
    expect(result.byOperation[0]!.operation).toBe('create');
    expect(result.byOperation[0]!.count).toBe(2);
    expect(result.byOperation.every((a, i, arr) => i === 0 || arr[i - 1]!.count >= a.count)).toBe(true);
  });

  it('byEntityType counts each entity_type and sorts descending', () => {
    const result = computeAuditStats(allRows, NOW_MS);
    // entity appears 2 times (A+B), project 1 time (C)
    expect(result.byEntityType[0]!.entity_type).toBe('entity');
    expect(result.byEntityType[0]!.count).toBe(2);
    expect(result.byEntityType[1]!.entity_type).toBe('project');
    expect(result.byEntityType[1]!.count).toBe(1);
  });

  it('recentActivity excludes rows older than 30 days', () => {
    // entryC is 40 days before NOW_MS — should be excluded
    const result = computeAuditStats(allRows, NOW_MS);
    const dates = result.recentActivity.map(r => r.date);
    expect(dates).not.toContain('2026-04-27');
  });

  it('recentActivity groups two rows on the same day into one entry', () => {
    const sameDay1 = makeEntry({ id: 'x1', timestamp: new Date('2026-05-27T08:00:00.000Z') });
    const sameDay2 = makeEntry({ id: 'x2', timestamp: new Date('2026-05-27T18:00:00.000Z') });
    const result = computeAuditStats([sameDay1, sameDay2], NOW_MS);
    expect(result.recentActivity).toHaveLength(1);
    expect(result.recentActivity[0]!.date).toBe('2026-05-27');
    expect(result.recentActivity[0]!.count).toBe(2);
  });

  it('recentActivity is sorted descending by date', () => {
    const result = computeAuditStats(allRows, NOW_MS);
    const dates = result.recentActivity.map(r => r.date);
    expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)));
  });
});

// ── toApiAuditLogEntry ────────────────────────────────────────

describe('toApiAuditLogEntry', () => {
  it('maps all fields and serializes timestamp', () => {
    const entry: AuditLogEntry = {
      id: 'audit-1',
      workspace: 'ws-1',
      timestamp: new Date('2025-06-01T12:00:00.000Z'),
      user_id: 'u-1',
      operation: 'create',
      entity_type: 'entity',
      entity_id: 'e-1',
      entity_name: 'My Entity',
      entity_slug: 'my-entity',
      schema_id: 'schema-1',
      changes: { new: { name: 'My Entity' } },
      metadata: {},
    };
    const result = toApiAuditLogEntry(entry);
    expect(result.id).toBe('audit-1');
    expect(result.timestamp).toBe('2025-06-01T12:00:00.000Z');
    expect(result.operation).toBe('create');
    expect(result.changes).toEqual({ new: { name: 'My Entity' } });
  });
});
