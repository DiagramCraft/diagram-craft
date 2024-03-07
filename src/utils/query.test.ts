import { describe, expect, test } from 'vitest';
import { OObjects, parseAndQuery } from './query.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const queryOne = (q: string, input: any) => {
  const res = parseAndQuery(q, [input]);
  if (res.length > 1) throw new Error();
  return res[0];
};

describe('OObject', () => {
  test('parse OString', () => {
    expect(OObjects.parseString('"lorem"')).toEqual([{ path: [], val: 'lorem' }]);
  });

  test('parse ONumber', () => {
    expect(OObjects.parseString('1234')).toEqual([{ path: [], val: 1234 }]);
  });

  test('parse OBoolean', () => {
    expect(OObjects.parseString('true')).toEqual([{ path: [], val: true }]);
    expect(OObjects.parseString('false')).toEqual([{ path: [], val: false }]);
  });

  test('parse OArray', () => {
    expect(OObjects.parseString('[1, 2, 3]')).toEqual([
      { path: [0], val: 1 },
      { path: [1], val: 2 },
      { path: [2], val: 3 }
    ]);
    expect(OObjects.parseString('["a", "b"]')).toEqual([
      { path: [0], val: 'a' },
      { path: [1], val: 'b' }
    ]);
    expect(OObjects.parseString('[1, "b"]')).toEqual([
      { path: [0], val: 1 },
      { path: [1], val: 'b' }
    ]);
  });

  test('parse OObject', () => {
    expect(OObjects.parseString('{ ab: 1, b: 2}')).toEqual([
      { path: ['ab'], val: 1 },
      { path: ['b'], val: 2 }
    ]);
    expect(OObjects.parseString('{ ab: "test", b: 2}')).toEqual([
      { path: ['ab'], val: 'test' },
      { path: ['b'], val: 2 }
    ]);
    expect(OObjects.parseString('{ ab: [7, 8], b: 2}')).toEqual([
      { path: ['ab', 0], val: 7 },
      { path: ['ab', 1], val: 8 },
      { path: ['b'], val: 2 }
    ]);
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
    expect(parseAndQuery('.[]', [[1, 2, 3]])).toEqual([1, 2, 3]);
    expect(parseAndQuery('.[]', [[{ a: 5 }, 2, 3]])).toEqual([{ a: 5 }, 2, 3]);
    expect(parseAndQuery('.[]', [[[4, 5], 2, 3]])).toEqual([[4, 5], 2, 3]);
    expect(parseAndQuery('.[]', [[]])).toEqual([]);
    expect(() => parseAndQuery('.[]', ['lorem'])).toThrowError();
    expect(() => parseAndQuery('.[]', [123])).toThrowError();
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
    expect(parseAndQuery('.[0],.[1]', [[1, 2, 3]])).toEqual([1, 2]);
    expect(parseAndQuery('.[0],.[1]', [[{ a: 5 }, 2, 3]])).toEqual([{ a: 5 }, 2]);
    expect(parseAndQuery('.[0],.[1]', [[[4, 5], 2, 3]])).toEqual([[4, 5], 2]);
    expect(parseAndQuery('.[0],.[1]', ['lorem'])).toEqual([]);
  });

  test('.user, .projects[]', () => {
    expect(
      parseAndQuery('.user, .projects[]', [{ user: 'stedolan', projects: ['jq', 'wikiflow'] }])
    ).toEqual(['stedolan', 'jq', 'wikiflow']);
  });
});

