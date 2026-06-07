import { describe, expect, it } from 'vitest';
import { HTTPError } from 'h3';
import { httpAssert } from './httpAssert';

const statusOf = (fn: () => void): number => {
  try {
    fn();
    throw new Error('should have thrown');
  } catch (e) {
    return (e as HTTPError).statusCode;
  }
};

// ── httpAssert.json ───────────────────────────────────────────

describe('httpAssert.json', () => {
  it('does not throw for a plain object', () => {
    expect(() => httpAssert.json({ a: 1 })).not.toThrow();
  });

  it('throws 400 for null', () => {
    expect(statusOf(() => httpAssert.json(null))).toBe(400);
  });

  it('throws 400 for undefined', () => {
    expect(statusOf(() => httpAssert.json(undefined))).toBe(400);
  });

  it('throws 400 for a primitive string', () => {
    expect(statusOf(() => httpAssert.json('string'))).toBe(400);
  });

  it('uses custom status when provided', () => {
    expect(statusOf(() => httpAssert.json(null, { status: 404, message: 'nope' }))).toBe(404);
  });
});

// ── httpAssert.present ────────────────────────────────────────

describe('httpAssert.present', () => {
  it('does not throw for a truthy value', () => {
    expect(() => httpAssert.present('value')).not.toThrow();
  });

  it('does not throw for zero (non-null)', () => {
    expect(() => httpAssert.present(0)).not.toThrow();
  });

  it('throws 400 for null', () => {
    expect(statusOf(() => httpAssert.present(null))).toBe(400);
  });

  it('throws 400 for undefined', () => {
    expect(statusOf(() => httpAssert.present(undefined))).toBe(400);
  });
});

// ── httpAssert.array ──────────────────────────────────────────

describe('httpAssert.array', () => {
  it('does not throw for an empty array', () => {
    expect(() => httpAssert.array([])).not.toThrow();
  });

  it('does not throw for a non-empty array', () => {
    expect(() => httpAssert.array([1, 2, 3])).not.toThrow();
  });

  it('throws 400 for null', () => {
    expect(statusOf(() => httpAssert.array(null))).toBe(400);
  });

  it('throws 400 for undefined', () => {
    expect(statusOf(() => httpAssert.array(undefined))).toBe(400);
  });

  it('throws 400 for a plain object', () => {
    expect(statusOf(() => httpAssert.array({}))).toBe(400);
  });
});

// ── httpAssert.string ─────────────────────────────────────────

describe('httpAssert.string', () => {
  it('does not throw for a non-empty string', () => {
    expect(() => httpAssert.string('hello')).not.toThrow();
  });

  it('throws 400 for empty string', () => {
    expect(statusOf(() => httpAssert.string(''))).toBe(400);
  });

  it('throws 400 for null', () => {
    expect(statusOf(() => httpAssert.string(null))).toBe(400);
  });

  it('throws 400 for a number', () => {
    expect(statusOf(() => httpAssert.string(42))).toBe(400);
  });
});

// ── httpAssert.boolean ────────────────────────────────────────

describe('httpAssert.boolean', () => {
  it('does not throw for true', () => {
    expect(() => httpAssert.boolean(true)).not.toThrow();
  });

  it('does not throw for false', () => {
    expect(() => httpAssert.boolean(false)).not.toThrow();
  });

  it('throws 400 for a string', () => {
    expect(statusOf(() => httpAssert.boolean('true'))).toBe(400);
  });

  it('throws 400 for null', () => {
    expect(statusOf(() => httpAssert.boolean(null))).toBe(400);
  });

  it('throws 400 for a number', () => {
    expect(statusOf(() => httpAssert.boolean(1))).toBe(400);
  });
});

// ── httpAssert.true ───────────────────────────────────────────

describe('httpAssert.true', () => {
  it('does not throw for true', () => {
    expect(() => httpAssert.true(true)).not.toThrow();
  });

  it('throws 400 for false', () => {
    expect(statusOf(() => httpAssert.true(false))).toBe(400);
  });

  it('throws 400 for null', () => {
    expect(statusOf(() => httpAssert.true(null))).toBe(400);
  });

  it('throws 400 for empty string', () => {
    expect(statusOf(() => httpAssert.true(''))).toBe(400);
  });

  it('does not throw for a truthy value', () => {
    expect(() => httpAssert.true('non-empty')).not.toThrow();
  });
});
