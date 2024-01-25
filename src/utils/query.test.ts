import { describe, expect, test } from 'vitest';
import { query, queryOne } from './query.ts';

describe('PropertyLookup', () => {
  test('query .', () => {
    expect(queryOne('.', { a: 1 })).toEqual({ a: 1 });
    expect(queryOne('.', 123)).toEqual(123);
    expect(queryOne('.', 'lorem')).toEqual('lorem');
    expect(queryOne('.', [1, 2, 3])).toEqual([1, 2, 3]);
  });

  test('query .test', () => {
    expect(queryOne('.test', { test: 1 })).toEqual(1);
    expect(queryOne('.test', 123)).toEqual(undefined);
    expect(queryOne('.test', 'lorem')).toEqual(undefined);
    expect(queryOne('.test', [1, 2, 3])).toEqual(undefined);
  });

  test('query .a.b', () => {
    expect(queryOne('.a.b', { a: { b: 1 } })).toEqual(1);
    expect(queryOne('.a.b', { a: { c: 1 } })).toEqual(undefined);
    expect(queryOne('.a.b', 123)).toEqual(undefined);
    expect(queryOne('.a.b', 'lorem')).toEqual(undefined);
    expect(queryOne('.a.b', [1, 2, 3])).toEqual(undefined);
  });
});

describe('ArrayLookup', () => {
  test('query .[0]', () => {
    expect(queryOne('.[0]', [1, 2, 3])).toEqual(1);
    expect(queryOne('.[0]', [{ a: 5 }, 2, 3])).toEqual({ a: 5 });
    expect(queryOne('.[0]', [[4, 5], 2, 3])).toEqual([4, 5]);
    expect(queryOne('.[0]', [])).toEqual(undefined);
    expect(queryOne('.[0]', 'lorem')).toEqual(undefined);
  });

  test('query .[2:4]', () => {
    expect(queryOne('.[2:4]', [1, 2, 3, 4, 5, 6])).toEqual([3, 4]);
    expect(queryOne('.[2:4]', [{ a: 5 }, 2, 3, 4, 5, 6])).toEqual([3, 4]);
    expect(queryOne('.[2:4]', [[4, 5], 2, 3, 4, 5, 6])).toEqual([3, 4]);
    expect(queryOne('.[2:4]', [])).toEqual([]);
    expect(queryOne('.[2:4]', ['lorem'])).toEqual([]);
  });

  test('query .[]', () => {
    expect(query('.[]', [[1, 2, 3]])).toEqual([1, 2, 3]);
    expect(query('.[]', [[{ a: 5 }, 2, 3]])).toEqual([{ a: 5 }, 2, 3]);
    expect(query('.[]', [[[4, 5], 2, 3]])).toEqual([[4, 5], 2, 3]);
    expect(query('.[]', [[]])).toEqual([]);
    expect(query('.[]', ['lorem'])).toEqual([undefined]);
  });
});

describe('Sequence', () => {
  test('query .[0],.[1]', () => {
    expect(query('.[0],.[1]', [[1, 2, 3]])).toEqual([1, 2]);
    expect(query('.[0],.[1]', [[{ a: 5 }, 2, 3]])).toEqual([{ a: 5 }, 2]);
    expect(query('.[0],.[1]', [[[4, 5], 2, 3]])).toEqual([[4, 5], 2]);
    expect(query('.[0],.[1]', [[]])).toEqual([undefined, undefined]);
    expect(query('.[0],.[1]', ['lorem'])).toEqual([undefined, undefined]);
  });
});

describe('pipe', () => {
  test('query .[] | .name', () => {
    expect(
      query('.[] | .name', [
        { name: 'JSON', good: true },
        { name: 'XML', good: false }
      ])
    ).toEqual(['JSON', 'XML']);
  });
});

/*
describe('ArrayConstructor', () => {
  test('[.user, .projects[]]', () => {
    expect(
      query('[.user, .projects[]]', [{ user: 'stedolan', projects: ['jq', 'wikiflow'] }])
    ).toEqual([['stedolan', 'jq', 'wikiflow']]);
  });
});

 */
