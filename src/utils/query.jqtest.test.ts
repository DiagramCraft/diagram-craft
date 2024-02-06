import { describe, expect, test } from 'vitest';
import { parseAndQuery } from './query.ts';

// See https://github.com/jqlang/jq/blob/master/tests/jq.test

describe('jqtest', () => {
  test('true', () => {
    expect(parseAndQuery('true', [undefined])).toEqual([true]);
  });

  test('false', () => {
    expect(parseAndQuery('false', [undefined])).toEqual([false]);
  });

  test('null', () => {
    expect(parseAndQuery('null', [undefined])).toEqual([null]);
  });

  test('1', () => {
    expect(parseAndQuery('1', [undefined])).toEqual([1]);
  });

  test('-1', () => {
    expect(parseAndQuery('-1', [undefined])).toEqual([-1]);
  });

  test('{}', () => {
    expect(parseAndQuery('{}', [undefined])).toEqual([{}]);
  });

  test('[]', () => {
    expect(parseAndQuery('[]', [undefined])).toEqual([[]]);
  });

  test('{x: -1}', () => {
    expect(parseAndQuery('{x: -1}', [undefined])).toEqual([{ x: -1 }]);
  });

  // TODO: Fix
  test.skip('"inter\\("pol" + "ation")"', () => {
    expect(parseAndQuery('"inter\\("pol" + "ation")"', [undefined])).toEqual(['interpolation']);
  });

  test('{a: 1}', () => {
    expect(parseAndQuery('{a: 1}', [undefined])).toEqual([{ a: 1 }]);
  });

  test('{a,b,(.d):.a,e:.b}', () => {
    expect(parseAndQuery('{a,b,(.d):.a,e:.b}', [{ a: 1, b: 2, d: 'c' }])).toEqual([
      { a: 1, b: 2, c: 1, e: 2 }
    ]);
  });

  test('.foo', () => {
    expect(parseAndQuery('.foo', [{ foo: 42, bar: 43 }])).toEqual([42]);
  });

  test('.foo | .bar', () => {
    expect(parseAndQuery('.foo | .bar', [{ foo: { bar: 42 }, bar: 'badvalue' }])).toEqual([42]);
  });

  test('.foo.bar', () => {
    expect(parseAndQuery('.foo.bar', [{ foo: { bar: 42 }, bar: 'badvalue' }])).toEqual([42]);
  });

  test('.foo_bar', () => {
    expect(parseAndQuery('.foo_bar', [{ foo_bar: 2 }])).toEqual([2]);
  });

  test('.["foo"].bar', () => {
    expect(parseAndQuery('.["foo"].bar', [{ foo: { bar: 42 }, bar: 'badvalue' }])).toEqual([42]);
  });

  test('."foo"."bar"', () => {
    expect(parseAndQuery('."foo"."bar"', [{ foo: { bar: 42 }, bar: 'badvalue' }])).toEqual([42]);
  });

  // TODO: Note the original test used (.e0, .E1, .E-1, .E+1)
  test('.e0, .E1, .E - 1, .E + 1', () => {
    expect(parseAndQuery('.e0, .E1, .E - 1, .E + 1', [{ e0: 1, E1: 2, E: 3 }])).toEqual([
      1, 2, 2, 4
    ]);
  });

  test('[.[]|.foo?]', () => {
    expect(parseAndQuery('[.[]|.foo?]', [[1, [2], { foo: 3, bar: 4 }, {}, { foo: 5 }]])).toEqual([
      [3, undefined, 5]
    ]);
  });

  test('[.[]|.foo?.bar?]', () => {
    expect(
      parseAndQuery('[.[]|.foo?.bar?]', [[1, [2], [], { foo: 3 }, { foo: { bar: 4 } }, {}]])
    ).toEqual([[4, undefined]]);
  });

  test('[..]', () => {
    expect(parseAndQuery('[..]', [[1, [[2]], { a: [1] }]])).toEqual([
      [[1, [[2]], { a: [1] }], 1, [[2]], [2], 2, { a: [1] }, [1], 1]
    ]);
  });

  test('.[]', () => {
    expect(parseAndQuery('.[]', [[1, 2, 3]])).toEqual([1, 2, 3]);
  });

  test('1,1', () => {
    expect(parseAndQuery('1,1', [[]])).toEqual([1, 1]);
  });

  test('1,.', () => {
    expect(parseAndQuery('1,.', [[]])).toEqual([1, []]);
  });

  test('[.]', () => {
    expect(parseAndQuery('[.]', [[2]])).toEqual([[[2]]]);
  });

  test('[[2]]', () => {
    expect(parseAndQuery('[[2]]', [[3]])).toEqual([[[2]]]);
  });

  test('[{}]', () => {
    expect(parseAndQuery('[{}]', [[]])).toEqual([[{}]]);
  });

  test('[.[]]', () => {
    expect(parseAndQuery('[.[]]', [['a']])).toEqual([['a']]);
  });

  test('[(.,1),((.,.[]),(2,3))]', () => {
    expect(parseAndQuery('[(.,1),((.,.[]),(2,3))]', [['a', 'b']])).toEqual([
      [['a', 'b'], 1, ['a', 'b'], 'a', 'b', 2, 3]
    ]);
  });

  // TODO: Fix
  test.skip('[([5,5][]),.,.[]]', () => {
    expect(parseAndQuery('[([5,5][]),.,.[]]', [[1, 2, 3]])).toEqual([[5, 5, [1, 2, 3], 1, 2, 3]]);
  });

  // TODO: Fix
  test.skip('{x: (1,2)},{x:3} | .x', () => {
    expect(parseAndQuery('{x: (1,2)},{x:3} | .x', [undefined])).toEqual([1, 2, 3]);
  });

  test('[.[-4,-3,-2,-1,0,1,2,3]]', () => {
    expect(parseAndQuery('[.[-4,-3,-2,-1,0,1,2,3]]', [[1, 2, 3]])).toEqual([
      [undefined, 1, 2, 3, 1, 2, 3, undefined]
    ]);
  });

  test('[range(0;10)]', () => {
    expect(parseAndQuery('[range(0;10)]', [[]])).toEqual([[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]]);
  });

  test('[range(0,1;3,4)]', () => {
    expect(parseAndQuery('[range(0,1;3,4)]', [[]])).toEqual([[0, 1, 2, 0, 1, 2, 3, 1, 2, 1, 2, 3]]);
  });

  test('[range(0;10;3)]', () => {
    expect(parseAndQuery('[range(0;10;3)]', [[]])).toEqual([[0, 3, 6, 9]]);
  });

  test('[range(0;10;-1)]', () => {
    expect(parseAndQuery('[range(0;10;-1)]', [[]])).toEqual([[]]);
  });

  test('[range(0;-5;-1)]', () => {
    expect(parseAndQuery('[range(0;-5;-1)]', [[]])).toEqual([[0, -1, -2, -3, -4]]);
  });

  test('[range(0,1;4,5;1,2)]', () => {
    expect(parseAndQuery('[range(0,1;4,5;1,2)]', [[]])).toEqual([
      [0, 1, 2, 3, 0, 2, 0, 1, 2, 3, 4, 0, 2, 4, 1, 2, 3, 1, 3, 1, 2, 3, 4, 1, 3]
    ]);
  });

  test('[limit(3; .[])]', () => {
    expect(parseAndQuery('[limit(3; .[])]', [[11, 22, 33, 44, 55, 66, 77, 88, 99]])).toEqual([
      [11, 22, 33]
    ]);
  });

  test('[limit(5,7; range(9))]', () => {
    expect(parseAndQuery('[limit(5,7; range(9))]', [undefined])).toEqual([
      [0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 5, 6]
    ]);
  });

  test('[nth(5,7; range(9;0;-1))]', () => {
    expect(parseAndQuery('[nth(5,7; range(9;0;-1))]', [undefined])).toEqual([[4, 2]]);
  });

  test('[range(0,1,2;4,3,2;2,3)]', () => {
    expect(parseAndQuery('[range(0,1,2;4,3,2;2,3)]', [undefined])).toEqual([
      [0, 2, 0, 3, 0, 2, 0, 0, 0, 1, 3, 1, 1, 1, 1, 1, 2, 2, 2, 2]
    ]);
  });

  test('[range(3,5)]', () => {
    expect(parseAndQuery('[range(3,5)]', [undefined])).toEqual([[0, 1, 2, 0, 1, 2, 3, 4]]);
  });

  test('join(",","/")', () => {
    expect(parseAndQuery('join(",","/")', [['a', 'b', 'c', 'd']])).toEqual(['a,b,c,d', 'a/b/c/d']);
  });

  test('[.[]|join("a")]', () => {
    expect(parseAndQuery('[.[]|join("a")]', [[[], [''], ['', ''], ['', '', '']]])).toEqual([
      ['', '', 'a', 'aa']
    ]);
  });

  test('1 as $x | 2 as $y | [$x,$y,$x]', () => {
    expect(parseAndQuery('1 as $x | 2 as $y | [$x,$y,$x]', [undefined])).toEqual([[1, 2, 1]]);
  });

  test('42 as $x | . | . | . + 432 | $x + 1', () => {
    expect(parseAndQuery('42 as $x | . | . | . + 432 | $x + 1', [34324])).toEqual([43]);
  });

  test('1 as $x | [$x,$x,$x as $x | $x]', () => {
    expect(parseAndQuery('1 as $x | [$x,$x,$x as $x | $x]', [undefined])).toEqual([[1, 1, 1]]);
  });

  test('1 + 1', () => {
    expect(parseAndQuery('1 + 1', [undefined])).toEqual([2]);
  });

  test('1 + 1', () => {
    expect(parseAndQuery('1 + 1', ['wtasdf'])).toEqual([2]);
  });

  test('2 - 1', () => {
    expect(parseAndQuery('2 - 1', [undefined])).toEqual([1]);
  });

  test('2-(-1)', () => {
    expect(parseAndQuery('2-(-1)', [undefined])).toEqual([3]);
  });

  test('.+4', () => {
    expect(parseAndQuery('.+4', [15])).toEqual([19]);
  });

  test('.+null', () => {
    expect(parseAndQuery('.+null', [{ a: 42 }])).toEqual([{ a: 42 }]);
  });

  // TODO: Fix
  test.skip('null+.', () => {
    expect(parseAndQuery('null+.', [undefined])).toEqual([undefined]);
  });

  test('.a+.b', () => {
    expect(parseAndQuery('.a+.b', [{ a: 42 }])).toEqual([42]);
  });

  test('[1,2,3] + [.]', () => {
    expect(parseAndQuery('[1,2,3] + [.]', [undefined])).toEqual([[1, 2, 3, undefined]]);
  });

  test('{"a":1} + {"b":2} + {"c":3}', () => {
    expect(parseAndQuery('{"a":1} + {"b":2} + {"c":3}', [undefined])).toEqual([
      { a: 1, b: 2, c: 3 }
    ]);
  });

  test('"asdf" + "jkl;" + . + . + .', () => {
    expect(parseAndQuery('"asdf" + "jkl;" + . + . + .', ['some string'])).toEqual([
      'asdfjkl;some stringsome stringsome string'
    ]);
  });

  test('42 - .', () => {
    expect(parseAndQuery('42 - .', [11])).toEqual([31]);
  });

  test('[1,2,3,4,1] - [.,3]', () => {
    expect(parseAndQuery('[1,2,3,4,1] - [.,3]', [1])).toEqual([[2, 4]]);
  });

  test('[10 * 20, 20 / .]', () => {
    expect(parseAndQuery('[10 * 20, 20 / .]', [4])).toEqual([[200, 5]]);
  });

  test('1 + 2 * 2 + 10 / 2', () => {
    expect(parseAndQuery('1 + 2 * 2 + 10 / 2', [undefined])).toEqual([10]);
  });

  test('[16 / 4 / 2, 16 / 4 * 2, 16 - 4 - 2, 16 - 4 + 2]', () => {
    expect(parseAndQuery('[16 / 4 / 2, 16 / 4 * 2, 16 - 4 - 2, 16 - 4 + 2]', [undefined])).toEqual([
      [2, 8, 10, 14]
    ]);
  });

  test('25 % 7', () => {
    expect(parseAndQuery('25 % 7', [undefined])).toEqual([4]);
  });

  test('49732 % 472', () => {
    expect(parseAndQuery('49732 % 472', [undefined])).toEqual([172]);
  });

  test('[.[] | length]', () => {
    expect(
      parseAndQuery('[.[] | length]', [[[], {}, [1, 2], { a: 42 }, 'asdf', '\u03bc']])
    ).toEqual([[0, 0, 2, 1, 4, 1]]);
  });

  test('map(keys)', () => {
    expect(
      parseAndQuery('map(keys)', [[{}, { abcd: 1, abc: 2, abcde: 3 }, { x: 1, z: 3, y: 2 }]])
    ).toEqual([[[], ['abc', 'abcd', 'abcde'], ['x', 'y', 'z']]]);
  });

  test('[1,2,empty,3,empty,4]', () => {
    expect(parseAndQuery('[1,2,empty,3,empty,4]', [undefined])).toEqual([[1, 2, 3, 4]]);
  });

  test('map(add)', () => {
    expect(
      parseAndQuery('map(add)', [
        [[], [1, 2, 3], ['a', 'b', 'c'], [[3], [4, 5], [6]], [{ a: 1 }, { b: 2 }, { a: 3 }]]
      ])
    ).toEqual([[undefined, 6, 'abc', [3, 4, 5, 6], { a: 3, b: 2 }]]);
  });

  test('map_values(.+1)', () => {
    expect(parseAndQuery('map_values(.+1)', [[0, 1, 2]])).toEqual([[1, 2, 3]]);
  });

  // TODO: Fix
  test.skip('def f: . + 1; def g: def g: . + 100; f | g | f; (f | g), g', () => {
    expect(
      parseAndQuery('def f: . + 1; def g: def g: . + 100; f | g | f; (f | g), g', [3])
    ).toEqual([106, 105]);
  });

  test('def f: (1000,2000); f', () => {
    expect(parseAndQuery('def f: (1000,2000); f', [123412345])).toEqual([1000, 2000]);
  });

  test('def f(a;b;c;d;e;f): [a+1,b,c,d,e,f]; f(.[0];.[1];.[0];.[0];.[0];.[0])', () => {
    expect(
      parseAndQuery('def f(a;b;c;d;e;f): [a+1,b,c,d,e,f]; f(.[0];.[1];.[0];.[0];.[0];.[0])', [
        [1, 2]
      ])
    ).toEqual([[2, 2, 1, 1, 1, 1]]);
  });

  // TODO: Fix
  test.skip('def f: 1; def g: f, def f: 2; def g: 3; f, def f: g; f, g; def f: 4; [f, def f: g; def g: 5; f, g]+[f,g]', () => {
    expect(
      parseAndQuery(
        'def f: 1; def g: f, def f: 2; def g: 3; f, def f: g; f, g; def f: 4; [f, def f: g; def g: 5; f, g]+[f,g]',
        [undefined]
      )
    ).toEqual([[4, 1, 2, 3, 3, 5, 4, 1, 2, 3, 3]]);
  });

  test('def a: 0; . | a', () => {
    expect(parseAndQuery('def a: 0; . | a', [undefined])).toEqual([0]);
  });

  test('def f(a;b;c;d;e;f;g;h;i;j): [j,i,h,g,f,e,d,c,b,a]; f(.[0];.[1];.[2];.[3];.[4];.[5];.[6];.[7];.[8];.[9])', () => {
    expect(
      parseAndQuery(
        'def f(a;b;c;d;e;f;g;h;i;j): [j,i,h,g,f,e,d,c,b,a]; f(.[0];.[1];.[2];.[3];.[4];.[5];.[6];.[7];.[8];.[9])',
        [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]]
      )
    ).toEqual([[9, 8, 7, 6, 5, 4, 3, 2, 1, 0]]);
  });

  test('([1,2] + [4,5])', () => {
    expect(parseAndQuery('([1,2] + [4,5])', [undefined])).toEqual([[1, 2, 4, 5]]);
  });

  test('true', () => {
    expect(parseAndQuery('true', [[1]])).toEqual([true]);
  });

  test('null,1,null', () => {
    expect(parseAndQuery('null,1,null', ['hello'])).toEqual([null, 1, null]);
  });

  test('[1,2,3]', () => {
    expect(parseAndQuery('[1,2,3]', [[5, 6]])).toEqual([[1, 2, 3]]);
  });

  test('[.[]|floor]', () => {
    expect(parseAndQuery('[.[]|floor]', [[-1.1, 1.1, 1.9]])).toEqual([[-2, 1, 1]]);
  });

  test('[.[]|sqrt]', () => {
    expect(parseAndQuery('[.[]|sqrt]', [[4, 9]])).toEqual([[2, 3]]);
  });

  test('(add / length) as $m | map((. - $m) as $d | $d * $d) | add / length | sqrt', () => {
    expect(
      parseAndQuery('(add / length) as $m | map((. - $m) as $d | $d * $d) | add / length | sqrt', [
        [2, 4, 4, 4, 5, 5, 7, 9]
      ])
    ).toEqual([2]);
  });

  test('atan * 4 * 1000000|floor / 1000000', () => {
    expect(parseAndQuery('atan * 4 * 1000000|floor / 1000000', [1])).toEqual([3.141592]);
  });

  test('[(3.141592 / 2) * (range(0;20) / 20)|cos * 1000000|floor / 1000000]', () => {
    expect(
      parseAndQuery('[(3.141592 / 2) * (range(0;20) / 20)|cos * 1000000|floor / 1000000]', [
        undefined
      ])
    ).toEqual([
      [
        1, 0.996917, 0.987688, 0.972369, 0.951056, 0.923879, 0.891006, 0.85264, 0.809017, 0.760406,
        0.707106, 0.649448, 0.587785, 0.522498, 0.45399, 0.382683, 0.309017, 0.233445, 0.156434,
        0.078459
      ]
    ]);
  });

  test('[(3.141592 / 2) * (range(0;20) / 20)|sin * 1000000|floor / 1000000]', () => {
    expect(
      parseAndQuery('[(3.141592 / 2) * (range(0;20) / 20)|sin * 1000000|floor / 1000000]', [
        undefined
      ])
    ).toEqual([
      [
        0, 0.078459, 0.156434, 0.233445, 0.309016, 0.382683, 0.45399, 0.522498, 0.587785, 0.649447,
        0.707106, 0.760405, 0.809016, 0.85264, 0.891006, 0.923879, 0.951056, 0.972369, 0.987688,
        0.996917
      ]
    ]);
  });

  test('def f(x): x | x; f([.], . + [42])', () => {
    expect(parseAndQuery('def f(x): x | x; f([.], . + [42])', [[1, 2, 3]])).toEqual([
      [[[1, 2, 3]]],
      [[1, 2, 3], 42],
      [[1, 2, 3, 42]],
      [1, 2, 3, 42, 42]
    ]);
  });

  // TODO: Fix
  test.skip('def f: .+1; def g: f; def f: .+100; def f(a):a+.+11; [(g|f(20)), f]', () => {
    expect(
      parseAndQuery('def f: .+1; def g: f; def f: .+100; def f(a):a+.+11; [(g|f(20)), f]', [1])
    ).toEqual([[33, 101]]);
  });

  test('def fac: if . == 1 then 1 else . * (. - 1 | fac) end; [.[] | fac]', () => {
    expect(
      parseAndQuery('def fac: if . == 1 then 1 else . * (. - 1 | fac) end; [.[] | fac]', [
        [1, 2, 3, 4]
      ])
    ).toEqual([[1, 2, 6, 24]]);
  });

  test('[any,all]', () => {
    expect(parseAndQuery('[any,all]', [[]])).toEqual([[false, true]]);
    expect(parseAndQuery('[any,all]', [[true]])).toEqual([[true, true]]);
    expect(parseAndQuery('[any,all]', [[false]])).toEqual([[false, false]]);
    expect(parseAndQuery('[any,all]', [[true, false]])).toEqual([[true, false]]);
    expect(parseAndQuery('[any,all]', [[undefined, undefined, true]])).toEqual([[true, false]]);
  });

  test('[.[] | if .foo then "yep" else "nope" end]', () => {
    expect(
      parseAndQuery('[.[] | if .foo then "yep" else "nope" end]', [
        [
          { foo: 0 },
          { foo: 1 },
          { foo: [] },
          { foo: true },
          { foo: false },
          { foo: null },
          { foo: 'foo' },
          {}
        ]
      ])
    ).toEqual([['yep', 'yep', 'yep', 'yep', 'nope', 'nope', 'yep', 'nope']]);
  });

  test('[.[] | if .baz then "strange" elif .foo then "yep" else "nope" end]', () => {
    expect(
      parseAndQuery('[.[] | if .baz then "strange" elif .foo then "yep" else "nope" end]', [
        [
          { foo: 0 },
          { foo: 1 },
          { foo: [] },
          { foo: true },
          { foo: false },
          { foo: null },
          { foo: 'foo' },
          {}
        ]
      ])
    ).toEqual([['yep', 'yep', 'yep', 'yep', 'nope', 'nope', 'yep', 'nope']]);
  });

  test('[if 1,null,2 then 3 else 4 end]', () => {
    expect(parseAndQuery('[if 1,null,2 then 3 else 4 end]', [undefined])).toEqual([[3, 4, 3]]);
  });

  test('[if empty then 3 else 4 end]', () => {
    expect(parseAndQuery('[if empty then 3 else 4 end]', [[]])).toEqual([[]]);
  });

  test('[if 1 then 3,4 else 5 end]', () => {
    expect(parseAndQuery('[if 1 then 3,4 else 5 end]', [undefined])).toEqual([[3, 4]]);
  });

  test('[if null then 3 else 5,6 end]', () => {
    expect(parseAndQuery('[if null then 3 else 5,6 end]', [undefined])).toEqual([[5, 6]]);
  });

  test('[if true then 3 end]', () => {
    expect(parseAndQuery('[if true then 3 end]', [7])).toEqual([[3]]);
  });

  test('[if false then 3 end]', () => {
    expect(parseAndQuery('[if false then 3 end]', [7])).toEqual([[7]]);
  });

  test('[if false then 3 else . end]', () => {
    expect(parseAndQuery('[if false then 3 else . end]', [7])).toEqual([[7]]);
  });

  test('[if false then 3 elif false then 4 end]', () => {
    expect(parseAndQuery('[if false then 3 elif false then 4 end]', [7])).toEqual([[7]]);
  });

  test('[if false then 3 elif false then 4 else . end]', () => {
    expect(parseAndQuery('[if false then 3 elif false then 4 else . end]', [7])).toEqual([[7]]);
  });

  // TODO: Fix
  test.skip('[.[] | [.foo[] // .bar]]', () => {
    expect(
      parseAndQuery('[.[] | [.foo[] // .bar]]', [
        [
          { foo: [1, 2], bar: 42 },
          { foo: [1], bar: null },
          { foo: [null, false, 3], bar: 18 },
          { foo: [], bar: 42 },
          { foo: [null, false, null], bar: 41 }
        ]
      ])
    ).toEqual([[[1, 2], [1], [3], [42], [41]]]);
  });

  test('.[] | [.[0] and .[1], .[0] or .[1]]', () => {
    expect(
      parseAndQuery('.[] | [.[0] and .[1], .[0] or .[1]]', [
        [
          [true, []],
          [false, 1],
          [42, null],
          [null, false]
        ]
      ])
    ).toEqual([
      [true, true],
      [false, true],
      [false, true],
      [false, false]
    ]);
  });

  test('[.[] | not]', () => {
    expect(parseAndQuery('[.[] | not]', [[1, 0, false, null, true, 'hello']])).toEqual([
      [false, false, true, true, false, false]
    ]);
  });

  test('[10 > 0, 10 > 10, 10 > 20, 10 < 0, 10 < 10, 10 < 20]', () => {
    expect(parseAndQuery('[10 > 0, 10 > 10, 10 > 20, 10 < 0, 10 < 10, 10 < 20]', [{}])).toEqual([
      [true, false, false, false, false, true]
    ]);
  });

  test('[10 >= 0, 10 >= 10, 10 >= 20, 10 <= 0, 10 <= 10, 10 <= 20]', () => {
    expect(
      parseAndQuery('[10 >= 0, 10 >= 10, 10 >= 20, 10 <= 0, 10 <= 10, 10 <= 20]', [{}])
    ).toEqual([[true, true, false, false, true, true]]);
  });

  test('[ 10 == 10, 10 != 10, 10 != 11, 10 == 11]', () => {
    expect(parseAndQuery('[ 10 == 10, 10 != 10, 10 != 11, 10 == 11]', [{}])).toEqual([
      [true, false, true, false]
    ]);
  });

  test('["hello" == "hello", "hello" != "hello", "hello" == "world", "hello" != "world" ]', () => {
    expect(
      parseAndQuery(
        '["hello" == "hello", "hello" != "hello", "hello" == "world", "hello" != "world" ]',
        [{}]
      )
    ).toEqual([[true, false, false, true]]);
  });

  test('[[1,2,3] == [1,2,3], [1,2,3] != [1,2,3], [1,2,3] == [4,5,6], [1,2,3] != [4,5,6]]', () => {
    expect(
      parseAndQuery(
        '[[1,2,3] == [1,2,3], [1,2,3] != [1,2,3], [1,2,3] == [4,5,6], [1,2,3] != [4,5,6]]',
        [{}]
      )
    ).toEqual([[true, false, false, true]]);
  });

  test('[{"foo":42} == {"foo":42},{"foo":42} != {"foo":42}, {"foo":42} != {"bar":42}, {"foo":42} == {"bar":42}]', () => {
    expect(
      parseAndQuery(
        '[{"foo":42} == {"foo":42},{"foo":42} != {"foo":42}, {"foo":42} != {"bar":42}, {"foo":42} == {"bar":42}]',
        [{}]
      )
    ).toEqual([[true, false, true, false]]);
  });

  test('[{"foo":[1,2,{"bar":18},"world"]} == {"foo":[1,2,{"bar":18},"world"]},{"foo":[1,2,{"bar":18},"world"]} == {"foo":[1,2,{"bar":19},"world"]}]', () => {
    expect(
      parseAndQuery(
        '[{"foo":[1,2,{"bar":18},"world"]} == {"foo":[1,2,{"bar":18},"world"]},{"foo":[1,2,{"bar":18},"world"]} == {"foo":[1,2,{"bar":19},"world"]}]',
        [{}]
      )
    ).toEqual([[true, false]]);
  });

  test('[("foo" | contains("foo")), ("foobar" | contains("foo")), ("foo" | contains("foobar"))]', () => {
    expect(
      parseAndQuery(
        '[("foo" | contains("foo")), ("foobar" | contains("foo")), ("foo" | contains("foobar"))]',
        [{}]
      )
    ).toEqual([[true, true, false]]);
  });

  test('[.[]|startswith("foo")]', () => {
    expect(
      parseAndQuery('[.[]|startswith("foo")]', [['fo', 'foo', 'barfoo', 'foobar', 'barfoob']])
    ).toEqual([[false, true, false, true, false]]);
  });

  test('[.[]|endswith("foo")]', () => {
    expect(
      parseAndQuery('[.[]|endswith("foo")]', [['fo', 'foo', 'barfoo', 'foobar', 'barfoob']])
    ).toEqual([[false, true, true, false, false]]);
  });

  test('[.[] | split(", ")]', () => {
    expect(
      parseAndQuery('[.[] | split(", ")]', [['a,b, c, d, e,f', ', a,b, c, d, e,f, ']])
    ).toEqual([
      [
        ['a,b', 'c', 'd', 'e,f'],
        ['', 'a,b', 'c', 'd', 'e,f', '']
      ]
    ]);
  });

  test('split("")', () => {
    expect(parseAndQuery('split("")', ['abc'])).toEqual([['a', 'b', 'c']]);
  });

  test('[.[]|split(",")]', () => {
    expect(
      parseAndQuery('[.[]|split(",")]', [
        ['a, bc, def, ghij, jklmn, a,b, c,d, e,f', 'a,b,c,d, e,f,g,h']
      ])
    ).toEqual([
      [
        ['a', ' bc', ' def', ' ghij', ' jklmn', ' a', 'b', ' c', 'd', ' e', 'f'],
        ['a', 'b', 'c', 'd', ' e', 'f', 'g', 'h']
      ]
    ]);
  });

  test('[.[]|split(", ")]', () => {
    expect(
      parseAndQuery('[.[]|split(", ")]', [
        ['a, bc, def, ghij, jklmn, a,b, c,d, e,f', 'a,b,c,d, e,f,g,h']
      ])
    ).toEqual([
      [
        ['a', 'bc', 'def', 'ghij', 'jklmn', 'a,b', 'c,d', 'e,f'],
        ['a,b,c,d', 'e,f,g,h']
      ]
    ]);
  });

  test('map(.[1] as $needle | .[0] | contains($needle))', () => {
    expect(
      parseAndQuery('map(.[1] as $needle | .[0] | contains($needle))', [
        [
          [[], []],
          [
            [1, 2, 3],
            [1, 2]
          ],
          [
            [1, 2, 3],
            [3, 1]
          ],
          [[1, 2, 3], [4]],
          [
            [1, 2, 3],
            [1, 4]
          ]
        ]
      ])
    ).toEqual([[true, true, true, false, false]]);

    expect(
      parseAndQuery('map(.[1] as $needle | .[0] | contains($needle))', [
        [
          [
            ['foobar', 'foobaz'],
            ['baz', 'bar']
          ],
          [['foobar', 'foobaz'], ['foo']],
          [['foobar', 'foobaz'], ['blap']]
        ]
      ])
    ).toEqual([[true, true, false]]);
  });

  test('unique', () => {
    expect(parseAndQuery('unique', [[1, 2, 5, 3, 5, 3, 1, 3]])).toEqual([[1, 2, 3, 5]]);
    expect(parseAndQuery('unique', [[]])).toEqual([[]]);
  });

  // TODO: Fix
  test.skip('[min, max, min_by(.[1]), max_by(.[1]), min_by(.[2]), max_by(.[2])]', () => {
    expect(
      parseAndQuery('[min, max, min_by(.[1]), max_by(.[1]), min_by(.[2]), max_by(.[2])]', [
        [
          [4, 2, 'a'],
          [3, 1, 'a'],
          [2, 4, 'a'],
          [1, 3, 'a']
        ]
      ])
    ).toEqual([
      [
        [1, 3, 'a'],
        [4, 2, 'a'],
        [3, 1, 'a'],
        [2, 4, 'a'],
        [4, 2, 'a'],
        [1, 3, 'a']
      ]
    ]);
  });

  test('[min,max,min_by(.),max_by(.)]', () => {
    expect(parseAndQuery('[min,max,min_by(.),max_by(.)]', [[]])).toEqual([
      [undefined, undefined, undefined, undefined]
    ]);
  });

  // TODO: Fix
  test.skip('.foo[.baz]', () => {
    expect(parseAndQuery('.foo[.baz]', [{ foo: { bar: 4 }, baz: 'bar' }])).toEqual([4]);
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

  test('keys', () => {
    expect(parseAndQuery('keys', [[42, 3, 35]])).toEqual([[0, 1, 2]]);
  });

  test('flatten', () => {
    expect(parseAndQuery('flatten', [[0, [1], [[2]], [[[3]]]]])).toEqual([[0, 1, 2, 3]]);
  });

  test('flatten(0)', () => {
    expect(parseAndQuery('flatten(0)', [[0, [1], [[2]], [[[3]]]]])).toEqual([
      [0, [1], [[2]], [[[3]]]]
    ]);
  });

  test('flatten(2)', () => {
    expect(parseAndQuery('flatten(2)', [[0, [1], [[2]], [[[3]]]]])).toEqual([[0, 1, 2, [3]]]);
    expect(parseAndQuery('flatten(2)', [[0, [1, [2]], [1, [[3], 2]]]])).toEqual([
      [0, 1, 2, 1, [3], 2]
    ]);
  });

  test('abs', () => {
    expect(parseAndQuery('abs', ['abc'])).toEqual(['abc']);
  });

  test('map(abs)', () => {
    expect(parseAndQuery('map(abs)', [[-0, 0, -10, -1.1]])).toEqual([[0, 0, 10, 1.1]]);
  });

  test('[range(10)] | .[1.2:3.5]', () => {
    expect(parseAndQuery('[range(10)] | .[1.2:3.5]', [undefined])).toEqual([[1, 2, 3]]);
    expect(parseAndQuery('[range(10)] | .[1.5:3.5]', [undefined])).toEqual([[1, 2, 3]]);
    expect(parseAndQuery('[range(10)] | .[1.7:3.5]', [undefined])).toEqual([[1, 2, 3]]);
  });

  test('[range(10)] | .[1.7:4294967295]', () => {
    expect(parseAndQuery('[range(10)] | .[1.7:4294967295]', [undefined])).toEqual([
      [1, 2, 3, 4, 5, 6, 7, 8, 9]
    ]);
  });

  test('[range(10)] | .[1.7:-4294967296]', () => {
    expect(parseAndQuery('[range(10)] | .[1.7:-4294967296]', [undefined])).toEqual([[]]);
  });

  test('[[range(10)] | .[1.1,1.5,1.7]]', () => {
    expect(parseAndQuery('[[range(10)] | .[1.1,1.5,1.7]]', [undefined])).toEqual([[1, 1, 1]]);
  });
});
