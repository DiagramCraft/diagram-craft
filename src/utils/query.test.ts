import { describe, expect, test } from 'vitest';
import { OObjects, query } from './query.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const queryOne = (q: string, input: any) => {
  const res = query(q, [input]);
  if (res.length > 1) throw new Error();
  return res[0];
};

describe('OObject', () => {
  test('parse OString', () => {
    expect(OObjects.parseString('"lorem"').val).toEqual('lorem');
  });

  test('parse ONumber', () => {
    expect(OObjects.parseString('1234').val).toEqual(1234);
  });

  test('parse OBoolean', () => {
    expect(OObjects.parseString('true').val).toEqual(true);
    expect(OObjects.parseString('false').val).toEqual(false);
  });

  test('parse OArray', () => {
    expect(OObjects.parseString('[1, 2, 3]').val).toEqual([1, 2, 3]);
    expect(OObjects.parseString('["a", "b"]').val).toEqual(['a', 'b']);
    expect(OObjects.parseString('[1, "b"]').val).toEqual([1, 'b']);
  });

  test('parse OObject', () => {
    expect(OObjects.parseString('{ ab: 1, b: 2}').val).toEqual({ ab: 1, b: 2 });
    expect(OObjects.parseString('{ ab: "test", b: 2}').val).toEqual({
      ab: 'test',
      b: 2
    });
    expect(OObjects.parseString('{ ab: [7, 8], b: 2}').val).toEqual({
      ab: [7, 8],
      b: 2
    });
  });
});

describe('.abc', () => {
  test('.', () => {
    expect(queryOne('.', { a: 1 })).toEqual({ a: 1 });
    expect(queryOne('.', 123)).toEqual(123);
    expect(queryOne('.', 'lorem')).toEqual('lorem');
    expect(queryOne('.', [1, 2, 3])).toEqual([1, 2, 3]);
  });

  test('.test', () => {
    expect(queryOne('.test', { test: 1 })).toEqual(1);
    expect(() => queryOne('.test', 123)).toThrowError();
    expect(() => queryOne('.test', 'lorem')).toThrowError();
    expect(() => queryOne('.test', [1, 2, 3])).toThrowError();
  });

  test('.a.b', () => {
    expect(queryOne('.a.b', { a: { b: 1 } })).toEqual(1);
    expect(queryOne('.a.b', { a: { c: 1 } })).toEqual(undefined);
    expect(() => queryOne('.a.b', 123)).toThrowError();
    expect(() => queryOne('.a.b', 'lorem')).toThrowError();
    expect(() => queryOne('.a.b', [1, 2, 3])).toThrowError();
  });

  test('.a?.b', () => {
    expect(queryOne('.a.b', { a: { b: 1 } })).toEqual(1);
    expect(queryOne('.a.b', { a: { c: 1 } })).toEqual(undefined);
    expect(queryOne('.a?.b', 123)).toEqual(undefined);
    expect(queryOne('.a?.b', 'lorem')).toEqual(undefined);
    expect(queryOne('.a?.b', [1, 2, 3])).toEqual(undefined);
  });
});

describe('.[], .[0], .[0:2]', () => {
  test('.[0]', () => {
    expect(queryOne('.[0]', [1, 2, 3])).toEqual(1);
    expect(queryOne('.[0]', [{ a: 5 }, 2, 3])).toEqual({ a: 5 });
    expect(queryOne('.[0]', [[4, 5], 2, 3])).toEqual([4, 5]);
    expect(queryOne('.[0]', [])).toEqual(undefined);
    expect(queryOne('.[0]', 'lorem')).toEqual(undefined);
  });

  test('.[2:4]', () => {
    expect(queryOne('.[2:4]', [1, 2, 3, 4, 5, 6])).toEqual([3, 4]);
    expect(queryOne('.[2:4]', [{ a: 5 }, 2, 3, 4, 5, 6])).toEqual([3, 4]);
    expect(queryOne('.[2:4]', [[4, 5], 2, 3, 4, 5, 6])).toEqual([3, 4]);
    expect(queryOne('.[2:4]', [])).toEqual([]);
    expect(queryOne('.[2:4]', ['lorem'])).toEqual([]);
  });

  test('.[]', () => {
    expect(query('.[]', [[1, 2, 3]])).toEqual([1, 2, 3]);
    expect(query('.[]', [[{ a: 5 }, 2, 3]])).toEqual([{ a: 5 }, 2, 3]);
    expect(query('.[]', [[[4, 5], 2, 3]])).toEqual([[4, 5], 2, 3]);
    expect(query('.[]', [[]])).toEqual([]);
    expect(() => query('.[]', ['lorem'])).toThrowError();
    expect(() => query('.[]', [123])).toThrowError();
  });
});

