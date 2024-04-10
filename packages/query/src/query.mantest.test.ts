import { describe, expect, test } from 'vitest';
import { parseAndQuery } from './query';

// See https://github.com/jqlang/jq/blob/master/tests/man.test

describe('mantest', () => {
  test('.', () => {
    expect(parseAndQuery('.', ['Hello, world!'])).toEqual(['Hello, world!']);
  });

  // NOTE: The real test uses higher precision than easily supported in JavaScript
  test('.', () => {
    expect(parseAndQuery('.', [0.123456789])).toEqual([0.123456789]);
  });

  // NOTE: The real test uses higher precision than easily supported in JavaScript
  test('[., tojson]', () => {
    expect(parseAndQuery('[., tojson]', [1234567890])).toEqual([[1234567890, '1234567890']]);
  });

  // NOTE: The real test uses higher precision than easily supported in JavaScript
  test('. < 0.1234567890', () => {
    expect(parseAndQuery('. < 0.1234567890', [0.123456789])).toEqual([false]);
  });

  test.skip('map([., . == 1]) | tojson', () => {
    expect(parseAndQuery('map([., . == 1]) | tojson', [1, 1.0, 1.0, 100e-2])).toEqual([
      '[[1,true],[1.000,true],[1.0,true],[1.00,true]]'
    ]);
  });

  // NOTE: This seems to work in standard JQ only for VERY BIG numbers
  test.skip('. as $big | [$big, $big + 1] | map(. > 10000000)', () => {
    expect(parseAndQuery('. as $big | [$big, $big + 1] | map(. > 10000000)', [10000001])).toEqual([
      [true, false]
    ]);
  });

  test('.foo', () => {
    expect(parseAndQuery('.foo', [{ foo: 42, bar: 'less interesting data' }])).toEqual([42]);
    expect(parseAndQuery('.foo', [{ notfoo: true, alsonotfoo: false }])).toEqual([undefined]);
  });

  test('.["foo"]', () => {
    expect(parseAndQuery('.["foo"]', [{ foo: 42 }])).toEqual([42]);
  });

  test('.foo?', () => {
    expect(parseAndQuery('.foo?', [{ foo: 42, bar: 'less interesting data' }])).toEqual([42]);
  });

  test('.["foo"]?', () => {
    expect(parseAndQuery('.["foo"]?', [{ foo: 42 }])).toEqual([42]);
  });

  test('[.foo?]', () => {
    expect(parseAndQuery('[.foo?]', [[1, 2]])).toEqual([[]]);
  });

  test('.[0]', () => {
    expect(
      parseAndQuery('.[0]', [
        [
          { name: 'JSON', good: true },
          { name: 'XML', good: false }
        ]
      ])
    ).toEqual([{ name: 'JSON', good: true }]);
  });

  test('.[2]', () => {
    expect(
      parseAndQuery('.[2]', [
        [
          { name: 'JSON', good: true },
          { name: 'XML', good: false }
        ]
      ])
    ).toEqual([undefined]);
  });

  test('.[-2]', () => {
    expect(parseAndQuery('.[-2]', [[1, 2, 3]])).toEqual([2]);
  });

  test('.[2:4]', () => {
    expect(parseAndQuery('.[2:4]', [['a', 'b', 'c', 'd', 'e']])).toEqual([['c', 'd']]);
    expect(parseAndQuery('.[2:4]', ['abcdefghi'])).toEqual(['cd']);
  });

  test('.[:3]', () => {
    expect(parseAndQuery('.[:3]', [['a', 'b', 'c', 'd', 'e']])).toEqual([['a', 'b', 'c']]);
  });

  test('.[]', () => {
    expect(
      parseAndQuery('.[]', [
        [
          { name: 'JSON', good: true },
          { name: 'XML', good: false }
        ]
      ])
    ).toEqual([
      { name: 'JSON', good: true },
      { name: 'XML', good: false }
    ]);
  });

  test('.[]', () => {
    expect(parseAndQuery('.[]', [[]])).toEqual([]);
  });

  test('.foo[]', () => {
    expect(parseAndQuery('.foo[]', [{ foo: [1, 2, 3] }])).toEqual([1, 2, 3]);
  });

  test('.[]', () => {
    expect(parseAndQuery('.[]', [{ a: 1, b: 1 }])).toEqual([1, 1]);
  });

  test('.foo, .bar', () => {
    expect(parseAndQuery('.foo, .bar', [{ foo: 42, bar: 'something else', baz: true }])).toEqual([
      42,
      'something else'
    ]);
  });

  test('.user, .projects[]', () => {
    expect(
      parseAndQuery('.user, .projects[]', [{ user: 'stedolan', projects: ['jq', 'wikiflow'] }])
    ).toEqual(['stedolan', 'jq', 'wikiflow']);
  });

  test('.[4,2]', () => {
    expect(parseAndQuery('.[4,2]', [['a', 'b', 'c', 'd', 'e']])).toEqual(['e', 'c']);
  });

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

  test('(. + 2) * 5', () => {
    expect(parseAndQuery('(. + 2) * 5', [1])).toEqual([15]);
  });

  test('[.user, .projects[]]', () => {
    expect(
      parseAndQuery('[.user, .projects[]]', [{ user: 'stedolan', projects: ['jq', 'wikiflow'] }])
    ).toEqual([['stedolan', 'jq', 'wikiflow']]);
  });

  test('[ .[] | . * 2]', () => {
    expect(parseAndQuery('[ .[] | . * 2]', [[1, 2, 3]])).toEqual([[2, 4, 6]]);
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

  test('.. | .a?', () => {
    expect(parseAndQuery('.. | .a?', [[[{ a: 1 }]]])).toEqual([1]);
  });

  test('.a + 1', () => {
    expect(parseAndQuery('.a + 1', [{ a: 7 }])).toEqual([8]);
  });

  test('.a + .b', () => {
    expect(parseAndQuery('.a + .b', [{ a: [1, 2], b: [3, 4] }])).toEqual([[1, 2, 3, 4]]);
  });

  test('.a + null', () => {
    expect(parseAndQuery('.a + null', [{ a: 1 }])).toEqual([1]);
  });

  test('.a + 1', () => {
    expect(parseAndQuery('.a + 1', [{}])).toEqual([1]);
  });

  test('{a: 1} + {b: 2} + {c: 3} + {a: 42}', () => {
    expect(parseAndQuery('{a: 1} + {b: 2} + {c: 3} + {a: 42}', [null])).toEqual([
      { a: 42, b: 2, c: 3 }
    ]);
  });

  test('4 - .a', () => {
    expect(parseAndQuery('4 - .a', [{ a: 3 }])).toEqual([1]);
  });

  test('. - ["xml", "yaml"]', () => {
    expect(parseAndQuery('. - ["xml", "yaml"]', [['xml', 'yaml', 'json']])).toEqual([['json']]);
  });

  test('10 / . * 3', () => {
    expect(parseAndQuery('10 / . * 3', [5])).toEqual([6]);
  });

  test('. / ", "', () => {
    expect(parseAndQuery('. / ", "', ['a, b,c,d, e'])).toEqual([['a', 'b,c,d', 'e']]);
  });

  test('{"k": {"a": 1, "b": 2}} * {"k": {"a": 0,"c": 3}}', () => {
    expect(parseAndQuery('{"k": {"a": 1, "b": 2}} * {"k": {"a": 0,"c": 3}}', [null])).toEqual([
      { k: { a: 0, b: 2, c: 3 } }
    ]);
  });

  test('.[] | (1 / .)?', () => {
    expect(parseAndQuery('.[] | (1 / .)?', [[1, 0, -1]])).toEqual([1, -1]);
  });

  test('map(abs)', () => {
    expect(parseAndQuery('map(abs)', [[-10, -1.1, -1e-1]])).toEqual([[10, 1.1, 1e-1]]);
  });

  test('.[] | length', () => {
    expect(parseAndQuery('.[] | length', [[[1, 2], 'string', { a: 2 }, null, -5]])).toEqual([
      2, 6, 1, 0, 5
    ]);
  });

  test('utf8bytelength', () => {
    expect(parseAndQuery('utf8bytelength', ['\u03bc'])).toEqual([2]);
  });

  test('keys', () => {
    expect(parseAndQuery('keys', [{ abc: 1, abcd: 2, Foo: 3 }])).toEqual([['Foo', 'abc', 'abcd']]);
  });

  test('keys', () => {
    expect(parseAndQuery('keys', [[42, 3, 35]])).toEqual([[0, 1, 2]]);
  });

  test('map(has("foo"))', () => {
    expect(parseAndQuery('map(has("foo"))', [[{ foo: 42 }, {}]])).toEqual([[true, false]]);
  });

  test('map(has(2))', () => {
    expect(
      parseAndQuery('map(has(2))', [
        [
          [0, 1],
          ['a', 'b', 'c']
        ]
      ])
    ).toEqual([[false, true]]);
  });

  test('.[] | in({"foo": 42})', () => {
    expect(parseAndQuery('.[] | in({"foo": 42})', [['foo', 'bar']])).toEqual([true, false]);
  });

  test('map(in([0,1]))', () => {
    expect(parseAndQuery('map(in([0,1]))', [[2, 0]])).toEqual([[false, true]]);
  });

  test('map(.+1)', () => {
    expect(parseAndQuery('map(.+1)', [[1, 2, 3]])).toEqual([[2, 3, 4]]);
  });

  test('map_values(.+1)', () => {
    expect(parseAndQuery('map_values(.+1)', [{ a: 1, b: 2, c: 3 }])).toEqual([
      { a: 2, b: 3, c: 4 }
    ]);
  });

  test('map(., .)', () => {
    expect(parseAndQuery('map(., .)', [[1, 2]])).toEqual([[1, 1, 2, 2]]);
  });

  test.skip('map_values(. // empty)', () => {
    expect(parseAndQuery('map_values(. // empty)', [{ a: null, b: true, c: false }])).toEqual([
      { b: true }
    ]);
  });

  test('pick(.a, .b.c, .x)', () => {
    expect(parseAndQuery('pick(.a, .b.c, .x)', [{ a: 1, b: { c: 2, d: 3 }, e: 4 }])).toEqual([
      { a: 1, b: { c: 2 }, x: undefined }
    ]);
  });

  test('pick(.[2], .[0], .[0])', () => {
    expect(parseAndQuery('pick(.[2], .[0], .[0])', [[1, 2, 3, 4]])).toEqual([[1, undefined, 3]]);
  });

  test.skip('path(.a[0].b)', () => {
    expect(parseAndQuery('path(.a[0].b)', [null])).toEqual([['a', 0, 'b']]);
  });

  test('[path(..)]', () => {
    expect(parseAndQuery('[path(..)]', [{ a: [{ b: 1 }] }])).toEqual([
      [[], ['a'], ['a', 0], ['a', 0, 'b']]
    ]);
  });

  test('del(.foo)', () => {
    expect(parseAndQuery('del(.foo)', [{ foo: 42, bar: 9001, baz: 42 }])).toEqual([
      { bar: 9001, baz: 42 }
    ]);
  });

  test('del(.[1, 2])', () => {
    expect(parseAndQuery('del(.[1, 2])', [['foo', 'bar', 'baz']])).toEqual([['foo']]);
  });

  test('getpath(["a","b"])', () => {
    expect(parseAndQuery('getpath(["a","b"])', [undefined])).toEqual([undefined]);
  });

  test('[getpath(["a","b"], ["a","c"])]', () => {
    expect(parseAndQuery('[getpath(["a","b"], ["a","c"])]', [{ a: { b: 0, c: 1 } }])).toEqual([
      [0, 1]
    ]);
  });

  test('setpath(["a","b"]; 1)', () => {
    expect(parseAndQuery('setpath(["a","b"]; 1)', [null])).toEqual([{ a: { b: 1 } }]);
  });

  test('setpath(["a","b"]; 1)', () => {
    expect(parseAndQuery('setpath(["a","b"]; 1)', [{ a: { b: 0 } }])).toEqual([{ a: { b: 1 } }]);
  });

  test.skip('setpath([0,"a"]; 1)', () => {
    expect(parseAndQuery('setpath([0,"a"]; 1)', [undefined])).toEqual([[{ a: 1 }]]);
  });

  test('delpaths([["a","b"]])', () => {
    expect(parseAndQuery('delpaths([["a","b"]])', [{ a: { b: 1 }, x: { y: 2 } }])).toEqual([
      { a: {}, x: { y: 2 } }
    ]);
  });

  test('to_entries', () => {
    expect(parseAndQuery('to_entries', [{ a: 1, b: 2 }])).toEqual([
      [
        { key: 'a', value: 1 },
        { key: 'b', value: 2 }
      ]
    ]);
  });

  test('from_entries', () => {
    expect(
      parseAndQuery('from_entries', [
        [
          { key: 'a', value: 1 },
          { key: 'b', value: 2 }
        ]
      ])
    ).toEqual([{ a: 1, b: 2 }]);
  });

  test('with_entries(.key |= "KEY_" + .)', () => {
    expect(parseAndQuery('with_entries(.key |= "KEY_" + .)', [{ a: 1, b: 2 }])).toEqual([
      { KEY_a: 1, KEY_b: 2 }
    ]);
  });

  test('map(select(. >= 2))', () => {
    expect(parseAndQuery('map(select(. >= 2))', [[1, 5, 3, 0, 7]])).toEqual([[5, 3, 7]]);
  });

  test('.[] | select(.id == "second")', () => {
    expect(
      parseAndQuery('.[] | select(.id == "second")', [
        [
          { id: 'first', val: 1 },
          { id: 'second', val: 2 }
        ]
      ])
    ).toEqual([{ id: 'second', val: 2 }]);
  });

  test('.[]|numbers', () => {
    expect(parseAndQuery('.[]|numbers', [[[], {}, 1, 'foo', null, true, false]])).toEqual([1]);
  });

  test('1, empty, 2', () => {
    expect(parseAndQuery('1, empty, 2', [null])).toEqual([1, 2]);
  });

  test('[1,2,empty,3]', () => {
    expect(parseAndQuery('[1,2,empty,3]', [null])).toEqual([[1, 2, 3]]);
  });

  test('try error catch .', () => {
    expect(parseAndQuery('try error catch .', ['error message'])).toEqual(['error message']);
  });

  test.skip('try error("invalid value: (.)") catch .', () => {
    expect(parseAndQuery('try error("invalid value: (.)") catch .', [42])).toEqual([
      'invalid value: 42'
    ]);
  });

  test.skip('try error("($__loc__)") catch .', () => {
    expect(parseAndQuery('try error("($__loc__)") catch .', [null])).toEqual([
      '{"file":"<top-level>","line":1}'
    ]);
  });

  test('[paths]', () => {
    expect(parseAndQuery('[paths]', [[1, [[], { a: 2 }]]])).toEqual([
      [[0], [1], [1, 0], [1, 1], [1, 1, 'a']]
    ]);
  });

  test.skip('[paths(type == "number")]', () => {
    expect(parseAndQuery('[paths(type == "number")]', [[1, [[], { a: 2 }]]])).toEqual([
      [[0], [1, 1, 'a']]
    ]);
  });

  test('add', () => {
    expect(parseAndQuery('add', [['a', 'b', 'c']])).toEqual(['abc']);
  });

  test('add', () => {
    expect(parseAndQuery('add', [[1, 2, 3]])).toEqual([6]);
  });

  test('add', () => {
    expect(parseAndQuery('add', [[]])).toEqual([undefined]);
  });

  test('any', () => {
    expect(parseAndQuery('any', [[true, false]])).toEqual([true]);
  });

  test('any', () => {
    expect(parseAndQuery('any', [[false, false]])).toEqual([false]);
  });

  test('any', () => {
    expect(parseAndQuery('any', [[]])).toEqual([false]);
  });

  test('all', () => {
    expect(parseAndQuery('all', [[true, false]])).toEqual([false]);
  });

  test('all', () => {
    expect(parseAndQuery('all', [[true, true]])).toEqual([true]);
  });

  test('all', () => {
    expect(parseAndQuery('all', [[]])).toEqual([true]);
  });

  test('flatten', () => {
    expect(parseAndQuery('flatten', [[1, [2], [[3]]]])).toEqual([[1, 2, 3]]);
  });

  test('flatten(1)', () => {
    expect(parseAndQuery('flatten(1)', [[1, [2], [[3]]]])).toEqual([[1, 2, [3]]]);
  });

  test('flatten', () => {
    expect(parseAndQuery('flatten', [[[]]])).toEqual([[]]);
  });

  test('flatten', () => {
    expect(parseAndQuery('flatten', [[{ foo: 'bar' }, [{ foo: 'baz' }]]])).toEqual([
      [{ foo: 'bar' }, { foo: 'baz' }]
    ]);
  });

  test('range(2; 4)', () => {
    expect(parseAndQuery('range(2; 4)', [null])).toEqual([2, 3]);
  });

  test('[range(2; 4)]', () => {
    expect(parseAndQuery('[range(2; 4)]', [null])).toEqual([[2, 3]]);
  });

  test('[range(4)]', () => {
    expect(parseAndQuery('[range(4)]', [null])).toEqual([[0, 1, 2, 3]]);
  });

  test('[range(0; 10; 3)]', () => {
    expect(parseAndQuery('[range(0; 10; 3)]', [null])).toEqual([[0, 3, 6, 9]]);
  });

  test('[range(0; 10; -1)]', () => {
    expect(parseAndQuery('[range(0; 10; -1)]', [null])).toEqual([[]]);
  });

  test('[range(0; -5; -1)]', () => {
    expect(parseAndQuery('[range(0; -5; -1)]', [null])).toEqual([[0, -1, -2, -3, -4]]);
  });

  test('floor', () => {
    expect(parseAndQuery('floor', [3.14159])).toEqual([3]);
  });

  test('sqrt', () => {
    expect(parseAndQuery('sqrt', [9])).toEqual([3]);
  });

  test('.[] | tonumber', () => {
    expect(parseAndQuery('.[] | tonumber', [[1, '1']])).toEqual([1, 1]);
  });

  test('.[] | tostring', () => {
    expect(parseAndQuery('.[] | tostring', [[1, '1', [1]]])).toEqual(['1', '1', '[1]']);
  });

  test('map(type)', () => {
    expect(parseAndQuery('map(type)', [[0, false, [], {}, null, 'hello']])).toEqual([
      ['number', 'boolean', 'array', 'object', 'null', 'string']
    ]);
  });

  test('.[] | (infinite * .) < 0', () => {
    expect(parseAndQuery('.[] | (infinite * .) < 0', [[-1, 1]])).toEqual([true, false]);
  });

  test('infinite, nan | type', () => {
    expect(parseAndQuery('infinite, nan | type', [null])).toEqual(['number', 'number']);
  });

  test('sort', () => {
    expect(parseAndQuery('sort', [[8, 3, null, 6]])).toEqual([[null, 3, 6, 8]]);
  });

  test('sort_by(.foo)', () => {
    expect(
      parseAndQuery('sort_by(.foo)', [
        [
          { foo: 4, bar: 10 },
          { foo: 3, bar: 10 },
          { foo: 2, bar: 1 }
        ]
      ])
    ).toEqual([
      [
        { foo: 2, bar: 1 },
        { foo: 3, bar: 10 },
        { foo: 4, bar: 10 }
      ]
    ]);
  });

  test('sort_by(.foo, .bar)', () => {
    expect(
      parseAndQuery('sort_by(.foo, .bar)', [
        [
          { foo: 4, bar: 10 },
          { foo: 3, bar: 20 },
          { foo: 2, bar: 1 },
          { foo: 3, bar: 10 }
        ]
      ])
    ).toEqual([
      [
        { foo: 2, bar: 1 },
        { foo: 3, bar: 10 },
        { foo: 3, bar: 20 },
        { foo: 4, bar: 10 }
      ]
    ]);
  });

  test('group_by(.foo)', () => {
    expect(
      parseAndQuery('group_by(.foo)', [
        [
          { foo: 1, bar: 10 },
          { foo: 3, bar: 100 },
          { foo: 1, bar: 1 }
        ]
      ])
    ).toEqual([
      [
        [
          { foo: 1, bar: 10 },
          { foo: 1, bar: 1 }
        ],
        [{ foo: 3, bar: 100 }]
      ]
    ]);
  });

  test('min', () => {
    expect(parseAndQuery('min', [[5, 4, 2, 7]])).toEqual([2]);
  });

  test('max_by(.foo)', () => {
    expect(
      parseAndQuery('max_by(.foo)', [
        [
          { foo: 1, bar: 14 },
          { foo: 2, bar: 3 }
        ]
      ])
    ).toEqual([{ foo: 2, bar: 3 }]);
  });

  test('unique', () => {
    expect(parseAndQuery('unique', [[1, 2, 5, 3, 5, 3, 1, 3]])).toEqual([[1, 2, 3, 5]]);
  });

  test('unique_by(.foo)', () => {
    expect(
      parseAndQuery('unique_by(.foo)', [
        [
          { foo: 1, bar: 2 },
          { foo: 1, bar: 3 },
          { foo: 4, bar: 5 }
        ]
      ])
    ).toEqual([
      [
        { foo: 1, bar: 2 },
        { foo: 4, bar: 5 }
      ]
    ]);
  });

  test('unique_by(length)', () => {
    expect(
      parseAndQuery('unique_by(length)', [['chunky', 'bacon', 'kitten', 'cicada', 'asparagus']])
    ).toEqual([['bacon', 'chunky', 'asparagus']]);
  });

  test('reverse', () => {
    expect(parseAndQuery('reverse', [[1, 2, 3, 4]])).toEqual([[4, 3, 2, 1]]);
  });

  test('contains("bar")', () => {
    expect(parseAndQuery('contains("bar")', ['foobar'])).toEqual([true]);
  });

  test('contains(["baz", "bar"])', () => {
    expect(parseAndQuery('contains(["baz", "bar"])', [['foobar', 'foobaz', 'blarp']])).toEqual([
      true
    ]);
  });

  test('contains(["bazzzzz", "bar"])', () => {
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

  test('indices(", ")', () => {
    expect(parseAndQuery('indices(", ")', ['a,b, cd, efg, hijk'])).toEqual([[3, 7, 12]]);
  });

  test('indices(1)', () => {
    expect(parseAndQuery('indices(1)', [[0, 1, 2, 1, 3, 1, 4]])).toEqual([[1, 3, 5]]);
  });

  test('indices([1,2])', () => {
    expect(parseAndQuery('indices([1,2])', [[0, 1, 2, 3, 1, 4, 2, 5, 1, 2, 6, 7]])).toEqual([
      [1, 8]
    ]);
  });

  test('index(", ")', () => {
    expect(parseAndQuery('index(", ")', ['a,b, cd, efg, hijk'])).toEqual([3]);
  });

  test('index(1)', () => {
    expect(parseAndQuery('index(1)', [[0, 1, 2, 1, 3, 1, 4]])).toEqual([1]);
  });

  test('index([1,2])', () => {
    expect(parseAndQuery('index([1,2])', [[0, 1, 2, 3, 1, 4, 2, 5, 1, 2, 6, 7]])).toEqual([1]);
  });

  test('rindex(", ")', () => {
    expect(parseAndQuery('rindex(", ")', ['a,b, cd, efg, hijk'])).toEqual([12]);
  });

  test('rindex(1)', () => {
    expect(parseAndQuery('rindex(1)', [[0, 1, 2, 1, 3, 1, 4]])).toEqual([5]);
  });

  test('rindex([1,2])', () => {
    expect(parseAndQuery('rindex([1,2])', [[0, 1, 2, 3, 1, 4, 2, 5, 1, 2, 6, 7]])).toEqual([8]);
  });

  test('inside("foobar")', () => {
    expect(parseAndQuery('inside("foobar")', ['bar'])).toEqual([true]);
  });

  test('inside(["foobar", "foobaz", "blarp"])', () => {
    expect(parseAndQuery('inside(["foobar", "foobaz", "blarp"])', [['baz', 'bar']])).toEqual([
      true
    ]);
  });

  test('inside(["foobar", "foobaz", "blarp"])', () => {
    expect(parseAndQuery('inside(["foobar", "foobaz", "blarp"])', [['bazzzzz', 'bar']])).toEqual([
      false
    ]);
  });

  test('inside({"foo": 12, "bar":[1,2,{"barp":12, "blip":13}]})', () => {
    expect(
      parseAndQuery('inside({"foo": 12, "bar":[1,2,{"barp":12, "blip":13}]})', [
        { foo: 12, bar: [{ barp: 12 }] }
      ])
    ).toEqual([true]);
  });

  test('inside({"foo": 12, "bar":[1,2,{"barp":12, "blip":13}]})', () => {
    expect(
      parseAndQuery('inside({"foo": 12, "bar":[1,2,{"barp":12, "blip":13}]})', [
        { foo: 12, bar: [{ barp: 15 }] }
      ])
    ).toEqual([false]);
  });

  test('[.[]|startswith("foo")]', () => {
    expect(
      parseAndQuery('[.[]|startswith("foo")]', [['fo', 'foo', 'barfoo', 'foobar', 'barfoob']])
    ).toEqual([[false, true, false, true, false]]);
  });

  test('[.[]|endswith("foo")]', () => {
    expect(parseAndQuery('[.[]|endswith("foo")]', [['foobar', 'barfoo']])).toEqual([[false, true]]);
  });

  test('combinations', () => {
    expect(
      parseAndQuery('combinations', [
        [
          [1, 2],
          [3, 4]
        ]
      ])
    ).toEqual([
      [1, 3],
      [1, 4],
      [2, 3],
      [2, 4]
    ]);
  });

  test('combinations(2)', () => {
    expect(parseAndQuery('combinations(2)', [[0, 1]])).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1]
    ]);
  });

  test('[.[]|ltrimstr("foo")]', () => {
    expect(
      parseAndQuery('[.[]|ltrimstr("foo")]', [['fo', 'foo', 'barfoo', 'foobar', 'afoo']])
    ).toEqual([['fo', '', 'barfoo', 'bar', 'afoo']]);
  });

  test('[.[]|rtrimstr("foo")]', () => {
    expect(
      parseAndQuery('[.[]|rtrimstr("foo")]', [['fo', 'foo', 'barfoo', 'foobar', 'foob']])
    ).toEqual([['fo', '', 'bar', 'foobar', 'foob']]);
  });

  test('explode', () => {
    expect(parseAndQuery('explode', ['foobar'])).toEqual([[102, 111, 111, 98, 97, 114]]);
  });

  test('implode', () => {
    expect(parseAndQuery('implode', [[65, 66, 67]])).toEqual(['ABC']);
  });

  test('join(", ")', () => {
    expect(parseAndQuery('join(", ")', [['a', 'b,c,d', 'e']])).toEqual(['a, b,c,d, e']);
  });

  test('join(" ")', () => {
    expect(parseAndQuery('join(" ")', [['a', 1, 2.3, true, null, false]])).toEqual([
      'a 1 2.3 true  false'
    ]);
  });

  test.skip('ascii_upcase', () => {
    expect(parseAndQuery('ascii_upcase', ['useful but not for é'])).toEqual([
      'USEFUL BUT NOT FOR é'
    ]);
  });

  test('[while(.<100; .*2)]', () => {
    expect(parseAndQuery('[while(.<100; .*2)]', [1])).toEqual([[1, 2, 4, 8, 16, 32, 64]]);
  });

  test.skip('[repeat(.*2, error)?]', () => {
    expect(parseAndQuery('[repeat(.*2, error)?]', [1])).toEqual([[2]]);
  });

  test('[.,1]|until(.[0] < 1; [.[0] - 1, .[1] * .[0]])|.[1]', () => {
    expect(parseAndQuery('[.,1]|until(.[0] < 1; [.[0] - 1, .[1] * .[0]])|.[1]', [4])).toEqual([24]);
  });

  test('recurse(.foo[])', () => {
    expect(
      parseAndQuery('recurse(.foo[])', [{ foo: [{ foo: [] }, { foo: [{ foo: [] }] }] }])
    ).toEqual([
      { foo: [{ foo: [] }, { foo: [{ foo: [] }] }] },
      { foo: [] },
      { foo: [{ foo: [] }] },
      { foo: [] }
    ]);
  });

  test('recurse', () => {
    expect(parseAndQuery('recurse', [{ a: 0, b: [1] }])).toEqual([{ a: 0, b: [1] }, 0, [1], 1]);
  });

  test('recurse(. * .; . < 20)', () => {
    expect(parseAndQuery('recurse(. * .; . < 20)', [2])).toEqual([2, 4, 16]);
  });

  test('walk(if type == "array" then sort else . end)', () => {
    expect(
      parseAndQuery('walk(if type == "array" then sort else . end)', [
        [
          [4, 1, 7],
          [8, 5, 2],
          [3, 6, 9]
        ]
      ])
    ).toEqual([
      [
        [1, 4, 7],
        [2, 5, 8],
        [3, 6, 9]
      ]
    ]);
  });

  test.skip('$ENV.PAGER', () => {
    expect(parseAndQuery('$ENV.PAGER', [null])).toEqual(['less']);
  });

  test.skip('env.PAGER', () => {
    expect(parseAndQuery('env.PAGER', [null])).toEqual(['less']);
  });

  test('transpose', () => {
    expect(parseAndQuery('transpose', [[[1], [2, 3]]])).toEqual([
      [
        [1, 2],
        [undefined, 3]
      ]
    ]);
  });

  test.skip('bsearch(0)', () => {
    expect(parseAndQuery('bsearch(0)', [[0, 1]])).toEqual([0]);
  });

  test.skip('bsearch(0)', () => {
    expect(parseAndQuery('bsearch(0)', [[1, 2, 3]])).toEqual([-1]);
  });

  test.skip('bsearch(4) as $ix | if $ix < 0 then .[-(1+$ix)] = 4 else . end', () => {
    expect(
      parseAndQuery('bsearch(4) as $ix | if $ix < 0 then .[-(1+$ix)] = 4 else . end', [[1, 2, 3]])
    ).toEqual([[1, 2, 3, 4]]);
  });

  test('"The input was \\(.), which is one less than \\(.+1)"', () => {
    expect(parseAndQuery('"The input was \\(.), which is one less than \\(.+1)"', [42])).toEqual([
      'The input was 42, which is one less than 43'
    ]);
  });

  test('[.[]|tostring]', () => {
    expect(parseAndQuery('[.[]|tostring]', [[1, 'foo', ['foo']]])).toEqual([
      ['1', 'foo', '["foo"]']
    ]);
  });

  test('[.[]|tojson]', () => {
    expect(parseAndQuery('[.[]|tojson]', [[1, 'foo', ['foo']]])).toEqual([
      ['1', '"foo"', '["foo"]']
    ]);
  });

  test('[.[]|tojson|fromjson]', () => {
    expect(parseAndQuery('[.[]|tojson|fromjson]', [[1, 'foo', ['foo']]])).toEqual([
      [1, 'foo', ['foo']]
    ]);
  });

  test.skip('@html', () => {
    expect(parseAndQuery('@html', ['This works if x < y'])).toEqual(['This works if x &lt; y']);
  });

  test.skip('@sh "echo (.)"', () => {
    expect(parseAndQuery('@sh "echo (.)"', ["O'Hara's Ale"])).toEqual([
      "echo 'O'\\''Hara'\\''s Ale'"
    ]);
  });

  test.skip('@base64', () => {
    expect(parseAndQuery('@base64', ['This is a message'])).toEqual(['VGhpcyBpcyBhIG1lc3NhZ2U=']);
  });

  test.skip('@base64d', () => {
    expect(parseAndQuery('@base64d', ['VGhpcyBpcyBhIG1lc3NhZ2U='])).toEqual(['This is a message']);
  });

  test.skip('fromdate', () => {
    expect(parseAndQuery('fromdate', ['2015-03-05T23:51:47Z'])).toEqual([1425599507]);
  });

  test.skip('strptime("%Y-%m-%dT%H:%M:%SZ")', () => {
    expect(parseAndQuery('strptime("%Y-%m-%dT%H:%M:%SZ")', ['2015-03-05T23:51:47Z'])).toEqual([
      [2015, 2, 5, 23, 51, 47, 4, 63]
    ]);
  });

  test.skip('strptime("%Y-%m-%dT%H:%M:%SZ")|mktime', () => {
    expect(
      parseAndQuery('strptime("%Y-%m-%dT%H:%M:%SZ")|mktime', ['2015-03-05T23:51:47Z'])
    ).toEqual([1425599507]);
  });

  test('. == false', () => {
    expect(parseAndQuery('. == false', [null])).toEqual([false]);
  });

  test.skip('. == {"b": {"d": (4 + 1e-20), "c": 3}, "a":1}', () => {
    expect(
      parseAndQuery('. == {"b": {"d": (4 + 1e-20), "c": 3}, "a":1}', [{ a: 1, b: { c: 3, d: 4 } }])
    ).toEqual([true]);
  });

  test('.[] == 1', () => {
    expect(parseAndQuery('.[] == 1', [[1, 1.0, '1', 'banana']])).toEqual([
      true,
      true,
      false,
      false
    ]);
  });

  test('if . == 0 then   "zero" elif . == 1 then   "one" else   "many" end', () => {
    expect(
      parseAndQuery('if . == 0 then   "zero" elif . == 1 then   "one" else   "many" end', [2])
    ).toEqual(['many']);
  });

  test('. < 5', () => {
    expect(parseAndQuery('. < 5', [2])).toEqual([true]);
  });

  test('42 and "a string"', () => {
    expect(parseAndQuery('42 and "a string"', [null])).toEqual([true]);
  });

  test('(true, false) or false', () => {
    expect(parseAndQuery('(true, false) or false', [null])).toEqual([true, false]);
  });

  test.skip('(true, true) and (true, false)', () => {
    expect(parseAndQuery('(true, true) and (true, false)', [null])).toEqual([
      true,
      false,
      true,
      false
    ]);
  });

  test('[true, false | not]', () => {
    expect(parseAndQuery('[true, false | not]', [null])).toEqual([[false, true]]);
  });

  test('empty // 42', () => {
    expect(parseAndQuery('empty // 42', [null])).toEqual([42]);
  });

  test('.foo // 42', () => {
    expect(parseAndQuery('.foo // 42', [{ foo: 19 }])).toEqual([19]);
  });

  test('.foo // 42', () => {
    expect(parseAndQuery('.foo // 42', [{}])).toEqual([42]);
  });

  test('(false, null, 1) // 42', () => {
    expect(parseAndQuery('(false, null, 1) // 42', [null])).toEqual([1]);
  });

  test('(false, null, 1) | . // 42', () => {
    expect(parseAndQuery('(false, null, 1) | . // 42', [null])).toEqual([42, 42, 1]);
  });

  test('try .a catch ". is not an object"', () => {
    expect(parseAndQuery('try .a catch ". is not an object"', [true])).toEqual([
      '. is not an object'
    ]);
  });

  test('[.[]|try .a]', () => {
    expect(parseAndQuery('[.[]|try .a]', [[{}, true, { a: 1 }]])).toEqual([[undefined, 1]]);
  });

  test('try error("some exception") catch .', () => {
    expect(parseAndQuery('try error("some exception") catch .', [true])).toEqual([
      'some exception'
    ]);
  });

  test('[.[] | .a?]', () => {
    expect(parseAndQuery('[.[] | .a?]', [[{}, true, { a: 1 }]])).toEqual([[undefined, 1]]);
  });

  test.skip('[.[] | tonumber?]', () => {
    expect(parseAndQuery('[.[] | tonumber?]', [['1', 'invalid', '3', 4]])).toEqual([[1, 3, 4]]);
  });

  test('.bar as $x | .foo | . + $x', () => {
    expect(parseAndQuery('.bar as $x | .foo | . + $x', [{ foo: 10, bar: 200 }])).toEqual([210]);
  });

  test('. as $i|[(.*2|. as $i| $i), $i]', () => {
    expect(parseAndQuery('. as $i|[(.*2|. as $i| $i), $i]', [5])).toEqual([[10, 5]]);
  });

  test('. as [$a, $b, {c: $c}] | $a + $b + $c', () => {
    expect(
      parseAndQuery('. as [$a, $b, {c: $c}] | $a + $b + $c', [[2, 3, { c: 4, d: 5 }]])
    ).toEqual([9]);
  });

  test('.[] as [$a, $b] | {a: $a, b: $b}', () => {
    expect(parseAndQuery('.[] as [$a, $b] | {a: $a, b: $b}', [[[0], [0, 1], [2, 1, 0]]])).toEqual([
      { a: 0, b: undefined },
      { a: 0, b: 1 },
      { a: 2, b: 1 }
    ]);
  });

  test.skip('.[] as {$a, $b, c: {$d, $e}} ?// {$a, $b, c: [{$d, $e}]} | {$a, $b, $d, $e}', () => {
    expect(
      parseAndQuery('.[] as {$a, $b, c: {$d, $e}} ?// {$a, $b, c: [{$d, $e}]} | {$a, $b, $d, $e}', [
        [
          { a: 1, b: 2, c: { d: 3, e: 4 } },
          { a: 1, b: 2, c: [{ d: 3, e: 4 }] }
        ]
      ])
    ).toEqual([
      { a: 1, b: 2, d: 3, e: 4 },
      { a: 1, b: 2, d: 3, e: 4 }
    ]);
  });

  test.skip('.[] as {$a, $b, c: {$d}} ?// {$a, $b, c: [{$e}]} | {$a, $b, $d, $e}', () => {
    expect(
      parseAndQuery('.[] as {$a, $b, c: {$d}} ?// {$a, $b, c: [{$e}]} | {$a, $b, $d, $e}', [
        [
          { a: 1, b: 2, c: { d: 3, e: 4 } },
          { a: 1, b: 2, c: [{ d: 3, e: 4 }] }
        ]
      ])
    ).toEqual([
      { a: 1, b: 2, d: 3, e: null },
      { a: 1, b: 2, d: null, e: 4 }
    ]);
  });

  test.skip('.[] as [$a] ?// [$b] | if $a != null then error("err: ($a)") else {$a,$b} end', () => {
    expect(
      parseAndQuery(
        '.[] as [$a] ?// [$b] | if $a != null then error("err: ($a)") else {$a,$b} end',
        [[[3]]]
      )
    ).toEqual([{ a: null, b: 3 }]);
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

  test('def addvalue(f): f as $x | map(. + $x); addvalue(.[0])', () => {
    expect(
      parseAndQuery('def addvalue(f): f as $x | map(. + $x); addvalue(.[0])', [
        [
          [1, 2],
          [10, 20]
        ]
      ])
    ).toEqual([
      [
        [1, 2, 1, 2],
        [10, 20, 1, 2]
      ]
    ]);
  });

  test('isempty(empty)', () => {
    expect(parseAndQuery('isempty(empty)', [null])).toEqual([true]);
  });

  test('isempty(.[])', () => {
    expect(parseAndQuery('isempty(.[])', [[]])).toEqual([true]);
  });

  test('isempty(.[])', () => {
    expect(parseAndQuery('isempty(.[])', [[1, 2, 3]])).toEqual([false]);
  });

  test('[limit(3;.[])]', () => {
    expect(parseAndQuery('[limit(3;.[])]', [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]])).toEqual([[0, 1, 2]]);
  });

  test('[first(range(.)), last(range(.)), nth(./2; range(.))]', () => {
    expect(parseAndQuery('[first(range(.)), last(range(.)), nth(./2; range(.))]', [10])).toEqual([
      [0, 9, 5]
    ]);
  });

  test('[range(.)]|[first, last, nth(5)]', () => {
    expect(parseAndQuery('[range(.)]|[first, last, nth(5)]', [10])).toEqual([[0, 9, 5]]);
  });

  test('reduce .[] as $item (0; . + $item)', () => {
    expect(parseAndQuery('reduce .[] as $item (0; . + $item)', [[1, 2, 3, 4, 5]])).toEqual([15]);
  });

  test('reduce .[] as [$i,$j] (0; . + $i * $j)', () => {
    expect(
      parseAndQuery('reduce .[] as [$i,$j] (0; . + $i * $j)', [
        [
          [1, 2],
          [3, 4],
          [5, 6]
        ]
      ])
    ).toEqual([44]);
  });

  test.skip('reduce .[] as {$x,$y} (null; .x += $x | .y += [$y])', () => {
    expect(
      parseAndQuery('reduce .[] as {$x,$y} (null; .x += $x | .y += [$y])', [
        [
          { x: 'a', y: 1 },
          { x: 'b', y: 2 },
          { x: 'c', y: 3 }
        ]
      ])
    ).toEqual([{ x: 'abc', y: [1, 2, 3] }]);
  });

  test('foreach .[] as $item (0; . + $item)', () => {
    expect(parseAndQuery('foreach .[] as $item (0; . + $item)', [[1, 2, 3, 4, 5]])).toEqual([
      1, 3, 6, 10, 15
    ]);
  });

  test('foreach .[] as $item (0; . + $item; [$item, . * 2])', () => {
    expect(
      parseAndQuery('foreach .[] as $item (0; . + $item; [$item, . * 2])', [[1, 2, 3, 4, 5]])
    ).toEqual([
      [1, 2],
      [2, 6],
      [3, 12],
      [4, 20],
      [5, 30]
    ]);
  });

  test('foreach .[] as $item (0; . + 1; {index: ., $item})', () => {
    expect(
      parseAndQuery('foreach .[] as $item (0; . + 1; {index: ., $item})', [['foo', 'bar', 'baz']])
    ).toEqual([
      { index: 1, item: 'foo' },
      { index: 2, item: 'bar' },
      { index: 3, item: 'baz' }
    ]);
  });

  test('def range(init; upto; by): def _range: if (by > 0 and . < upto) or (by < 0 and . > upto) then ., ((.+by)|_range) else . end; if by == 0 then init else init|_range end | select((by > 0 and . < upto) or (by < 0 and . > upto)); range(0; 10; 3)', () => {
    expect(
      parseAndQuery(
        'def range(init; upto; by): def _range: if (by > 0 and . < upto) or (by < 0 and . > upto) then ., ((.+by)|_range) else . end; if by == 0 then init else init|_range end | select((by > 0 and . < upto) or (by < 0 and . > upto)); range(0; 10; 3)',
        [null]
      )
    ).toEqual([0, 3, 6, 9]);
  });

  test('def while(cond; update): def _while: if cond then ., (update | _while) else empty end; _while; [while(.<100; .*2)]', () => {
    expect(
      parseAndQuery(
        'def while(cond; update): def _while: if cond then ., (update | _while) else empty end; _while; [while(.<100; .*2)]',
        [1]
      )
    ).toEqual([[1, 2, 4, 8, 16, 32, 64]]);
  });

  test.skip('truncate_stream([[0],1],[[1,0],2],[[1,0]],[[1]])', () => {
    expect(parseAndQuery('truncate_stream([[0],1],[[1,0],2],[[1,0]],[[1]])', [1])).toEqual([
      [[0], 2],
      [[0]]
    ]);
  });

  test.skip('fromstream(1|truncate_stream([[0],1],[[1,0],2],[[1,0]],[[1]]))', () => {
    expect(
      parseAndQuery('fromstream(1|truncate_stream([[0],1],[[1,0],2],[[1,0]],[[1]]))', [null])
    ).toEqual([[2]]);
  });

  test.skip('. as $dot|fromstream($dot|tostream)|.==$dot', () => {
    expect(
      parseAndQuery('. as $dot|fromstream($dot|tostream)|.==$dot', [[0, [1, { a: 1 }, { b: 2 }]]])
    ).toEqual([true]);
  });

  test('(..|select(type=="boolean")) |= if . then 1 else 0 end', () => {
    expect(
      parseAndQuery('(..|select(type=="boolean")) |= if . then 1 else 0 end', [
        [true, false, [5, true, [true, [false]], false]]
      ])
    ).toEqual([[1, 0, [5, 1, [1, [0]], 0]]]);
  });

  test('.foo += 1', () => {
    expect(parseAndQuery('.foo += 1', [{ foo: 42 }])).toEqual([{ foo: 43 }]);
  });

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
});
