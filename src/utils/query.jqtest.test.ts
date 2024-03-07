import { describe, expect, test } from 'vitest';
import { error, parse, parseAndQuery } from './query.ts';

// See https://github.com/jqlang/jq/blob/master/tests/jq.test

describe('jqtest', () => {
  // L5
  describe('Simple value tests to check parser. Input is irrelevant', () => {
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

    test('"Aa\r\n\t\b\f\u03bc"', () => {
      expect(parseAndQuery('"Aa\r\n\t\b\f\u03bc"', [undefined])).toEqual([
        'Aa\u000d\u000a\u0009\u0008\u000c\u03bc'
      ]);
    });

    test('.', () => {
      expect(parseAndQuery('.', ['Aa\r\n\t\b\f\u03bc'])).toEqual([
        'Aa\u000d\u000a\u0009\u0008\u000c\u03bc'
      ]);
    });

    test('"inter\\("pol" + "ation")"', () => {
      expect(parseAndQuery('"inter\\("pol" + "ation")"', [undefined])).toEqual(['interpolation']);
    });

    // Some encoding tests on L64-L91 we don't support

    test('[.[]|tojson|fromjson]', () => {
      expect(
        parseAndQuery('[.[]|tojson|fromjson]', [['foo', 1, ['a', 1, 'b', 2, { foo: 'bar' }]]])
      ).toEqual([['foo', 1, ['a', 1, 'b', 2, { foo: 'bar' }]]]);
    });
  });

  // L99
  describe('Dictionary construction syntax', () => {
    test('{a: 1}', () => {
      expect(parseAndQuery('{a: 1}', [undefined])).toEqual([{ a: 1 }]);
    });

    test('{a,b,(.d):.a,e:.b}', () => {
      expect(parseAndQuery('{a,b,(.d):.a,e:.b}', [{ a: 1, b: 2, d: 'c' }])).toEqual([
        { a: 1, b: 2, c: 1, e: 2 }
      ]);
    });

    test.skip('{"a",b,"a$\\(1+1)"}', () => {
      expect(parseAndQuery('{"a",b,"a$\\(1+1)"}', [{ a: 1, b: 2, c: 3, a$2: 4 }])).toEqual([
        { a: 1, b: 2, a$2: 4 }
      ]);
    });
  });

  // L122
  describe('Field access, piping', () => {
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

    test('[.[]|.[]?]', () => {
      expect(
        parseAndQuery('[.[]|.[]?]', [[1, null, [], [1, [2, [[3]]]], [{}], [{ a: [1, [2]] }]]])
      ).toEqual([[1, [2, [[3]]], {}, { a: [1, [2]] }]]);
    });

    test('[.[]|.[1:3]?]', () => {
      expect(
        parseAndQuery('[.[]|.[1:3]?]', [
          [1, undefined, true, false, 'abcdef', {}, { a: 1, b: 2 }, [], [1, 2, 3, 4, 5], [1, 2]]
        ])
      ).toEqual([[undefined, 'bc', [], [2, 3], [2]]]);
    });

    test('map(try .a[] catch ., try .a.[] catch ., .a[]?, .a.[]?)', () => {
      expect(
        parseAndQuery('map(try .a[] catch ., try .a.[] catch ., .a[]?, .a.[]?)', [
          [{ a: [1, 2] }, { a: 123 }]
        ])
      ).toEqual([[1, 2, 1, 2, 1, 2, 1, 2, error(201), error(201)]]);
    });
  });

  // L182
  describe('Negative array indices', () => {
    test.skip('try (.foo[-1] = 0) catch .', () => {
      expect(parseAndQuery('try (.foo[-1] = 0) catch .', [undefined])).toEqual([
        'Out of bounds negative array index'
      ]);
    });

    test.skip('try (.foo[-2] = 0) catch .', () => {
      expect(parseAndQuery('try (.foo[-2] = 0) catch .', [undefined])).toEqual([
        'Out of bounds negative array index'
      ]);
    });

    test('.[-1] = 5', () => {
      expect(parseAndQuery('.[-1] = 5', [[0, 1, 2]])).toEqual([[0, 1, 5]]);
    });

    test('.[-2] = 5', () => {
      expect(parseAndQuery('.[-2] = 5', [[0, 1, 2]])).toEqual([[0, 5, 2]]);
    });
  });

  // L202
  describe('Multiple outputs, iteration', () => {
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

    test('[([5,5][]),.,.[]]', () => {
      expect(parseAndQuery('[([5,5][]),.,.[]]', [[1, 2, 3]])).toEqual([[5, 5, [1, 2, 3], 1, 2, 3]]);
    });

    test('{x: (1,2)},{x:3} | .x', () => {
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
      expect(parseAndQuery('[range(0,1;3,4)]', [[]])).toEqual([
        [0, 1, 2, 0, 1, 2, 3, 1, 2, 1, 2, 3]
      ]);
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

    test.skip('[while(.<100; .*2)]', () => {
      expect(parseAndQuery('[while(.<100; .*2)]', [1])).toEqual([[1, 2, 4, 8, 16, 32, 64]]);
    });

    test.skip('[(label $here | .[] | if .>1 then break $here else . end), "hi!"]', () => {
      expect(
        parseAndQuery('[(label $here | .[] | if .>1 then break $here else . end), "hi!"]', [
          [0, 1, 2]
        ])
      ).toEqual([[0, 1, 'hi!']]);
    });

    test.skip('[(label $here | .[] | if .>1 then break $here else . end), "hi!"]', () => {
      expect(
        parseAndQuery('[(label $here | .[] | if .>1 then break $here else . end), "hi!"]', [
          [0, 2, 1]
        ])
      ).toEqual([[0, 'hi!']]);
    });

    test.skip('[.[]|[.,1]|until(.[0] < 1; [.[0] - 1, .[1] * .[0]])|.[1]]', () => {
      expect(
        parseAndQuery('[.[]|[.,1]|until(.[0] < 1; [.[0] - 1, .[1] * .[0]])|.[1]]', [
          [1, 2, 3, 4, 5]
        ])
      ).toEqual([[1, 2, 6, 24, 120]]);
    });

    test.skip('[label $out | foreach .[] as $item ([3, null]; if .[0] < 1 then break $out else [.[0] -1, $item] end; .[1])]', () => {
      expect(
        parseAndQuery(
          '[label $out | foreach .[] as $item ([3, null]; if .[0] < 1 then break $out else [.[0] -1, $item] end; .[1])]',
          [[11, 22, 33, 44, 55, 66, 77, 88, 99]]
        )
      ).toEqual([11, 22, 33]);
    });

    test.skip('[foreach range(5) as $item (0; $item)]', () => {
      expect(parseAndQuery('[foreach range(5) as $item (0; $item)]', [undefined])).toEqual([
        0, 1, 2, 34
      ]);
    });

    test.skip('[foreach .[] as [$i, $j] (0; . + $i - $j)]', () => {
      expect(
        parseAndQuery('[foreach .[] as [$i, $j] (0; . + $i - $j)]', [
          [
            [2, 1],
            [5, 3],
            [6, 4]
          ]
        ])
      ).toEqual([1, 3, 5]);
    });

    test.skip('[foreach .[] as {a:$a} (0; . + $a; -.)', () => {
      expect(
        parseAndQuery('[foreach .[] as {a:$a} (0; . + $a; -.)', [[{ a: 1 }, { a: 2 }, { a: 3 }]])
      ).toEqual([-1, -1, -4]);
    });

    test('[limit(3; .[])]', () => {
      expect(parseAndQuery('[limit(3; .[])]', [[11, 22, 33, 44, 55, 66, 77, 88, 99]])).toEqual([
        [11, 22, 33]
      ]);
    });

    test('[limit(0; error)]', () => {
      expect(parseAndQuery('[limit(0; error)]', ['badness'])).toEqual([[]]);
    });

    test('[limit(1; 1, error)]', () => {
      expect(parseAndQuery('[limit(1; 1, error)]', ['badness'])).toEqual([[1]]);
    });

    test('[first(range(.)), last(range(.))]', () => {
      expect(parseAndQuery('[first(range(.)), last(range(.))]', [10])).toEqual([[0, 9]]);
    });

    test('[nth(0,5,9,10,15; range(.)), try nth(-1; range(.)) catch .]', () => {
      expect(
        parseAndQuery('[nth(0,5,9,10,15; range(.)), try nth(-1; range(.)) catch "error"]', [10])
      ).toEqual([[0, 5, 9, 'error']]);
    });

    test('first(1, error("foo")', () => {
      expect(parseAndQuery('first(1, error("foo"))', [undefined])).toEqual([1]);
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

    test('[(index(",","|"), rindex(",","|")), indices(",","|")]', () => {
      expect(
        parseAndQuery('[(index(",","|"), rindex(",","|")), indices(",","|")]', [
          'a,b|c,d,e||f,g,h,|,|,i,j'
        ])
      ).toEqual([[1, 3, 22, 19, [1, 5, 7, 12, 14, 16, 18, 20, 22], [3, 9, 10, 17, 19]]]);
    });

    test('join(",","/")', () => {
      expect(parseAndQuery('join(",","/")', [['a', 'b', 'c', 'd']])).toEqual([
        'a,b,c,d',
        'a/b/c/d'
      ]);
    });

    test('[.[]|join("a")]', () => {
      expect(parseAndQuery('[.[]|join("a")]', [[[], [''], ['', ''], ['', '', '']]])).toEqual([
        ['', '', 'a', 'aa']
      ]);
    });

    test('flatten(3,2,1)', () => {
      expect(parseAndQuery('flatten(3,2,1)', [[0, [1], [[2]], [[[3]]]]])).toEqual([
        [0, 1, 2, 3],
        [0, 1, 2, [3]],
        [0, 1, [2], [[3]]]
      ]);
    });
  });

  // L389
  describe('Slices', () => {
    // TODO: Could be fixed
    test.skip('[.[3:2], .[-5:4], .[:-2], .[-2:], .[3:3][1:], .[10:]]', () => {
      expect(
        parseAndQuery('[.[3:2], .[-5:4], .[:-2], .[-2:], .[3:3][1:], .[10:]]', [
          [0, 1, 2, 3, 4, 5, 6]
        ])
      ).toEqual([[[], [2, 3], [0, 1, 2, 3, 4], [5, 6], [], []]]);
    });

    test.skip('[.[3:2], .[-5:4], .[:-2], .[-2:], .[3:3][1:], .[10:]]', () => {
      expect(
        parseAndQuery('[.[3:2], .[-5:4], .[:-2], .[-2:], .[3:3][1:], .[10:]]', ['abcdefghi'])
      ).toEqual([['', '', 'abcdefg', 'hi', '', '']]);
    });

    test.skip('del(.[2:4],.[0],.[-2:])', () => {
      expect(parseAndQuery('del(.[2:4],.[0],.[-2:])', [[0, 1, 2, 3, 4, 5, 6, 7]])).toEqual([
        [0, 4, 5]
      ]);
    });

    test.skip('.[2:4] = ([], ["a","b"], ["a","b","c"])', () => {
      expect(
        parseAndQuery('.[2:4] = ([], ["a","b"], ["a","b","c"])', [[0, 1, 2, 3, 4, 5, 6, 7]])
      ).toEqual([
        [0, 1, 4, 5, 6, 7],
        [0, 1, 'a', 'b', 4, 5, 6, 7],
        [0, 1, 'a', 'b', 'c', 4, 5, 6, 7]
      ]);
    });

    test.skip('reduce range(65540;65536;-1) as $i ([]; .[$i] = $i)|.[65536:]', () => {
      expect(
        parseAndQuery('reduce range(65540;65536;-1) as $i ([]; .[$i] = $i)|.[65536:]', [undefined])
      ).toEqual([[undefined, 65537, 65538, 65539, 65540]]);
    });
  });

  // L420
  describe('Variables', () => {
    test('1 as $x | 2 as $y | [$x,$y,$x]', () => {
      expect(parseAndQuery('1 as $x | 2 as $y | [$x,$y,$x]', [undefined])).toEqual([[1, 2, 1]]);
    });

    test('[1,2,3][] as $x | [[4,5,6,7][$x]]', () => {
      expect(parseAndQuery('[1,2,3][] as $x | [[4,5,6,7][$x]]', [undefined])).toEqual([
        [5],
        [6],
        [7]
      ]);
    });

    test('42 as $x | . | . | . + 432 | $x + 1', () => {
      expect(parseAndQuery('42 as $x | . | . | . + 432 | $x + 1', [34324])).toEqual([43]);
    });

    test('1 as $x | [$x,$x,$x as $x | $x]', () => {
      expect(parseAndQuery('1 as $x | [$x,$x,$x as $x | $x]', [undefined])).toEqual([[1, 1, 1]]);
    });

    test('[1, {c:3, d:4}] as [$a, {c:$b, b:$c}] | $a, $b, $c', () => {
      expect(
        parseAndQuery('[1, {c:3, d:4}] as [$a, {c:$b, b:$c}] | $a, $b, $c', [undefined])
      ).toEqual([1, 3, undefined]);
    });

    test('. as {as: $kw, "str": $str, ("e"+"x"+"p"): $exp} | [$kw, $str, $exp]', () => {
      expect(
        parseAndQuery('. as {as: $kw, "str": $str, ("e"+"x"+"p"): $exp} | [$kw, $str, $exp]', [
          { as: 1, str: 2, exp: 3 }
        ])
      ).toEqual([[1, 2, 3]]);
    });

    test('.[] as [$a, $b] | [$b, $a]', () => {
      expect(parseAndQuery('.[] as [$a, $b] | [$b, $a]', [[[1], [1, 2, 3]]])).toEqual([
        [undefined, 1],
        [2, 1]
      ]);
    });

    test('. as $i | . as [$i] | $i', () => {
      expect(parseAndQuery('. as $i | . as [$i] | $i', [[0]])).toEqual([0]);
    });

    test('. as [$i] | . as $i | $i', () => {
      expect(parseAndQuery('. as [$i] | . as $i | $i', [[0]])).toEqual([[0]]);
    });
  });

  // L476
  describe('Builtin functions', () => {
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

    test('1e+0+0.001e3', () => {
      expect(parseAndQuery('1e+0+0.001e3', ['I wonder what this will be?'])).toEqual([20e-1]);
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

    test('"\u0000\u0020\u0000" + .', () => {
      expect(parseAndQuery('"\u0000\u0020\u0000" + .', ['\u0000\u0020\u0000'])).toEqual([
        '\u0000 \u0000\u0000 \u0000'
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
      expect(
        parseAndQuery('[16 / 4 / 2, 16 / 4 * 2, 16 - 4 - 2, 16 - 4 + 2]', [undefined])
      ).toEqual([[2, 8, 10, 14]]);
    });

    test('1e-19 + 1e-20 - 5e-21', () => {
      expect(parseAndQuery('1e-19 + 1e-20 - 5e-21', [undefined])[0]).toBeCloseTo(1e-19);
    });

    test('1 / 1e-17', () => {
      expect(parseAndQuery('1 / 1e-17', [undefined])).toEqual([1e17]);
    });

    // A few missing infinite precision tests, L559-L577

    test('25 % 7', () => {
      expect(parseAndQuery('25 % 7', [undefined])).toEqual([4]);
    });

    test('49732 % 472', () => {
      expect(parseAndQuery('49732 % 472', [undefined])).toEqual([172]);
    });

    // NOTE: Not really worth fixing this
    test.skip('[(infinite, -infinite) % (1, -1, infinite)]', () => {
      expect(parseAndQuery('[(infinite, -infinite) % (1, -1, infinite)]', [undefined])).toEqual([
        [0, 0, 0, 0, 0, -1]
      ]);
    });

    test('[nan % 1, 1 % nan | isnan]', () => {
      expect(parseAndQuery('[nan % 1, 1 % nan | isnan]', [undefined])).toEqual([[true, true]]);
    });

    test('1 + tonumber + ("10" | tonumber)', () => {
      expect(parseAndQuery('1 + tonumber + ("10" | tonumber)', [4])).toEqual([15]);
    });

    test('[{"a":42},.object,10,.num,false,true,null,"b",[1,4]] | .[] as $x | [$x == .[]]', () => {
      expect(
        parseAndQuery(
          '[{"a":42},.object,10,.num,false,true,null,"b",[1,4]] | .[] as $x | [$x == .[]]',
          [{ object: { a: 42 }, num: 10.0 }]
        )
      ).toEqual([
        [true, true, false, false, false, false, false, false, false],
        [true, true, false, false, false, false, false, false, false],
        [false, false, true, true, false, false, false, false, false],
        [false, false, true, true, false, false, false, false, false],
        [false, false, false, false, true, false, false, false, false],
        [false, false, false, false, false, true, false, false, false],
        [false, false, false, false, false, false, true, false, false],
        [false, false, false, false, false, false, false, true, false],
        [false, false, false, false, false, false, false, false, true]
      ]);
    });

    test('[.[] | length]', () => {
      expect(
        parseAndQuery('[.[] | length]', [[[], {}, [1, 2], { a: 42 }, 'asdf', '\u03bc']])
      ).toEqual([[0, 0, 2, 1, 4, 1]]);
    });

    // Missing a couple of tests for utf8bytelength, L615-L621

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
  });

  // L641
  describe('User-defined functions', () => {
    test('def f: . + 1; def g: def g: . + 100; f | g | f; (f | g), g', () => {
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

    test.skip('def f: 1; def g: f, def f: 2; def g: 3; f, def f: g; f, g; def f: 4; [f, def f: g; def g: 5; f, g]+[f,g]', () => {
      console.dir(parse('def f: 1; def g: f, def f: 2; def g: 3; f, def f: g; f, g', false), {
        depth: 20
      });
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
        parseAndQuery(
          '(add / length) as $m | map((. - $m) as $d | $d * $d) | add / length | sqrt',
          [[2, 4, 4, 4, 5, 5, 7, 9]]
        )
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
          1, 0.996917, 0.987688, 0.972369, 0.951056, 0.923879, 0.891006, 0.85264, 0.809017,
          0.760406, 0.707106, 0.649448, 0.587785, 0.522498, 0.45399, 0.382683, 0.309017, 0.233445,
          0.156434, 0.078459
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
          0, 0.078459, 0.156434, 0.233445, 0.309016, 0.382683, 0.45399, 0.522498, 0.587785,
          0.649447, 0.707106, 0.760405, 0.809016, 0.85264, 0.891006, 0.923879, 0.951056, 0.972369,
          0.987688, 0.996917
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

    test.skip('def id(x):x; 2000 as $x | def f(x):1 as $x | id([$x, x, x]); def g(x): 100 as $x | f($x,$x+x); g($x)', () => {
      expect(
        parseAndQuery(
          'def id(x):x; 2000 as $x | def f(x):1 as $x | id([$x, x, x]); def g(x): 100 as $x | f($x,$x+x); g($x)',
          ['more testing']
        )
      ).toEqual([[1, 100, 2100.0, 100, 2100.0]]);
    });

    test.skip('def x(a;b): a as $a | b as $b | $a + $b; def y($a;$b): $a + $b; def check(a;b): [x(a;b)] == [y(a;b)]; check(.[];.[]*2)', () => {
      expect(
        parseAndQuery(
          'def x(a;b): a as $a | b as $b | $a + $b; def y($a;$b): $a + $b; def check(a;b): [x(a;b)] == [y(a;b)]; check(.[];.[]*2)',
          [[1, 2, 3]]
        )
      ).toEqual([true]);
    });

    test.skip('[[20,10][1,0] as $x | def f: (100,200) as $y | def g: [$x + $y, .]; . + $x | g; f[0] | [f][0][1] | f]', () => {
      expect(
        parseAndQuery(
          '[[20,10][1,0] as $x | def f: (100,200) as $y | def g: [$x + $y, .]; . + $x | g; f[0] | [f][0][1] | f',
          [999999999]
        )
      ).toEqual([
        [
          [110.0, 130.0],
          [210.0, 130.0],
          [110.0, 230.0],
          [210.0, 230.0],
          [120.0, 160.0],
          [220.0, 160.0],
          [120.0, 260.0],
          [220.0, 260.0]
        ]
      ]);
    });

    test('def fac: if . == 1 then 1 else . * (. - 1 | fac) end; [.[] | fac]', () => {
      expect(
        parseAndQuery('def fac: if . == 1 then 1 else . * (. - 1 | fac) end; [.[] | fac]', [
          [1, 2, 3, 4]
        ])
      ).toEqual([[1, 2, 6, 24]]);
    });

    test('reduce .[] as $x (0; . + $x)', () => {
      expect(parseAndQuery('reduce .[] as $x (0; . + $x)', [[1, 2, 4]])).toEqual([7]);
    });

    test.skip('reduce .[] as [$i, {j:$j}] (0; . + $i - $j)', () => {
      expect(
        parseAndQuery('reduce .[] as [$i, {j:$j}] (0; . + $i - $j)', [
          [
            [2, { j: 1 }],
            [5, { j: 3 }],
            [6, { j: 4 }]
          ]
        ])
      ).toEqual([5]);
    });

    test.skip('reduce [[1,2,10], [3,4,10]][] as [$i,$j] (0; . + $i * $j)', () => {
      expect(
        parseAndQuery('reduce [[1,2,10], [3,4,10]][] as [$i,$j] (0; . + $i * $j)', [undefined])
      ).toEqual([14]);
    });

    test('reduce . as $n (.; .)', () => {
      expect(parseAndQuery('reduce . as $n (.; .)', [undefined])).toEqual([undefined]);
    });

    test('. as {$a, b: [$c, {$d}]} | [$a, $c, $d]', () => {
      expect(
        parseAndQuery('. as {$a, b: [$c, {$d}]} | [$a, $c, $d]', [{ a: 1, b: [2, { d: 3 }] }])
      ).toEqual([[1, 2, 3]]);
    });

    // NOTE: This doesn't work as we currently dont support constructs such as $b:[$c, $d]
    test.skip('. as {$a, $b:[$c, $d]}| [$a, $b, $c, $d]', () => {
      expect(
        parseAndQuery('. as {$a, $b:[$c, $d]}| [$a, $b, $c, $d]', [{ a: 1, b: [2, { d: 3 }] }])
      ).toEqual([[1, [2, { d: 3 }], 2, { d: 3 }]]);
    });

    // A number of missing reduce/destructuing tests, L786-L892

    test('. as $dot|any($dot[];not)', () => {
      expect(
        parseAndQuery('. as $dot|any($dot[];not)', [[1, 2, 3, 4, true, false, 1, 2, 3, 4, 5]])
      ).toEqual([true]);
    });

    test('. as $dot|any($dot[];not)', () => {
      expect(parseAndQuery('. as $dot|any($dot[];not)', [[1, 2, 3, 4, true]])).toEqual([false]);
    });

    test('. as $dot|all($dot[];.)', () => {
      expect(
        parseAndQuery('. as $dot|all($dot[];.)', [[1, 2, 3, 4, true, false, 1, 2, 3, 4, 5]])
      ).toEqual([false]);
    });

    test('. as $dot|all($dot[];.)', () => {
      expect(parseAndQuery('. as $dot|all($dot[];.)', [[1, 2, 3, 4, true]])).toEqual([true]);
    });

    test('any(true, error; .)', () => {
      expect(parseAndQuery('any(true, error; .)', ['badness'])).toEqual([true]);
    });

    test('all(false, error; .)', () => {
      expect(parseAndQuery('all(false, error; .)', ['badness'])).toEqual([false]);
    });

    test('any(not)', () => {
      expect(parseAndQuery('any(not)', [[]])).toEqual([false]);
      expect(parseAndQuery('any(not)', [[false]])).toEqual([true]);
    });

    test('all(not)', () => {
      expect(parseAndQuery('all(not)', [[]])).toEqual([true]);
      expect(parseAndQuery('all(not)', [[false]])).toEqual([true]);
    });

    test('[any,all]', () => {
      expect(parseAndQuery('[any,all]', [[]])).toEqual([[false, true]]);
      expect(parseAndQuery('[any,all]', [[true]])).toEqual([[true, true]]);
      expect(parseAndQuery('[any,all]', [[false]])).toEqual([[false, false]]);
      expect(parseAndQuery('[any,all]', [[true, false]])).toEqual([[true, false]]);
      expect(parseAndQuery('[any,all]', [[undefined, undefined, true]])).toEqual([[true, false]]);
    });
  });

  // L956
  describe('Paths', () => {
    test('path(.foo[0,1])', () => {
      expect(parseAndQuery('path(.foo[0,1])', [undefined])).toEqual([
        ['foo', 0],
        ['foo', 1]
      ]);
    });

    test('path(.[] | select(.>3))', () => {
      expect(parseAndQuery('path(.[] | select(.>3))', [[1, 5, 3]])).toEqual([[1]]);
    });

    test('path(.)', () => {
      expect(parseAndQuery('path(.)', [42])).toEqual([[]]);
    });

    // A number of missing try/catch tests, L972-L986

    test('path(.a[path(.b)[0]])', () => {
      expect(parseAndQuery('path(.a[path(.b)[0]])', [{ a: { b: 0 } }])).toEqual([['a', 'b']]);
    });

    test('[paths]', () => {
      expect(parseAndQuery('[paths]', [[1, [[], { a: 2 }]]])).toEqual([
        [[0], [1], [1, 0], [1, 1], [1, 1, 'a']]
      ]);
    });

    test('["foo",1] as $p | getpath($p), setpath($p; 20), delpaths([$p])', () => {
      expect(
        parseAndQuery('["foo",1] as $p | getpath($p), setpath($p; 20), delpaths([$p])', [
          { bar: 42, foo: ['a', 'b', 'c', 'd'] }
        ])
      ).toEqual(['b', { bar: 42, foo: ['a', 20, 'c', 'd'] }, { bar: 42, foo: ['a', 'c', 'd'] }]);
    });

    test('map(getpath([2])), map(setpath([2]; 42)), map(delpaths([[2]]))', () => {
      expect(
        parseAndQuery('map(getpath([2])), map(setpath([2]; 42)), map(delpaths([[2]]))', [
          [[0], [0, 1], [0, 1, 2]]
        ])
      ).toEqual([
        [undefined, undefined, 2],
        [
          [0, undefined, 42],
          [0, 1, 42],
          [0, 1, 42]
        ],
        [[0], [0, 1], [0, 1]]
      ]);
    });

    test('map(delpaths([[0,"foo"]]))', () => {
      expect(
        parseAndQuery('map(delpaths([[0,"foo"]]))', [[[{ foo: 2, x: 1 }], [{ bar: 2 }]]])
      ).toEqual([[[{ x: 1 }], [{ bar: 2 }]]]);
    });

    test('["foo",1] as $p | getpath($p), setpath($p; 20), delpaths([$p])', () => {
      expect(
        parseAndQuery('["foo",1] as $p | getpath($p), setpath($p; 20), delpaths([$p])', [
          { bar: false }
        ])
      ).toEqual([undefined, { bar: false, foo: [undefined, 20] }, { bar: false }]);
    });

    test('delpaths([[-200]])', () => {
      expect(parseAndQuery('delpaths([[-200]])', [[1, 2, 3]])).toEqual([[1, 2, 3]]);
    });

    test('del(.), del(empty), del((.foo,.bar,.baz) | .[2,3,0]), del(.foo[0], .bar[0], .foo, .baz.bar[0].x)', () => {
      expect(
        parseAndQuery(
          'del(.), del(empty), del((.foo,.bar,.baz) | .[2,3,0]), del(.foo[0], .bar[0], .foo, .baz.bar[0].x)',
          [{ foo: [0, 1, 2, 3, 4], bar: [0, 1] }]
        )
      ).toEqual([
        undefined,
        { foo: [0, 1, 2, 3, 4], bar: [0, 1] },
        { foo: [1, 4], bar: [1] },
        { bar: [1] }
      ]);
    });

    // NOTE: The issue here is we don't support del(.[-3:9])
    test.skip('del(.[1], .[-6], .[2], .[-3:9])', () => {
      expect(
        parseAndQuery('del(.[1], .[-6], .[2], .[-3:9])', [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]])
      ).toEqual([[0, 3, 5, 6, 9]]);
    });

    test('setpath([-1]; 1)', () => {
      expect(parseAndQuery('setpath([-1]; 1)', [[0]])).toEqual([[1]]);
    });

    test('pick(.a.b.c)', () => {
      expect(parseAndQuery('pick(.a.b.c)', [undefined])).toEqual([{ a: { b: { c: undefined } } }]);
    });

    test('pick(first)', () => {
      expect(parseAndQuery('pick(first)', [[1, 2]])).toEqual([[1]]);
    });

    test('pick(first|first)', () => {
      expect(parseAndQuery('pick(first|first)', [[[10, 20], 30]])).toEqual([[[10]]]);
    });

    test.skip('try pick(last) catch .', () => {
      expect(parseAndQuery('try pick(last) catch .', [[1, 2]])).toEqual([
        'Out of bounds negative array index'
      ]);
    });
  });

  // L1060
  describe('Assignment', () => {
    test('.message = "goodbye"', () => {
      expect(parseAndQuery('.message = "goodbye"', [{ message: 'hello' }])).toEqual([
        { message: 'goodbye' }
      ]);
    });

    test('.foo = .bar', () => {
      expect(parseAndQuery('.foo = .bar', [{ bar: 42 }])).toEqual([{ foo: 42, bar: 42 }]);
    });

    test('.foo |= .+1', () => {
      expect(parseAndQuery('.foo |= .+1', [{ foo: 42 }])).toEqual([{ foo: 43 }]);
    });

    test('.[] += 2, .[] *= 2, .[] -= 2, .[] /= 2, .[] %=2', () => {
      expect(parseAndQuery('.[] += 2, .[] *= 2, .[] -= 2, .[] /= 2, .[] %=2', [[1, 3, 5]])).toEqual(
        [
          [3, 5, 7],
          [2, 6, 10],
          [-1, 1, 3],
          [0.5, 1.5, 2.5],
          [1, 1, 1]
        ]
      );
    });

    test('[.[] % 7]', () => {
      expect(
        parseAndQuery('[.[] % 7]', [[-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7]])
      ).toEqual([[-0, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 0]]);

      // TODO: This should start with 0 and not -0
    });

    // NOTE: Not sure exactly why this should work in the first place
    test.skip('.foo += .foo', () => {
      expect(parseAndQuery('.foo += .foo', [{ foo: 2 }])).toEqual([{ foo: 4 }]);
    });

    test('.[0].a |= {"old":., "new":(.+1)}', () => {
      expect(parseAndQuery('.[0].a |= {"old":., "new":(.+1)}', [[{ a: 1, b: 2 }]])).toEqual([
        [{ a: { old: 1, new: 2 }, b: 2 }]
      ]);
    });

    test('def inc(x): x |= .+1; inc(.[].a)', () => {
      expect(
        parseAndQuery('def inc(x): x |= .+1; inc(.[].a)', [
          [
            { a: 1, b: 2 },
            { a: 2, b: 4 },
            { a: 7, b: 8 }
          ]
        ])
      ).toEqual([
        [
          { a: 2, b: 2 },
          { a: 3, b: 4 },
          { a: 8, b: 8 }
        ]
      ]);
    });

    test.skip('.[] | try (getpath(["a",0,"b"]) |= 5) catch .', () => {
      expect(
        parseAndQuery('.[] | try (getpath(["a",0,"b"]) |= 5) catch .', [
          [
            null,
            { b: 0 },
            { a: 0 },
            { a: null },
            { a: [0, 1] },
            { a: { b: 1 } },
            { a: [{}] },
            { a: [{ c: 3 }] }
          ]
        ])
      ).toEqual([
        { a: [{ b: 5 }] },
        { b: 0, a: [{ b: 5 }] },
        'Cannot index number with number',
        { a: [{ b: 5 }] },
        'Cannot index number with string "b"',
        'Cannot index object with number',
        { a: [{ b: 5 }] },
        { a: [{ c: 3, b: 5 }] }
      ]);
    });

    test('(.[] | select(. >= 2)) |= empty', () => {
      expect(parseAndQuery('(.[] | select(. >= 2)) |= empty', [[1, 5, 3, 0, 7]])).toEqual([[1, 0]]);
    });

    test('.[] |= select(. % 2 == 0)', () => {
      expect(parseAndQuery('.[] |= select(. % 2 == 0)', [[0, 1, 2, 3, 4, 5]])).toEqual([[0, 2, 4]]);
    });

    test('.foo[1,4,2,3] |= empty', () => {
      expect(parseAndQuery('.foo[1,4,2,3] |= empty', [{ foo: [0, 1, 2, 3, 4, 5] }])).toEqual([
        { foo: [0, 5] }
      ]);
    });

    test.skip('.[2][3] = 1', () => {
      expect(parseAndQuery('.[2][3] = 1', [[4]])).toEqual([[4, null, [null, null, null, 1]]]);
    });

    test('.foo[2].bar = 1', () => {
      expect(parseAndQuery('.foo[2].bar = 1', [{ foo: [11], bar: 42 }])).toEqual([
        { foo: [11, undefined, { bar: 1 }], bar: 42 }
      ]);
    });

    test.skip('try ((map(select(.a == 1))[].b) = 10) catch .', () => {
      expect(
        parseAndQuery('try ((map(select(.a == 1))[].b) = 10) catch .', [[{ a: 0 }, { a: 1 }]])
      ).toEqual(['Invalid path expression near attempt to iterate through [{"a":1}]']);
    });

    test.skip('try ((map(select(.a == 1))[].a) |= .+1) catch .', () => {
      expect(
        parseAndQuery('try ((map(select(.a == 1))[].a) |= .+1) catch .', [[{ a: 0 }, { a: 1 }]])
      ).toEqual(['Invalid path expression near attempt to iterate through [{"a":1}]']);
    });

    test('def x: .[1,2]; x=10', () => {
      expect(parseAndQuery('def x: .[1,2]; x=10', [[0, 1, 2]])).toEqual([[0, 10, 10]]);
    });

    // NOTE: Cannot be parsed properly
    test.skip('try (def x: reverse; x=10) catch .', () => {
      expect(parseAndQuery('try (def x: reverse; x=10) catch .', [[0, 1, 2]])).toEqual([
        'Invalid path expression with result [2,1,0]'
      ]);
    });

    test('.[] = 1', () => {
      expect(parseAndQuery('.[] = 1', [[1, null, Infinity, -Infinity, NaN, -NaN]])).toEqual([
        [1, 1, 1, 1, 1, 1]
      ]);
    });
  });

  // L1152
  describe('Conditionals', () => {
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

    test.skip('.[] //= .[0]', () => {
      expect(parseAndQuery('.[] //= .[0]', [['hello', true, false, [false], null]])).toEqual([
        ['hello', true, 'hello', [false], 'hello']
      ]);
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

    test('[contains(""), contains("\u0000")]', () => {
      expect(parseAndQuery('[contains(""), contains("\u0000")]', ['\u0000'])).toEqual([
        [true, true]
      ]);
    });

    test('[contains(""), contains("a"), contains("ab"), contains("c"), contains("d")]', () => {
      expect(
        parseAndQuery(
          '[contains(""), contains("a"), contains("ab"), contains("c"), contains("d")]',
          ['ab\u0000cd']
        )
      ).toEqual([[true, true, true, true, true]]);
    });

    test('[contains("cd"), contains("b\u0000"), contains("ab\u0000")]', () => {
      expect(
        parseAndQuery('[contains("cd"), contains("b\u0000"), contains("ab\u0000")]', ['ab\u0000cd'])
      ).toEqual([[true, true, true]]);
    });

    test('[contains("b\u0000c"), contains("b\u0000cd"), contains("b\u0000cd")]', () => {
      expect(
        parseAndQuery('[contains("b\u0000c"), contains("b\u0000cd"), contains("b\u0000cd")]', [
          'ab\u0000cd'
        ])
      ).toEqual([[true, true, true]]);
    });

    test('[contains("@"), contains("\u0000@"), contains("\u0000what")]', () => {
      expect(
        parseAndQuery('[contains("@"), contains("\u0000@"), contains("\u0000what")]', [
          'ab\u0000cd'
        ])
      ).toEqual([[false, false, false]]);
    });

    test('[.[]|try if . == 0 then error("foo") elif . == 1 then .a elif . == 2 then empty else . end catch .]', () => {
      const res = parseAndQuery(
        '[.[]|try if . == 0 then error("foo") elif . == 1 then .a elif . == 2 then empty else . end catch .]',
        [[0, 1, 2, 3]]
      ) as unknown[][];
      expect(res[0]![0]).toEqual('foo');
      expect(res[0]![1]).toBeInstanceOf(Error);
      expect(res[0]![2]).toEqual(3);
    });

    test.skip('[.[]|(.a, .a)?]', () => {
      expect(parseAndQuery('[.[]|(.a, .a)?]', [[null, true, { a: 1 }]])).toEqual([
        [null, null, 1, 1]
      ]);
    });

    test.skip('[[.[]|[.a,.a]]?]', () => {
      expect(parseAndQuery('[[.[]|[.a,.a]]?]', [[null, true, { a: 1 }]])).toEqual([[]]);
    });

    test.skip('.[] | try error catch .', () => {
      expect(parseAndQuery('.[] | try error catch .', [[1, null, 2]])).toEqual([1, undefined, 2]);
    });

    test.skip('try error("\\($__loc__)") catch .', () => {
      expect(parseAndQuery('try error("\\($__loc__)") catch .', [undefined])).toEqual([
        '{"file":"<top-level>","line":1}'
      ]);
    });
  });

  // L1299
  describe('string operations', () => {
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

    test('[(index(","), rindex(",")), indices(",")]', () => {
      expect(
        parseAndQuery('[(index(","), rindex(",")), indices(",")]', ['a,bc,def,ghij,klmno'])
      ).toEqual([[1, 13, [1, 4, 8, 13]]]);
    });

    test('[ index("aba"), rindex("aba"), indices("aba") ]', () => {
      expect(
        parseAndQuery('[ index("aba"), rindex("aba"), indices("aba") ]', ['xababababax'])
      ).toEqual([[1, 7, [1, 3, 5, 7]]]);
    });

    test('indices(1)', () => {
      expect(parseAndQuery('indices(1)', [[0, 1, 1, 2, 3, 4, 1, 5]])).toEqual([[1, 2, 6]]);
    });

    test('indices([1,2])', () => {
      expect(parseAndQuery('indices([1,2])', [[0, 1, 2, 3, 1, 4, 2, 5, 1, 2, 6, 7]])).toEqual([
        [1, 8]
      ]);
    });

    test('indices([1,2])', () => {
      expect(parseAndQuery('indices([1,2])', [[1]])).toEqual([[]]);
    });

    test('indices(", ")', () => {
      expect(parseAndQuery('indices(", ")', ['a,b, cd,e, fgh, ijkl'])).toEqual([[3, 9, 14]]);
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

    test('[.[] * 3]', () => {
      expect(parseAndQuery('[.[] * 3]', [['a', 'ab', 'abc']])).toEqual([
        ['aaa', 'ababab', 'abcabcabc']
      ]);
    });

    test('[.[] * "abc"]', () => {
      expect(parseAndQuery('[.[] * "abc"]', [[-1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 3.7, 10.0]])).toEqual(
        [
          [
            undefined,
            undefined,
            '',
            '',
            'abc',
            'abc',
            'abcabcabc',
            'abcabcabcabcabcabcabcabcabcabc'
          ]
        ]
      );
    });

    test('[. * (nan,-nan)]', () => {
      expect(parseAndQuery('[. * (nan,-nan)]', ['abc'])).toEqual([[undefined, undefined]]);
    });

    test('[.[] / ","]', () => {
      expect(
        parseAndQuery('[.[] / ","]', [
          ['a, bc, def, ghij, jklmn, a,b, c,d, e,f', 'a,b,c,d, e,f,g,h']
        ])
      ).toEqual([
        [
          ['a', ' bc', ' def', ' ghij', ' jklmn', ' a', 'b', ' c', 'd', ' e', 'f'],
          ['a', 'b', 'c', 'd', ' e', 'f', 'g', 'h']
        ]
      ]);
    });

    test('[.[] / ", "]', () => {
      expect(
        parseAndQuery('[.[] / ", "]', [
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

    test.skip('[({foo: 12, bar:13} | contains({foo: 12})), ({foo: 12} | contains({})), ({foo: 12, bar:13} | contains({baz:14}))]', () => {
      expect(
        parseAndQuery(
          '[({foo: 12, bar:13} | contains({foo: 12})), ({foo: 12} | contains({})), ({foo: 12, bar:13} | contains({baz:14}))]',
          [{}]
        )
      ).toEqual([[true, true, false]]);
    });

    test.skip('{foo: {baz: 12, blap: {bar: 13}}, bar: 14} | contains({bar: 14, foo: {blap: {}}})', () => {
      expect(
        parseAndQuery(
          '{foo: {baz: 12, blap: {bar: 13}}, bar: 14} | contains({bar: 14, foo: {blap: {}}})',
          [{}]
        )
      ).toEqual([true]);
    });

    test('{foo: {baz: 12, blap: {bar: 13}}, bar: 14} | contains({bar: 14, foo: {blap: {bar: 14}}})', () => {
      expect(
        parseAndQuery(
          '{foo: {baz: 12, blap: {bar: 13}}, bar: 14} | contains({bar: 14, foo: {blap: {bar: 14}}})',
          [{}]
        )
      ).toEqual([false]);
    });

    test('sort', () => {
      expect(
        parseAndQuery('sort', [
          [
            42,
            [2, 5, 3, 11],
            10,
            { a: 42, b: 2 },
            { a: 42 },
            true,
            2,
            [2, 6],
            'hello',
            null,
            [2, 5, 6],
            { a: [], b: 1 },
            'abc',
            'ab',
            [3, 10],
            {},
            false,
            'abcd',
            null
          ]
        ])
      ).toEqual([
        [
          null,
          null,
          false,
          true,
          2,
          10,
          42,
          'ab',
          'abc',
          'abcd',
          'hello',
          [2, 5, 3, 11],
          [2, 5, 6],
          [2, 6],
          [3, 10],
          {},
          { a: 42 },
          { a: 42, b: 2 },
          { a: [], b: 1 }
        ]
      ]);
    });

    test('(sort_by(.b) | sort_by(.a)), sort_by(.a, .b), sort_by(.b, .c), group_by(.b), group_by(.a + .b - .c == 2)', () => {
      expect(
        parseAndQuery(
          '(sort_by(.b) | sort_by(.a)), sort_by(.a, .b), sort_by(.b, .c), group_by(.b), group_by(.a + .b - .c == 2)',
          [
            [
              { a: 1, b: 4, c: 14 },
              { a: 4, b: 1, c: 3 },
              { a: 1, b: 4, c: 3 },
              { a: 0, b: 2, c: 43 }
            ]
          ]
        )
      ).toEqual([
        [
          { a: 0, b: 2, c: 43 },
          { a: 1, b: 4, c: 14 },
          { a: 1, b: 4, c: 3 },
          { a: 4, b: 1, c: 3 }
        ],
        [
          { a: 0, b: 2, c: 43 },
          { a: 1, b: 4, c: 14 },
          { a: 1, b: 4, c: 3 },
          { a: 4, b: 1, c: 3 }
        ],
        [
          { a: 4, b: 1, c: 3 },
          { a: 0, b: 2, c: 43 },
          { a: 1, b: 4, c: 3 },
          { a: 1, b: 4, c: 14 }
        ],
        [
          [{ a: 4, b: 1, c: 3 }],
          [{ a: 0, b: 2, c: 43 }],
          [
            { a: 1, b: 4, c: 14 },
            { a: 1, b: 4, c: 3 }
          ]
        ],
        [
          [
            { a: 1, b: 4, c: 14 },
            { a: 0, b: 2, c: 43 }
          ],
          [
            { a: 4, b: 1, c: 3 },
            { a: 1, b: 4, c: 3 }
          ]
        ]
      ]);
    });

    test('unique', () => {
      expect(parseAndQuery('unique', [[1, 2, 5, 3, 5, 3, 1, 3]])).toEqual([[1, 2, 3, 5]]);
      expect(parseAndQuery('unique', [[]])).toEqual([[]]);
    });

    test('[min, max, min_by(.[1]), max_by(.[1]), min_by(.[2]), max_by(.[2])]', () => {
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

    test('.foo[.baz]', () => {
      expect(parseAndQuery('.foo[.baz]', [{ foo: { bar: 4 }, baz: 'bar' }])).toEqual([4]);
    });

    test('.[] | .error = "no, it\'s OK"', () => {
      expect(parseAndQuery('.[] | .error = "no, it\'s OK"', [[{ error: true }]])).toEqual([
        { error: "no, it's OK" }
      ]);
    });

    test('[{a:1}] | .[] | .a=999', () => {
      expect(parseAndQuery('[{a:1}] | .[] | .a=999', [undefined])).toEqual([{ a: 999 }]);
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
            { Key: 'b', Value: 2 },
            { name: 'c', value: 3 },
            { Name: 'd', Value: 4 }
          ]
        ])
      ).toEqual([{ a: 1, b: 2, c: 3, d: 4 }]);
    });

    test.skip('with_entries(.key |= "KEY_" + .)', () => {
      expect(parseAndQuery('with_entries(.key |= "KEY_" + .)', [{ a: 1, b: 2 }])).toEqual([
        { KEY_a: 1, KEY_b: 2 }
      ]);
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

    test('has(nan)', () => {
      expect(parseAndQuery('has(nan)', [[1, 2, 3]])).toEqual([false]);
    });

    test('keys', () => {
      expect(parseAndQuery('keys', [[42, 3, 35]])).toEqual([[0, 1, 2]]);
    });

    test.skip('[][.]', () => {
      expect(parseAndQuery('[][.]', [1000000000000000000])).toEqual([undefined]);
    });

    // TODO: Missing object merge and type tests, L1468-L1488

    test('[.[]|arrays]', () => {
      expect(
        parseAndQuery('[.[]|arrays]', [[1, 2, 'foo', [], [3, []], {}, true, false, null]])
      ).toEqual([[[], [3, []]]]);
    });

    test('[.[]|objects]', () => {
      expect(
        parseAndQuery('[.[]|objects]', [[1, 2, 'foo', [], [3, []], {}, true, false, null]])
      ).toEqual([[{}]]);
    });

    test('[.[]|iterables]', () => {
      expect(
        parseAndQuery('[.[]|iterables]', [[1, 2, 'foo', [], [3, []], {}, true, false, null]])
      ).toEqual([[[], [3, []], {}]]);
    });

    test('[.[]|scalars]', () => {
      expect(
        parseAndQuery('[.[]|scalars]', [[1, 2, 'foo', [], [3, []], {}, true, false, null]])
      ).toEqual([[1, 2, 'foo', true, false, null]]);
    });

    // TODO: Check null vs undefined
    test('[.[]|values]', () => {
      expect(
        parseAndQuery('[.[]|values]', [[1, 2, 'foo', [], [3, []], {}, true, false, undefined]])
      ).toEqual([[1, 2, 'foo', [], [3, []], {}, true, false, undefined]]);
    });

    test('[.[]|booleans]', () => {
      expect(
        parseAndQuery('[.[]|booleans]', [[1, 2, 'foo', [], [3, []], {}, true, false, null]])
      ).toEqual([[true, false]]);
    });

    // TODO: Check null vs undefined
    test('[.[]|nulls]', () => {
      expect(
        parseAndQuery('[.[]|nulls]', [[1, 2, 'foo', [], [3, []], {}, true, false, null]])
      ).toEqual([[null]]);
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

    test('try flatten(-1) catch .', () => {
      expect(parseAndQuery('try flatten(-1) catch .', [[0, [1], [[2]], [[[3]]]]])).toEqual([
        new Error('206: ')
      ]);
    });

    test.skip('transpose', () => {
      expect(parseAndQuery('transpose', [[[1], [2, 3]]])).toEqual([
        [
          [1, 2],
          [null, 3]
        ]
      ]);
    });

    test.skip('transpose', () => {
      expect(parseAndQuery('transpose', [[]])).toEqual([[]]);
    });

    // TODO: Missing tests, mostly module stuff L1546-L1663

    // NOTE: We don't seem to support unary negation
    test.skip('try -. catch .', () => {
      expect(parseAndQuery('try -. catch .', ['very-long-string'])).toEqual([
        'string ("very-long-...) cannot be negated'
      ]);
    });

    test('join(",")', () => {
      expect(parseAndQuery('join(",")', [['1', 2, true, false, 3.4]])).toEqual([
        '1,2,true,false,3.4'
      ]);
    });

    test('.[] | join(",")', () => {
      expect(
        parseAndQuery('.[] | join(",")', [[[], [null], [null, null], [null, null, null]]])
      ).toEqual(['', '', ',', ',,']);
    });

    test('.[] | join(",")', () => {
      expect(
        parseAndQuery('.[] | join(",")', [
          [
            ['a', null],
            [null, 'a']
          ]
        ])
      ).toEqual(['a,', ',a']);
    });

    test.skip('try join(",") catch .', () => {
      expect(parseAndQuery('try join(",") catch .', [['1', '2', { a: { b: { c: 33 } } }]])).toEqual(
        ['string ("1,2,") and object ({"a":{"b":{...) cannot be added']
      );

      expect(parseAndQuery('try join(",") catch .', [['1', '2', [3, 4, 5]]])).toEqual([
        'string ("1,2,") and array ([3,4,5]) cannot be added'
      ]);
    });

    test('{if:0,and:1,or:2,then:3,else:4,elif:5,end:6,as:7,def:8,reduce:9,foreach:10,try:11,catch:12,label:13,import:14,include:15,module:16}', () => {
      expect(
        parseAndQuery(
          '{if:0,and:1,or:2,then:3,else:4,elif:5,end:6,as:7,def:8,reduce:9,foreach:10,try:11,catch:12,label:13,import:14,include:15,module:16}',
          [undefined]
        )
      ).toEqual([
        {
          if: 0,
          and: 1,
          or: 2,
          then: 3,
          else: 4,
          elif: 5,
          end: 6,
          as: 7,
          def: 8,
          reduce: 9,
          foreach: 10,
          try: 11,
          catch: 12,
          label: 13,
          import: 14,
          include: 15,
          module: 16
        }
      ]);
    });

    // TODO: Division by zero tests L1697-1715

    test.skip('[range(-52;52;1)] as $powers | [$powers[]|pow(2;.)|log2|round] == $powers', () => {
      expect(
        parseAndQuery('[range(-52;52;1)] as $powers | [$powers[]|pow(2;.)|log2|round] == $powers', [
          undefined
        ])
      ).toEqual([true]);
    });

    test.skip('[range(-99/2;99/2;1)] as $orig | [$orig[]|pow(2;.)|log2] as $back | ($orig|keys)[]|. as $k | (($orig|.[$k])-($back|.[$k]))|if . < 0 then . * -1 else . end|select(.>.00005)\n', () => {
      expect(
        parseAndQuery(
          '[range(-99/2;99/2;1)] as $orig | [$orig[]|pow(2;.)|log2] as $back | ($orig|keys)[]|. as $k | (($orig|.[$k])-($back|.[$k]))|if . < 0 then . * -1 else . end|select(.>.00005)\n',
          [undefined]
        )
      ).toEqual([]);
    });

    test.skip('(.[{}] = 0)?', () => {
      expect(parseAndQuery('(.[{}] = 0)?', [undefined])).toEqual([]);
    });

    test.skip('INDEX(range(5)|[., "foo\\(.)"]; .[0])', () => {
      expect(parseAndQuery('INDEX(range(5)|[., "foo\\(.)"]; .[0])', [undefined])).toEqual([
        { '0': [0, 'foo0'], '1': [1, 'foo1'], '2': [2, 'foo2'], '3': [3, 'foo3'], '4': [4, 'foo4'] }
      ]);
    });

    test.skip('JOIN({"0":[0,"abc"],"1":[1,"bcd"],"2":[2,"def"],"3":[3,"efg"],"4":[4,"fgh"]}; .[0]|tostring)', () => {
      expect(
        parseAndQuery(
          'JOIN({"0":[0,"abc"],"1":[1,"bcd"],"2":[2,"def"],"3":[3,"efg"],"4":[4,"fgh"]}; .[0]|tostring)',
          [
            [
              [5, 'foo'],
              [3, 'bar'],
              [1, 'foobar']
            ]
          ]
        )
      ).toEqual([
        [
          [[5, 'foo'], null],
          [
            [3, 'bar'],
            [3, 'efg']
          ],
          [
            [1, 'foobar'],
            [1, 'bcd']
          ]
        ]
      ]);
    });

    test('range(5;10)|IN(range(10))', () => {
      expect(parseAndQuery('range(5;10)|IN(range(10))', [undefined])).toEqual([
        true,
        true,
        true,
        true,
        true
      ]);
    });

    test('range(5;13)|IN(range(0;10;3))', () => {
      expect(parseAndQuery('range(5;13)|IN(range(0;10;3))', [undefined])).toEqual([
        false,
        true,
        false,
        false,
        true,
        false,
        false,
        false
      ]);
    });

    test('range(10;12)|IN(range(10))', () => {
      expect(parseAndQuery('range(10;12)|IN(range(10))', [undefined])).toEqual([false, false]);
    });

    test('IN(range(10;20); range(10))', () => {
      expect(parseAndQuery('IN(range(10;20); range(10))', [undefined])).toEqual([false]);
    });

    test('IN(range(5;20); range(10))', () => {
      expect(parseAndQuery('IN(range(5;20); range(10))', [undefined])).toEqual([true]);
    });

    test('(.a as $x | .b) = "b"', () => {
      expect(parseAndQuery('(.a as $x | .b) = "b"', [{ a: undefined, b: undefined }])).toEqual([
        { a: undefined, b: 'b' }
      ]);
    });

    test.skip('(.. | select(type == "object" and has("b") and (.b | type) == "array")|.b) |= .[0]', () => {
      expect(
        parseAndQuery(
          '(.. | select(type == "object" and has("b") and (.b | type) == "array")|.b) |= .[0]',
          [{ a: { b: [1, { b: 3 }] } }]
        )
      ).toEqual([{ a: { b: 1 } }]);
    });

    // TODO: Some tests on L1782-L1829

    test('map(. == 1)', () => {
      expect(parseAndQuery('map(. == 1)', [[1, 1.0, 1.0, 100e-2, 1, 0.0001e4]])).toEqual([
        [true, true, true, true, true, true]
      ]);
    });

    // TODO: Some tests related to big integers, L1839-L1877

    test('abs', () => {
      expect(parseAndQuery('abs', ['abc'])).toEqual(['abc']);
    });

    test('map(abs)', () => {
      expect(parseAndQuery('map(abs)', [[-0, 0, -10, -1.1]])).toEqual([[0, 0, 10, 1.1]]);
    });

    test('map(fabs == length) | unique', () => {
      expect(parseAndQuery('map(fabs == length) | unique', [[-10, -1.1, -1e-1]])).toEqual([[true]]);
    });

    // TODO: Keyword as value tests, L1899-L1917

    test('{ a, $__loc__, c }', () => {
      expect(
        parseAndQuery('{ a, $__loc__, c }', [{ a: [1, 2, 3], b: 'foo', c: { hi: 'hey' } }])
      ).toEqual([{ a: [1, 2, 3], __loc__: { file: '<top-level>', line: 1 }, c: { hi: 'hey' } }]);
    });

    test('1 as $x | "2" as $y | "3" as $z | { $x, as, $y: 4, ($z): 5, if: 6, foo: 7 }', () => {
      expect(
        parseAndQuery(
          '1 as $x | "2" as $y | "3" as $z | { $x, as, $y: 4, ($z): 5, if: 6, foo: 7 }',
          [{ as: 8 }]
        )
      ).toEqual([{ x: 1, as: 8, '2': 4, '3': 5, if: 6, foo: 7 }]);
    });

    test('fromjson | isnan', () => {
      expect(parseAndQuery('fromjson | isnan', ['"nan"'])).toEqual([true]);
    });

    test('tojson | fromjson', () => {
      expect(parseAndQuery('tojson | fromjson', [{ a: NaN }])).toEqual([{ a: null }]);
    });

    test('fromjson | isnan', () => {
      expect(parseAndQuery('fromjson | isnan', ['"nan1234"'])).toEqual([true]);
    });

    // TODO: input tests L1949-L1955
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