describe('.["<string>"]', () => {
  test('.["test"]', () => {
    expect(queryOne('.["test"]', { test: 1 })).toEqual(1);
    expect(() => queryOne('.["test"]', 123)).toThrowError();
    expect(() => queryOne('.["test"]', 'lorem')).toThrowError();
    expect(() => queryOne('.["test"]', [1, 2, 3])).toThrowError();
  });
});

describe(',', () => {
  test('.[0],.[1]', () => {
    expect(query('.[0],.[1]', [[1, 2, 3]])).toEqual([1, 2]);
    expect(query('.[0],.[1]', [[{ a: 5 }, 2, 3]])).toEqual([{ a: 5 }, 2]);
    expect(query('.[0],.[1]', [[[4, 5], 2, 3]])).toEqual([[4, 5], 2]);
    expect(query('.[0],.[1]', [[]])).toEqual([]);
    expect(query('.[0],.[1]', ['lorem'])).toEqual([]);
  });

  test('.user, .projects[]', () => {
    expect(
      query('.user, .projects[]', [{ user: 'stedolan', projects: ['jq', 'wikiflow'] }])
    ).toEqual(['stedolan', 'jq', 'wikiflow']);
  });
});

describe('|', () => {
  test('.[] | .name', () => {
    expect(
      query('.[] | .name', [
        [
          { name: 'JSON', good: true },
          { name: 'XML', good: false }
        ]
      ])
    ).toEqual(['JSON', 'XML']);
  });
});

describe('[...]', () => {
  test('[.user, .projects[]]', () => {
    expect(
      query('[.user, .projects[]]', [{ user: 'stedolan', projects: ['jq', 'wikiflow'] }])
    ).toEqual([['stedolan', 'jq', 'wikiflow']]);
  });
});

describe('..', () => {
  test('query: .. | .a?', () => {
    expect(query('.. | .a?', [[[{ a: 1 }]]])).toEqual([1]);
  });
});

describe('+', () => {
  test('query: .a + 1', () => {
    expect(queryOne('.a + 1', { a: 2 })).toEqual(3);
    expect(queryOne('.a + 1', {})).toEqual(1);
  });
  test('query: .a + null', () => {
    expect(queryOne('.a + null', { a: 2 })).toEqual(2);
  });
  test('query: .a + .b', () => {
    expect(queryOne('.a + .b', { a: 2, b: 3 })).toEqual(5);
    expect(queryOne('.a + .b', { a: [1, 2], b: [3, 4] })).toEqual([1, 2, 3, 4]);
  });
  test('query: {a: 1} + {b: 2} + {c: 3} + {a: 42}', () => {
    expect(queryOne('{a: 1} + {b: 2} + {c: 3} + {a: 42}', null)).toEqual({
      a: 42,
      b: 2,
      c: 3
    });
  });
});

describe('-', () => {
  test('query: .a - 1', () => {
    expect(queryOne('.a - 1', { a: 2 })).toEqual(1);
    expect(queryOne('.a - 1', {})).toEqual(-1);
  });
  test('query: .a - null', () => {
    expect(queryOne('.a - null', { a: 2 })).toEqual(2);
  });
  test('query: . - ["xml", "yaml"]', () => {
    expect(queryOne('. - ["xml", "yaml"]', ['json', 'xml', 'yaml'])).toEqual(['json']);
  });
});

describe('length', () => {
  test('query: .[] | length', () => {
    expect(query('.[] | length', [[[1, 2], 'string', { a: 2 }, null, -5]])).toEqual([
      2, 6, 1, 0, 5
    ]);
  });
});

