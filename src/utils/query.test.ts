import { describe, expect, test } from 'vitest';
import {
  ArrayConstructor,
  ArrayIndexOperator,
  ArrayOperator,
  ArraySliceOperator,
  Group,
  PropertyLookup,
  query,
  queryOne,
  ResultSet,
  Sequence
} from './query.ts';

describe('PropertyLookup', () => {
  test('query: .', () => {
    expect(queryOne('.', { a: 1 })).toEqual({ a: 1 });
    expect(queryOne('.', 123)).toEqual(123);
    expect(queryOne('.', 'lorem')).toEqual('lorem');
    expect(queryOne('.', [1, 2, 3])).toEqual([1, 2, 3]);
  });

  test('query: .test', () => {
    expect(queryOne('.test', { test: 1 })).toEqual(1);
    expect(queryOne('.test', 123)).toEqual(undefined);
    expect(queryOne('.test', 'lorem')).toEqual(undefined);
    expect(queryOne('.test', [1, 2, 3])).toEqual(undefined);
  });

  test('query: .a.b', () => {
    expect(queryOne('.a.b', { a: { b: 1 } })).toEqual(1);
    expect(queryOne('.a.b', { a: { c: 1 } })).toEqual(undefined);
    expect(queryOne('.a.b', 123)).toEqual(undefined);
    expect(queryOne('.a.b', 'lorem')).toEqual(undefined);
    expect(queryOne('.a.b', [1, 2, 3])).toEqual(undefined);
  });

  test('PropertyLookup', () => {
    expect(new PropertyLookup('test').evaluate(ResultSet.of([1, 2, 3]))).toEqual(
      ResultSet.of(undefined)
    );
    expect(new PropertyLookup('test').evaluate(ResultSet.of({ test: 6 }))).toEqual(ResultSet.of(6));
    expect(new PropertyLookup('test').evaluate(ResultSet.ofList({ test: 6 }, 7))).toEqual(
      ResultSet.ofList(6, undefined)
    );
    expect(new PropertyLookup('test').evaluate(ResultSet.ofList({ test: 6 }, { test: 7 }))).toEqual(
      ResultSet.ofList(6, 7)
    );

    expect(new PropertyLookup('constructor').evaluate(ResultSet.of('string'))).toEqual(
      ResultSet.of(undefined)
    );
    expect(new PropertyLookup('prototype').evaluate(ResultSet.of('string'))).toEqual(
      ResultSet.of(undefined)
    );
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
    expect(query('.[]', ResultSet.of([1, 2, 3]))).toEqual([1, 2, 3]);
    expect(query('.[]', ResultSet.of([{ a: 5 }, 2, 3]))).toEqual([{ a: 5 }, 2, 3]);
    expect(query('.[]', ResultSet.of([[4, 5], 2, 3]))).toEqual([[4, 5], 2, 3]);
    expect(query('.[]', ResultSet.of([]))).toEqual([]);
    expect(() => query('.[]', ResultSet.of('lorem'))).toThrowError();
  });

  test('ArrayIndexOperator', () => {
    expect(new ArrayIndexOperator('0').evaluate(ResultSet.of([1, 2, 3]))).toEqual(ResultSet.of(1));
    expect(new ArrayIndexOperator('0').evaluate(ResultSet.ofList([1, 2, 3], [4, 5, 6]))).toEqual(
      ResultSet.ofList(1, 4)
    );
  });

  test('ArraySliceOperator', () => {
    expect(new ArraySliceOperator('1:3').evaluate(ResultSet.of([1, 2, 3]))).toEqual(
      ResultSet.of([2, 3])
    );
    expect(new ArraySliceOperator('1:2').evaluate(ResultSet.ofList([1, 2, 3], [4, 5, 6]))).toEqual(
      ResultSet.ofList([2], [5])
    );
    expect(new ArraySliceOperator('1:3').evaluate(ResultSet.ofList([1, 2, 3], [4, 5, 6]))).toEqual(
      ResultSet.ofList([2, 3], [5, 6])
    );
  });

  test('ArrayOperator', () => {
    expect(() => new ArrayOperator().evaluate(ResultSet.of('lorem'))).toThrowError();
    expect(new ArrayOperator().evaluate(ResultSet.of([1, 2, 3]))).toEqual(
      ResultSet.ofList(1, 2, 3)
    );
    expect(new ArrayOperator().evaluate(ResultSet.ofList([1, 2, 3], [4, 5, 6]))).toEqual(
      ResultSet.ofList(1, 2, 3, 4, 5, 6)
    );
  });
});

describe('Sequence', () => {
  test('query .[0],.[1]', () => {
    expect(query('.[0],.[1]', ResultSet.of([1, 2, 3]))).toEqual([1, 2]);
    expect(query('.[0],.[1]', ResultSet.of([{ a: 5 }, 2, 3]))).toEqual([{ a: 5 }, 2]);
    expect(query('.[0],.[1]', ResultSet.of([[4, 5], 2, 3]))).toEqual([[4, 5], 2]);
    expect(query('.[0],.[1]', ResultSet.of([]))).toEqual([undefined, undefined]);
    expect(query('.[0],.[1]', ResultSet.of('lorem'))).toEqual([undefined, undefined]);
  });

  test('query .user, .projects[]', () => {
    expect(
      query('.user, .projects[]', ResultSet.of({ user: 'stedolan', projects: ['jq', 'wikiflow'] }))
    ).toEqual(['stedolan', 'jq', 'wikiflow']);
  });

  test('Sequence', () => {
    const seq = new Sequence([new ArrayIndexOperator('0'), new ArrayIndexOperator('2')]);
    expect(seq.evaluate(ResultSet.of([1, 2, 3]))).toEqual(ResultSet.ofList(1, 3));
    expect(seq.evaluate(ResultSet.ofList([1, 2, 3], [4, 5, 6]))).toEqual(
      ResultSet.ofList(1, 3, 4, 6)
    );
  });
});

describe('pipe', () => {
  test('query .[] | .name', () => {
    expect(
      query(
        '.[] | .name',
        ResultSet.of([
          { name: 'JSON', good: true },
          { name: 'XML', good: false }
        ])
      )
    ).toEqual(['JSON', 'XML']);
  });

  test('Group', () => {
    const grp = new Group([new PropertyLookup('name'), new PropertyLookup('first')]);
    expect(grp.evaluate(ResultSet.of({ name: { first: 'John' } }))).toEqual(
      ResultSet.ofList('John')
    );
  });
});

describe('ArrayConstructor', () => {
  test('[.user, .projects[]]', () => {
    expect(
      query(
        '[.user, .projects[]]',
        ResultSet.of({ user: 'stedolan', projects: ['jq', 'wikiflow'] })
      )
    ).toEqual([['stedolan', 'jq', 'wikiflow']]);
  });

  test('ArrayConstructor', () => {
    const set = new ArrayConstructor(new PropertyLookup('user')).evaluate(
      ResultSet.ofList({ user: 'John' }, { user: 'Mary' })
    );
    expect(set).toEqual(ResultSet.ofList(['John'], ['Mary']));

    expect(
      new ArrayConstructor(
        new Sequence([new PropertyLookup('user'), new PropertyLookup('age')])
      ).evaluate(ResultSet.ofList({ user: 'John', age: 17 }, { user: 'Mary' }))
    ).toEqual(ResultSet.ofList(['John', 17], ['Mary', undefined]));
  });
});
