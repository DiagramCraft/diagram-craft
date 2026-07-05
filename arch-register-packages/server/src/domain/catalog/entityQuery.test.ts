import { describe, expect, it } from 'vitest';
import { parseEntityQuery } from './entityQuery';

describe('parseEntityQuery', () => {
  it('supplies domain defaults', () => {
    expect(parseEntityQuery({})).toEqual({
      schemaId: null,
      owner: null,
      lifecycle: null,
      q: '',
      conditions: [],
      projectId: null,
      projectScope: 'all',
      view: 'full',
      limit: null,
      offset: 0,
      asOf: null,
      includeProjectSnapshots: true
    });
  });

  it('parses conditions and dates', () => {
    const result = parseEntityQuery({
      conditions: '[{"field":"name","operator":"equals","value":"API"}]',
      asOf: '2026-07-05T12:00:00Z',
      includeProjectSnapshots: 'false'
    });

    expect(result.conditions).toHaveLength(1);
    expect(result.asOf?.toISOString()).toBe('2026-07-05T12:00:00.000Z');
    expect(result.includeProjectSnapshots).toBe(false);
  });

  it('treats malformed filters and dates as absent', () => {
    expect(parseEntityQuery({ conditions: '{bad', asOf: 'invalid' })).toMatchObject({
      conditions: [],
      asOf: null
    });
    expect(parseEntityQuery({ conditions: '{}' }).conditions).toEqual([]);
  });
});