describe('has()', () => {
  test('query: has("foo")', () => {
    expect(query('has("foo")', [{ foo: 1, bar: 2 }, { bar: 3 }])).toEqual([true, false]);
  });
});

describe('in()', () => {
  test('query: .[] | in({"foo": 42})', () => {
    expect(query('.[] | in({"foo": 42})', [['foo', 'bar']])).toEqual([true, false]);
  });
});

describe('map()', () => {
  test('query: map(. + 1)', () => {
    expect(query('map(. + 1)', [[1, 2, 3]])).toEqual([[2, 3, 4]]);
  });
  test('query: map(., .)', () => {
    expect(query('map(., .)', [[1, 2]])).toEqual([[1, 1, 2, 2]]);
  });
});

describe('select()', () => {
  test('.[] | select(.id == "second")', () => {
    expect(query('.[] | select(.id == "second")', [[{ id: 'first' }, { id: 'second' }]])).toEqual([
      { id: 'second' }
    ]);
  });
  test('map(select(. >= 2))', () => {
    expect(query('map(select(. >= 2))', [[1, 2, 3]])).toEqual([[2, 3]]);
  });
});

describe('any', () => {
  test('any', () => {
    expect(query('any', [[true, true, false]])).toEqual([true]);
    expect(query('any', [[false, false, false]])).toEqual([false]);
    expect(query('any', [[]])).toEqual([false]);
  });
});

describe('all', () => {
  test('all', () => {
    expect(query('all', [[true, true, false]])).toEqual([false]);
    expect(query('all', [[true, true, true]])).toEqual([true]);
    expect(query('all', [[]])).toEqual([true]);
  });
});

describe('and', () => {
  test('42 and "a string"', () => {
    expect(queryOne('42 and "a string"', null)).toEqual(true);
  });
});

describe('or', () => {
  test('42 or "a string"', () => {
    expect(queryOne('42 or "a string"', null)).toEqual(true);
    expect(queryOne('false or false', null)).toEqual(false);
  });
});

describe('not', () => {
  test('true | not', () => {
    expect(queryOne('true | not', null)).toEqual(false);
  });

  test('[true, false | not]', () => {
    expect(query('[true, false | not]', [null])).toEqual([[true, true]]);
  });
});

describe('unique', () => {
  test('unique', () => {
    expect(query('unique', [[1, 2, 3, 2, 1]])).toEqual([[1, 2, 3]]);
  });

  test('unique_by(.a)', () => {
    expect(query('unique_by(.a)', [[{ a: 1 }, { a: 2 }, { a: 1 }]])).toEqual([
      [{ a: 1 }, { a: 2 }]
    ]);
  });
});

describe('max', () => {
  test('max', () => {
    expect(query('max', [[1, 2, 3, 2, 1]])).toEqual([3]);
  });

  test('max_by(.a)', () => {
    expect(query('max_by(.a)', [[{ a: 1 }, { a: 2 }, { a: 1 }]])).toEqual([{ a: 2 }]);
  });
});

describe('min', () => {
  test('min', () => {
    expect(query('min', [[1, 2, 3, 2, 1]])).toEqual([1]);
  });

  test('min_by(.a)', () => {
    expect(query('min_by(.a)', [[{ a: 1 }, { a: 2 }, { a: 1 }]])).toEqual([{ a: 1 }]);
  });
});

describe('group_by', () => {
  test('group_by(.a)', () => {
    expect(query('group_by(.a)', [[{ a: 1, c: 2 }, { a: 2 }, { a: 1, c: 3 }]])).toEqual([
      [
        [
          { a: 1, c: 2 },
          { a: 1, c: 3 }
        ],
        [{ a: 2 }]
      ]
    ]);
  });
});

describe('flatten', () => {
  test('flatten', () => {
    expect(query('flatten', [[1, [2, [3, 5]], 4, [5, 6]]])).toEqual([[1, 2, 3, 5, 4, 5, 6]]);
  });
});

