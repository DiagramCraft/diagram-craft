import { describe, expect, test } from 'vitest';
import { Path } from './path';

describe('Path', () => {
  test('rejects smooth quadratic segments without a preceding quadratic segment', () => {
    expect(
      () =>
        new Path({ x: 0, y: 0 }, [
          ['L', 10, 0],
          ['T', 20, 0]
        ]).segments
    ).toThrow('T segment requires a preceding quadratic segment');
  });

  test('joins contiguous paths', () => {
    const first = new Path({ x: 0, y: 0 }, [['L', 10, 0]]);
    const second = new Path({ x: 10, y: 0 }, [['L', 20, 0]]);

    const joined = Path.join(first, second);

    expect(joined.start).toEqual({ x: 0, y: 0 });
    expect(joined.end).toEqual({ x: 20, y: 0 });
    expect(joined.raw).toEqual([
      ['L', 10, 0],
      ['L', 20, 0]
    ]);
  });

  test('rejects non-contiguous paths', () => {
    const first = new Path({ x: 0, y: 0 }, [['L', 10, 0]]);
    const second = new Path({ x: 11, y: 0 }, [['L', 20, 0]]);

    expect(() => Path.join(first, second)).toThrow('Joined paths must be contiguous');
  });
});
