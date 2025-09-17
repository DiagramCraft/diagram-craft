import { describe, it, expect } from 'vitest';
import { Util } from './utils';

describe('Util.iterateRegex', () => {
  it('should call fn for text before, each match, and trailing text', () => {
    const parts: (string | RegExpExecArray)[] = [];
    const re = /X/g;
    const s = 'aXbXXc';

    Util.iterateRegex(re, s, m => {
      parts.push(m);
    });

    // Expected sequence: 'a', match('X' at 1), 'b', match('X' at 3), match('X' at 4), 'c'
    expect(parts.length).toBe(6);
    expect(typeof parts[0]).toBe('string');
    expect(parts[0]).toBe('a');

    expect(typeof parts[1]).toBe('object');
    const m1 = parts[1] as RegExpExecArray;
    expect(m1[0]).toBe('X');
    expect(m1.index).toBe(1);

    expect(parts[2]).toBe('b');

    const m2 = parts[3] as RegExpExecArray;
    expect(m2[0]).toBe('X');
    expect(m2.index).toBe(3);

    const m3 = parts[4] as RegExpExecArray;
    expect(m3[0]).toBe('X');
    expect(m3.index).toBe(4);

    expect(parts[5]).toBe('c');
  });

  it('should call fn once with whole string when there are no matches', () => {
    const calls: (string | RegExpExecArray)[] = [];
    const re = /Z/g;
    const s = 'no matches here';

    Util.iterateRegex(re, s, m => {
      calls.push(m);
    });

    expect(calls).toEqual([s]);
  });

  it('should allow adjusting the logical match length to influence gap handling', () => {
    // By returning a larger length than the actual match, the text between the first and second
    // match can be suppressed. Example: 'xx123yy456zz' with /\d+/g, returning 5 for the first
    // match (actual length 3) will make the iterator treat the first match as length 5, thus
    // consuming the following 'yy' as part of the match window and not emitting it as a text segment.
    const texts: string[] = [];
    const matchIndices: number[] = [];
    const re = /\d+/g;
    let first = true;

    Util.iterateRegex(re, 'xx123yy456zz', m => {
      if (typeof m === 'string') {
        texts.push(m);
      } else {
        matchIndices.push(m.index);
        if (first) {
          first = false;
          return 5; // extend logical length for the first match by 2 chars
        }
      }
    });

    // We should have two text segments: 'xx' before the first match and 'zz' after the last match
    expect(texts).toEqual(['xx', 'zz']);
    // And two matches at indices 2 and 7
    expect(matchIndices).toEqual([2, 7]);
  });
});

describe('Util.findBalancedSubstring', () => {
  it('should return the simple balanced substring', () => {
    expect(Util.findBalancedSubstring('[abc]def', '[', ']')).toBe('[abc]');
  });

  it('should handle nested balanced substrings', () => {
    expect(Util.findBalancedSubstring('[a[b]c]d', '[', ']')).toBe('[a[b]c]');
    expect(Util.findBalancedSubstring('[[inner]outer]x', '[', ']')).toBe('[[inner]outer]');
  });

  it('should return null when not starting with start char or empty string', () => {
    expect(Util.findBalancedSubstring('a[b]c', '[', ']')).toBeNull();
    expect(Util.findBalancedSubstring('', '[', ']')).toBeNull();
  });

  it('should return null when substring is not balanced (no closing)', () => {
    expect(Util.findBalancedSubstring('[unbalanced', '[', ']')).toBeNull();
    expect(Util.findBalancedSubstring('[still[unbalanced', '[', ']')).toBeNull();
  });
});
