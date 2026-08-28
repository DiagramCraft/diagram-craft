import { describe, expect, it, beforeEach } from 'vitest';
import {
  clearTraces,
  finishRequestSpan,
  getTrace,
  recordSqlSpan,
  startRequestSpan,
  withRequestSpan
} from './devTrace';

describe('devTrace', () => {
  beforeEach(() => clearTraces());

  it('nests SQL spans under the active request span', () => {
    const span = startRequestSpan({
      traceId: 'trace-1',
      spanId: 'span-1',
      interaction: 'click: Save',
      method: 'POST',
      path: '/api/entities'
    });

    withRequestSpan(span, () => {
      recordSqlSpan({ sql: 'SELECT 1', params: [1], durationMs: 2, rowCount: 1 });
      recordSqlSpan({ sql: 'INSERT INTO x', params: [], durationMs: 5, rowCount: 1 });
    });

    finishRequestSpan(span, { status: 200 });

    const trace = getTrace('trace-1');
    expect(trace?.interaction).toBe('click: Save');
    expect(trace?.requests).toHaveLength(1);
    expect(trace?.requests[0]?.status).toBe(200);
    expect(trace?.requests[0]?.sql.map(s => s.sql)).toEqual(['SELECT 1', 'INSERT INTO x']);
  });

  it('ignores SQL spans with no active trace context', () => {
    startRequestSpan({
      traceId: 'trace-2',
      spanId: 'span-2',
      interaction: undefined,
      method: 'GET',
      path: '/api/entities'
    });

    recordSqlSpan({ sql: 'SELECT 2', durationMs: 1 });

    expect(getTrace('trace-2')?.requests[0]?.sql).toHaveLength(0);
  });

  it('returns null for unknown trace ids', () => {
    expect(getTrace('nope')).toBeNull();
  });
});