describe('startswith()', () => {
  test('startswith("foo")', () => {
    expect(query('startswith("foo")', [['foo', 'bar']])).toEqual([[true, false]]);
  });
  test('[.[] | startswith("foo")]', () => {
    expect(
      query('[.[] | startswith("foo")]', [['fo', 'foo', 'barfoo', 'foobar', 'barfoob']])
    ).toEqual([[false, true, false, true, false]]);
  });
});

describe('abs', () => {
  test('map(abs)', () => {
    expect(query('map(abs)', [[-1, 2, -3]])).toEqual([[1, 2, 3]]);
  });
});

describe('keys', () => {
  test('query: keys', () => {
    expect(query('keys', [{ a: 1, b: 2 }])).toEqual([['a', 'b']]);
    expect(query('keys', [{ b: 2, a: 1 }])).toEqual([['a', 'b']]);
  });
});

describe('map_values()', () => {
  test('map_values(.+1)', () => {
    expect(query('map_values(.+1)', [{ a: 1, b: 2 }])).toEqual([
      {
        a: 2,
        b: 3
      }
    ]);
  });
});

describe('%', () => {
  test('. % 4', () => {
    expect(queryOne('. % 4', 10)).toEqual(2);
  });
  test('5 % 4', () => {
    expect(queryOne('5 % 4', null)).toEqual(1);
  });
});

describe('//', () => {
  test('.a // 42', () => {
    expect(queryOne('.a // 42', { a: 1 })).toEqual(1);
    expect(queryOne('.a // 42', {})).toEqual(42);
  });
});

describe('split()', () => {
  test('split(",")', () => {
    expect(query('split(",")', ['a,b,c'])).toEqual([['a', 'b', 'c']]);
  });
});

describe('join()', () => {
  test('join(",")', () => {
    expect(query('join(",")', [['a', 'b', 'c']])).toEqual(['a,b,c']);
  });
});

describe('contains()', () => {
  test('contains("foo")', () => {
    expect(query('contains("foo")', ['foobar'])).toEqual([true]);
  });

  test('contains(["baz", "bar"])', () => {
    expect(query('contains(["baz", "bar"])', [['foobar', 'foobaz', 'blarp']])).toEqual([true]);
    expect(query('contains(["bazzzzz", "bar"])', [['foobar', 'foobaz', 'blarp']])).toEqual([false]);
  });
});

describe('object construction', () => {
  test('{user: .user, title: .titles[]}', () => {
    expect(
      query('{user: .user, title: .titles[]}', [
        { user: 'stedolan', titles: ['JQ Primer', 'More JQ'] }
      ])
    ).toEqual([
      { user: 'stedolan', title: 'JQ Primer' },
      { user: 'stedolan', title: 'More JQ' }
    ]);
  });

  test('{user, title: .titles[]}', () => {
    expect(
      query('{user, title: .titles[]}', [{ user: 'stedolan', titles: ['JQ Primer', 'More JQ'] }])
    ).toEqual([
      { user: 'stedolan', title: 'JQ Primer' },
      { user: 'stedolan', title: 'More JQ' }
    ]);
  });

  test('{(.user): .titles}', () => {
    expect(
      query('{(.user): .titles}', [{ user: 'stedolan', titles: ['JQ Primer', 'More JQ'] }])
    ).toEqual([{ stedolan: ['JQ Primer', 'More JQ'] }]);
  });
});

describe('variable expansion', () => {
  test('$foo', () => {
    expect(query('$foo', [undefined], { $foo: 1 })).toEqual([1]);
  });
});

describe('def', () => {
  test('def foo: .test; .|foo', () => {
    expect(query('def foo: .test; .|foo', [{ test: 'abc' }])).toEqual(['abc']);
  });

  test('def foo(f): 7; 5|foo(3)', () => {
    expect(query('def foo(f): 7; 5|foo(3)', [undefined])).toEqual([7]);
  });

  test('def foo(f): 7+f; 5|foo(3)', () => {
    expect(query('def foo(f): 7+f; 5|foo(3)', [undefined])).toEqual([10]);
  });

  test('def foo(f): 7|f; 5|foo(.+1)', () => {
    expect(query('def foo(f): 7|f; 5|foo(.+1)', [undefined])).toEqual([8]);
  });

  test('def foo(f): f|f; 5|foo(.+2)', () => {
    expect(query('def foo(f): f|f; 5|foo(.+2)', [undefined])).toEqual([9]);
  });

  test('def addvalue(f): . + [f]; map(addvalue(.[0]))', () => {
    expect(
      query('def addvalue(f): . + [f]; map(addvalue(.[0]))', [
        [
          [1, 2],
          [10, 20]
        ]
      ])
    ).toEqual([
      [
        [1, 2, 1],
        [10, 20, 10]
      ]
    ]);
  });
});