describe('|', () => {
  test('.[] | .name', () => {
    expect(
      parseAndQuery('.[] | .name', [
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
      parseAndQuery('[.user, .projects[]]', [{ user: 'stedolan', projects: ['jq', 'wikiflow'] }])
    ).toEqual([['stedolan', 'jq', 'wikiflow']]);
  });
});

describe('..', () => {
  test('query: .. | .a?', () => {
    expect(parseAndQuery('.. | .a?', [[[{ a: 1 }]]])).toEqual([1]);
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
    expect(parseAndQuery('.[] | length', [[[1, 2], 'string', { a: 2 }, null, -5]])).toEqual([
      2, 6, 1, 0, 5
    ]);
  });
});

describe('has()', () => {
  test('query: has("foo")', () => {
    expect(parseAndQuery('has("foo")', [{ foo: 1, bar: 2 }, { bar: 3 }])).toEqual([true, false]);
  });
});

describe('in()', () => {
  test('query: .[] | in({"foo": 42})', () => {
    expect(parseAndQuery('.[] | in({"foo": 42})', [['foo', 'bar']])).toEqual([true, false]);
  });
});

describe('map()', () => {
  test('query: map(. + 1)', () => {
    expect(parseAndQuery('map(. + 1)', [[1, 2, 3]])).toEqual([[2, 3, 4]]);
  });
  test('query: map(., .)', () => {
    expect(parseAndQuery('map(., .)', [[1, 2]])).toEqual([[1, 1, 2, 2]]);
  });
});

describe('select()', () => {
  test('.[] | select(.id == "second")', () => {
    expect(
      parseAndQuery('.[] | select(.id == "second")', [[{ id: 'first' }, { id: 'second' }]])
    ).toEqual([{ id: 'second' }]);
  });
  test('map(select(. >= 2))', () => {
    expect(parseAndQuery('map(select(. >= 2))', [[1, 2, 3]])).toEqual([[2, 3]]);
  });
});

describe('any', () => {
  test('any', () => {
    expect(parseAndQuery('any', [[true, true, false]])).toEqual([true]);
    expect(parseAndQuery('any', [[false, false, false]])).toEqual([false]);
    expect(parseAndQuery('any', [[]])).toEqual([false]);
  });
});

describe('all', () => {
  test('all', () => {
    expect(parseAndQuery('all', [[true, true, false]])).toEqual([false]);
    expect(parseAndQuery('all', [[true, true, true]])).toEqual([true]);
    expect(parseAndQuery('all', [[]])).toEqual([true]);
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
    expect(parseAndQuery('[true, false | not]', [[]])).toEqual([[false, true]]);
  });
});

describe('unique', () => {
  test('unique', () => {
    expect(parseAndQuery('unique', [[1, 2, 3, 2, 1]])).toEqual([[1, 2, 3]]);
  });

  test('unique_by(.a)', () => {
    expect(parseAndQuery('unique_by(.a)', [[{ a: 1 }, { a: 2 }, { a: 1 }]])).toEqual([
      [{ a: 1 }, { a: 2 }]
    ]);
  });
});

describe('max', () => {
  test('max', () => {
    expect(parseAndQuery('max', [[1, 2, 3, 2, 1]])).toEqual([3]);
  });

  test('max_by(.a)', () => {
    expect(parseAndQuery('max_by(.a)', [[{ a: 1 }, { a: 2 }, { a: 1 }]])).toEqual([{ a: 2 }]);
  });
});

describe('min', () => {
  test('min', () => {
    expect(parseAndQuery('min', [[1, 2, 3, 2, 1]])).toEqual([1]);
  });

  test('min_by(.a)', () => {
    expect(parseAndQuery('min_by(.a)', [[{ a: 1 }, { a: 2 }, { a: 1 }]])).toEqual([{ a: 1 }]);
  });
});

describe('group_by', () => {
  test('group_by(.a)', () => {
    expect(parseAndQuery('group_by(.a)', [[{ a: 1, c: 2 }, { a: 2 }, { a: 1, c: 3 }]])).toEqual([
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
    expect(parseAndQuery('flatten', [[1, [2, [3, 5]], 4, [5, 6]]])).toEqual([
      [1, 2, 3, 5, 4, 5, 6]
    ]);
  });
});

describe('startswith()', () => {
  test('startswith("foo")', () => {
    expect(parseAndQuery('startswith("foo")', [['foo', 'bar']])).toEqual([[true, false]]);
  });
  test('[.[] | startswith("foo")]', () => {
    expect(
      parseAndQuery('[.[] | startswith("foo")]', [['fo', 'foo', 'barfoo', 'foobar', 'barfoob']])
    ).toEqual([[false, true, false, true, false]]);
  });
});

describe('abs', () => {
  test('map(abs)', () => {
    expect(parseAndQuery('map(abs)', [[-1, 2, -3]])).toEqual([[1, 2, 3]]);
  });
});

describe('keys', () => {
  test('query: keys', () => {
    expect(parseAndQuery('keys', [{ a: 1, b: 2 }])).toEqual([['a', 'b']]);
    expect(parseAndQuery('keys', [{ b: 2, a: 1 }])).toEqual([['a', 'b']]);
  });
});

describe('map_values()', () => {
  test('map_values(.+1)', () => {
    expect(parseAndQuery('map_values(.+1)', [{ a: 1, b: 2 }])).toEqual([
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
    expect(parseAndQuery('split(",")', ['a,b,c'])).toEqual([['a', 'b', 'c']]);
  });
});

describe('join()', () => {
  test('join(",")', () => {
    expect(parseAndQuery('join(",")', [['a', 'b', 'c']])).toEqual(['a,b,c']);
  });
});

describe('contains()', () => {
  test('contains("foo")', () => {
    expect(parseAndQuery('contains("foo")', ['foobar'])).toEqual([true]);
  });

  test('contains(["baz", "bar"])', () => {
    expect(parseAndQuery('contains(["baz", "bar"])', [['foobar', 'foobaz', 'blarp']])).toEqual([
      true
    ]);
    expect(parseAndQuery('contains(["bazzzzz", "bar"])', [['foobar', 'foobaz', 'blarp']])).toEqual([
      false
    ]);
  });

  test('contains({foo: 12, bar: [{barp: 12}]})', () => {
    expect(
      parseAndQuery('contains({foo: 12, bar: [{barp: 12}]})', [
        { foo: 12, bar: [1, 2, { barp: 12, blip: 13 }] }
      ])
    ).toEqual([true]);
  });

  test('contains({foo: 12, bar: [{barp: 15}]})', () => {
    expect(
      parseAndQuery('contains({foo: 12, bar: [{barp: 15}]})', [
        { foo: 12, bar: [1, 2, { barp: 12, blip: 13 }] }
      ])
    ).toEqual([false]);
  });
});

describe('object construction', () => {
  test('{user: .user, title: .titles[]}', () => {
    expect(
      parseAndQuery('{user: .user, title: .titles[]}', [
        { user: 'stedolan', titles: ['JQ Primer', 'More JQ'] }
      ])
    ).toEqual([
      { user: 'stedolan', title: 'JQ Primer' },
      { user: 'stedolan', title: 'More JQ' }
    ]);
  });

  test('{user, title: .titles[]}', () => {
    expect(
      parseAndQuery('{user, title: .titles[]}', [
        { user: 'stedolan', titles: ['JQ Primer', 'More JQ'] }
      ])
    ).toEqual([
      { user: 'stedolan', title: 'JQ Primer' },
      { user: 'stedolan', title: 'More JQ' }
    ]);
  });

  test('{(.user): .titles}', () => {
    expect(
      parseAndQuery('{(.user): .titles}', [{ user: 'stedolan', titles: ['JQ Primer', 'More JQ'] }])
    ).toEqual([{ stedolan: ['JQ Primer', 'More JQ'] }]);
  });
});

describe('variable expansion', () => {
  test('$foo', () => {
    expect(parseAndQuery('$foo', [undefined], { $foo: 1 })).toEqual([1]);
  });
});

describe('def', () => {
  test('def foo: .test; .|foo', () => {
    expect(parseAndQuery('def foo: .test; .|foo', [{ test: 'abc' }])).toEqual(['abc']);
  });

  test('def foo(f): 7; 5|foo(3)', () => {
    expect(parseAndQuery('def foo(f): 7; 5|foo(3)', [undefined])).toEqual([7]);
  });

  test('def foo(f): 7+f; 5|foo(3)', () => {
    expect(parseAndQuery('def foo(f): 7+f; 5|foo(3)', [undefined])).toEqual([10]);
  });

  test('def foo(f): 7|f; 5|foo(.+1)', () => {
    expect(parseAndQuery('def foo(f): 7|f; 5|foo(.+1)', [undefined])).toEqual([8]);
  });

  test('def foo(f): f|f; 5|foo(.+2)', () => {
    expect(parseAndQuery('def foo(f): f|f; 5|foo(.+2)', [undefined])).toEqual([9]);
  });

  test('def addvalue(f): . + [f]; map(addvalue(.[0]))', () => {
    expect(
      parseAndQuery('def addvalue(f): . + [f]; map(addvalue(.[0]))', [
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
    expect(parseAndQuery('range(2)', [undefined])).toEqual([0, 1]);
  });

  test('[range(0;5)]', () => {
    expect(parseAndQuery('[range(0;5)]', [undefined])).toEqual([[0, 1, 2, 3, 4]]);
  });

  test('[range(0,1;3,4)]', () => {
    expect(parseAndQuery('[range(0,1;3,4)]', [undefined])).toEqual([
      [0, 1, 2, 0, 1, 2, 3, 1, 2, 1, 2, 3]
    ]);
  });
});

describe('limit', () => {
  test('[limit(3;.[])]', () => {
    expect(parseAndQuery('[limit(3;.[])]', [[0, 1, 2, 3, 4, 5]])).toEqual([[0, 1, 2]]);
  });
});

describe('first and last', () => {
  test('first, last, nth', () => {
    expect(parseAndQuery('.|first', [[0, 1, 2, 3, 4, 5, 6]])).toEqual([0]);
    expect(parseAndQuery('.|last', [[0, 1, 2, 3, 4, 5, 6]])).toEqual([6]);
    expect(parseAndQuery('.|nth(5)', [[0, 1, 2, 3, 4, 5, 6]])).toEqual([5]);
  });

  test('first(), last(), nth()', () => {
    expect(parseAndQuery('first(range(.))', [10])).toEqual([0]);
    expect(parseAndQuery('last(range(.))', [10])).toEqual([9]);
    expect(parseAndQuery('nth(. - 2; range(.))', [10])).toEqual([8]);
  });
});

describe('variable binding', () => {
  test('.bar as $x | .foo | . + $x', () => {
    expect(parseAndQuery('.bar as $x | .foo | . + $x', [{ foo: 10, bar: 200 }])).toEqual([210]);
  });

  test('. as $i|[(. + 2|. as $i| $i), $i]', () => {
    expect(parseAndQuery('. as $i|[(. + 2|. as $i| $i), $i]', [5])).toEqual([[7, 5]]);
  });
});

describe('if', () => {
  test('if . == 0 then "zero" elif . == 1 then "one" else "many" end', () => {
    expect(
      parseAndQuery('if . == 0 then "zero" elif . == 1 then "one" else "many" end', [0])
    ).toEqual(['zero']);
    expect(
      parseAndQuery('if . == 0 then "zero" elif . == 1 then "one" else "many" end', [1])
    ).toEqual(['one']);
    expect(
      parseAndQuery('if . == 0 then "zero" elif . == 1 then "one" else "many" end', [2])
    ).toEqual(['many']);
  });
});

describe('empty', () => {
  test('1, empty, 2', () => {
    expect(parseAndQuery('1, empty, 2', [undefined])).toEqual([1, 2]);
  });

  test('[1,2,empty,3]', () => {
    expect(parseAndQuery('[1,2,empty,3]', [undefined])).toEqual([[1, 2, 3]]);
  });
});

describe('comment', () => {
  test('1, # empty, 2', () => {
    expect(
      parseAndQuery(
        `4,
    # 3, 
    2`,
        [undefined]
      )
    ).toEqual([4, 2]);
  });
});

describe('try.-catch', () => {
  test('try .a catch ". is not an object"', () => {
    expect(parseAndQuery('try .a catch ". is not an object"', [true])).toEqual([
      '. is not an object'
    ]);
  });

  test('[.[]|try .a]', () => {
    expect(parseAndQuery('[.[]|try .a]', [[{}, true, { a: 1 }]])).toEqual([[undefined, 1]]);
  });
});

describe('regexp', () => {
  test('test("foo")', () => {
    expect(parseAndQuery('test("foo")', ['foo'])).toEqual([true]);
  });

  test('.[] | test("abc"; "i")', () => {
    expect(parseAndQuery('.[] | test("abc"; "i")', [['xabcd', 'ABC']])).toEqual([true, true]);
  });

  test('match("(abc)+"; "g")', () => {
    expect(parseAndQuery('match("(abc)+"; "g")', ['abc abc'])).toEqual([
      {
        offset: 0,
        length: 3,
        string: 'abc',
        captures: [{ /*offset: 0, */ length: 3, string: 'abc' /*name: null*/ }]
      },
      {
        offset: 4,
        length: 3,
        string: 'abc',
        captures: [{ /*offset: 4, */ length: 3, string: 'abc' /*name: null*/ }]
      }
    ]);
  });

  test('match("foo")', () => {
    expect(parseAndQuery('match("foo")', ['foo bar foo'])).toEqual([
      { offset: 0, length: 3, string: 'foo', captures: [] }
    ]);
  });

  test('match("foo"; "ig")', () => {
    expect(parseAndQuery('match("foo"; "ig")', ['foo bar FOO'])).toEqual([
      { offset: 0, length: 3, string: 'foo', captures: [] },
      { offset: 8, length: 3, string: 'FOO', captures: [] }
    ]);
  });

  test.skip('match("foo (?<bar123>bar)? ?foo"; "ig")', () => {
    expect(
      parseAndQuery('match("foo (?<bar123>bar)? ?foo"; "ig")', ['foo bar foo foo foo'])
    ).toEqual([
      {
        offset: 0,
        length: 11,
        string: 'foo bar foo',
        captures: [{ offset: 4, length: 3, string: 'bar', name: 'bar123' }]
      },
      {
        offset: 12,
        length: 8,
        string: 'foo foo',
        captures: [{ offset: -1, length: 0, string: null, name: 'bar123' }]
      }
    ]);
  });

  test('[ match("."; "g")] | length', () => {
    expect(parseAndQuery('[ match("."; "g")] | length', ['abc'])).toEqual([3]);
  });
});

describe('path', () => {
  test('path(.a)', () => {
    expect(parseAndQuery('path(.a)', [{ a: 1 }])).toEqual([['a']]);
  });
  test('path(.a.b)', () => {
    expect(parseAndQuery('path(.a.b)', [{ a: { b: 2 } }])).toEqual([['a', 'b']]);
    expect(parseAndQuery('path(.a.b)', [{ c: 3 }])).toEqual([['a', 'b']]);
  });
  test('path(.a.b, .a.c)', () => {
    expect(parseAndQuery('path(.a.b, .a.c)', [{ a: { b: 2, c: 4 } }])).toEqual([
      ['a', 'b'],
      ['a', 'c']
    ]);
  });
  test('path(.a[].b)', () => {
    expect(parseAndQuery('path(.a[].b)', [{ a: [{ b: 2 }, { b: 4 }] }])).toEqual([
      ['a', 0, 'b'],
      ['a', 1, 'b']
    ]);
  });

  test('path(.a[1:3])', () => {
    expect(parseAndQuery('path(.a[1:3])', [{ a: [1, 2, 3, 4] }])).toEqual([
      [
        'a',
        {
          start: 1,
          end: 3
        }
      ]
    ]);
  });

  test('[path(..)]', () => {
    expect(parseAndQuery('[path(..)]', [{ a: [{ b: 1 }] }])).toEqual([
      [[], ['a'], ['a', 0], ['a', 0, 'b']]
    ]);
  });

  test('path(.a[0].b)', () => {
    expect(parseAndQuery('path(.a[0].b)', [undefined])).toEqual([['a', 0, 'b']]);
  });
});

describe('assignment', () => {
  test('.a = .b', () => {
    expect(parseAndQuery('.a = .b', [{ a: { b: 10 }, b: 20 }])).toEqual([{ a: 20, b: 20 }]);
  });

  test('.a |= .b', () => {
    expect(parseAndQuery('.a |= .b', [{ a: { b: 10 }, b: 20 }])).toEqual([{ a: 10, b: 20 }]);
  });

  test('(.a, .b) = range(3)', () => {
    expect(parseAndQuery('(.a, .b) = range(3)', [undefined])).toEqual([
      { a: 0, b: 0 },
      { a: 1, b: 1 },
      { a: 2, b: 2 }
    ]);
  });

  test('(.a, .b) |= range(3)', () => {
    expect(parseAndQuery('(.a, .b) |= range(3)', [undefined])).toEqual([{ a: 0, b: 0 }]);
  });
});

describe('reduce', () => {
  test('reduce .[] as $item (0; . + $item)', () => {
    expect(parseAndQuery('reduce .[] as $item (0; . + $item)', [[1, 2, 3, 4, 5]])).toEqual([15]);
  });
});

describe('destructuring', () => {
  test('. as [$a, $b, {c: $c}] | $a + $b + $c', () => {
    expect(
      parseAndQuery('. as [$a, $b, {c: $c}] | $a + $b + $c', [[2, 3, { c: 4, d: 5 }]])
    ).toEqual([9]);
  });
});

describe('type', () => {
  test('map(type)', () => {
    expect(parseAndQuery('map(type)', [[0, false, [], {}, null, 'hello']])).toEqual([
      ['number', 'boolean', 'array', 'object', 'null', 'string']
    ]);
  });
});

describe('complex use-cases', () => {
  test('range(0,1;3,4)', () => {
    expect(parseAndQuery('range(0,1;3,4)', [undefined])).toEqual([
      0, 1, 2, 0, 1, 2, 3, 1, 2, 1, 2, 3
    ]);
  });

  test('.elements[] | select(.id == "2" or .id == "4")', () => {
    const data = {
      elements: [{ id: '2' }, { id: '3' }, { id: '4' }]
    };

    expect(parseAndQuery('.elements[] | select(.id == "2" or .id == "4")', [data])).toEqual([
      { id: '2' },
      { id: '4' }
    ]);
  });

  test('.elements[] | select(.id == ("2" , "4"))', () => {
    const data = {
      elements: [{ id: '2' }, { id: '3' }, { id: '4' }]
    };

    expect(parseAndQuery('.elements[] | select(.id == ("2" , "4"))', [data])).toEqual([
      { id: '2' },
      { id: '4' }
    ]);
  });

  test('.elements[] | { id, type }', () => {
    const data = {
      elements: [{ id: '2', test: '123' }, { id: '3', type: 'abc' }, { id: '4' }]
    };

    expect(parseAndQuery('.elements[] | { id, type }', [data])).toEqual([
      { id: '2' },
      { id: '3', type: 'abc' },
      { id: '4' }
    ]);
  });

  test('. | { id, type, _drilldown: ["a"] }', () => {
    expect(
      parseAndQuery('. | { id, type, _drilldown: ["a"] }', [{ id: '2', type: 'abc' }])
    ).toEqual([{ id: '2', type: 'abc', _drilldown: ['a'] }]);
  });

  // TODO: Add support for this somehow
  test.skip('.elements[] | select(.id == ["2", "4"][])', () => {
    const data = {
      elements: [{ id: '2' }, { id: '3' }, { id: '4' }]
    };

    expect(parseAndQuery('.elements[] | select(.id == ["2", "4"][])', [data])).toEqual([
      { id: '2' },
      { id: '4' }
    ]);
  });

  test('.a.b', () => {
    expect(parseAndQuery('.a.b', [{ c: 3 }])).toEqual([undefined]);
  });

  test('dummy', () => {
    //console.dir(parse('{ $a, $b }', false), { depth: 10 });
    //console.dir(parse('{ k: [ $a, $b ] }', false), { depth: 10 });
    //console.dir(parse('{(.user): .titles}', false), { depth: 20 });
    //console.log(parseAndQuery('["a", "b"] | .[]', [undefined]));

    console.dir(OObjects.parseString('{ $a, $b }'), { depth: 10 });

    /*
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
    });*/
  });
});