describe('range', () => {
  test('range(2)', () => {
    expect(query('range(2)', [undefined])).toEqual([0, 1]);
  });

  test('[range(0;5)]', () => {
    expect(query('[range(0;5)]', [undefined])).toEqual([[0, 1, 2, 3, 4]]);
  });

  test('[range(0,1;3,4)]', () => {
    expect(query('[range(0,1;3,4)]', [undefined])).toEqual([[0, 1, 2, 0, 1, 2, 3, 1, 2, 1, 2, 3]]);
  });
});

describe('limit', () => {
  test('[limit(3;.[])]', () => {
    expect(query('[limit(3;.[])]', [[0, 1, 2, 3, 4, 5]])).toEqual([[0, 1, 2]]);
  });
});

describe('first and last', () => {
  test('first, last, nth', () => {
    expect(query('.|first', [[0, 1, 2, 3, 4, 5, 6]])).toEqual([0]);
    expect(query('.|last', [[0, 1, 2, 3, 4, 5, 6]])).toEqual([6]);
    expect(query('.|nth(5)', [[0, 1, 2, 3, 4, 5, 6]])).toEqual([5]);
  });

  test('first(), last(), nth()', () => {
    expect(query('first(range(.))', [10])).toEqual([0]);
    expect(query('last(range(.))', [10])).toEqual([9]);
    expect(query('nth(. - 2; range(.))', [10])).toEqual([8]);
  });
});

describe('variable binding', () => {
  test('.bar as $x | .foo | . + $x', () => {
    expect(query('.bar as $x | .foo | . + $x', [{ foo: 10, bar: 200 }])).toEqual([210]);
  });

  test('. as $i|[(. + 2|. as $i| $i), $i]', () => {
    expect(query('. as $i|[(. + 2|. as $i| $i), $i]', [5])).toEqual([[7, 5]]);
  });
});

describe('complex use-cases', () => {
  test('.elements[] | select(.id == "2" or .id == "4")', () => {
    const data = {
      elements: [{ id: '2' }, { id: '3' }, { id: '4' }]
    };

    expect(query('.elements[] | select(.id == "2" or .id == "4")', [data])).toEqual([
      { id: '2' },
      { id: '4' }
    ]);
  });

  test('.elements[] | select(.id == ("2" , "4"))', () => {
    const data = {
      elements: [{ id: '2' }, { id: '3' }, { id: '4' }]
    };

    expect(query('.elements[] | select(.id == ("2" , "4"))', [data])).toEqual([
      { id: '2' },
      { id: '4' }
    ]);
  });

  test('.elements[] | { id, type }', () => {
    const data = {
      elements: [{ id: '2', test: '123' }, { id: '3', type: 'abc' }, { id: '4' }]
    };

    expect(query('.elements[] | { id, type }', [data])).toEqual([
      { id: '2' },
      { id: '3', type: 'abc' },
      { id: '4' }
    ]);
  });

  test('. | { id, type, _drilldown: ["a"] }', () => {
    expect(query('. | { id, type, _drilldown: ["a"] }', [{ id: '2', type: 'abc' }])).toEqual([
      { id: '2', type: 'abc', _drilldown: ['a'] }
    ]);
  });

  // TODO: Add support for this somehow
  test.skip('.elements[] | select(.id == ["2", "4"][])', () => {
    const data = {
      elements: [{ id: '2' }, { id: '3' }, { id: '4' }]
    };

    expect(query('.elements[] | select(.id == ["2", "4"][])', [data])).toEqual([
      { id: '2' },
      { id: '4' }
    ]);
  });

  test('dummy', () => {
    console.log(query('["a", "b"] | .[]', [undefined]));
  });
});
