import { describe, expect, it } from 'vitest';
import { HTTPError } from 'h3';
import { DatabaseError } from '../db/database';
import { handleDbError, parsePositiveInt, slugify } from './http';

// ── slugify ───────────────────────────────────────────────────

describe('slugify', () => {
  it('lowercases the input', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('replaces spaces with hyphens', () => {
    expect(slugify('foo bar')).toBe('foo-bar');
  });

  it('replaces special characters with hyphens', () => {
    expect(slugify('foo!@#bar')).toBe('foo-bar');
  });

  it('collapses multiple separators into one hyphen', () => {
    expect(slugify('foo  --  bar')).toBe('foo-bar');
  });

  it('strips leading and trailing hyphens', () => {
    expect(slugify('--foo--')).toBe('foo');
  });

  it('preserves numbers', () => {
    expect(slugify('API v2 service')).toBe('api-v2-service');
  });

  it('returns empty string for all-special input', () => {
    expect(slugify('!!!---')).toBe('');
  });
});

// ── parsePositiveInt ──────────────────────────────────────────

describe('parsePositiveInt', () => {
  it('returns null for null input', () => {
    expect(parsePositiveInt(null, 'page')).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(parsePositiveInt(undefined, 'page')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parsePositiveInt('', 'page')).toBeNull();
  });

  it('parses a valid positive integer', () => {
    expect(parsePositiveInt('5', 'page')).toBe(5);
  });

  it('accepts zero', () => {
    expect(parsePositiveInt('0', 'page')).toBe(0);
  });

  it('parses a numeric value directly', () => {
    expect(parsePositiveInt(10, 'page')).toBe(10);
  });

  it('throws HTTPError 400 for negative numbers', () => {
    expect(() => parsePositiveInt('-1', 'page')).toThrow(HTTPError);
    try {
      parsePositiveInt('-1', 'page');
    } catch (e) {
      expect((e as HTTPError).statusCode).toBe(400);
    }
  });

  it('throws HTTPError 400 for non-numeric strings', () => {
    expect(() => parsePositiveInt('abc', 'page')).toThrow(HTTPError);
  });
});

// ── handleDbError ─────────────────────────────────────────────

describe('handleDbError', () => {
  it('re-throws existing HTTPError unchanged', () => {
    const original = new HTTPError({ status: 404, message: 'not found' });
    expect(() => handleDbError(original, 'fallback')).toThrow(original);
  });

  it('throws 500 for unknown errors', () => {
    try {
      handleDbError(new Error('boom'), 'something went wrong');
    } catch (e) {
      expect((e as HTTPError).statusCode).toBe(500);
      expect((e as HTTPError).message).toBe('something went wrong');
    }
  });

  it('throws 409 for unique constraint error when mapped', () => {
    const err = new DatabaseError('unique', 'duplicate key');
    try {
      handleDbError(err, 'fallback', { unique: 'Already exists' });
    } catch (e) {
      expect((e as HTTPError).statusCode).toBe(409);
      expect((e as HTTPError).message).toBe('Already exists');
    }
  });

  it('throws 409 for foreign key error when mapped', () => {
    const err = new DatabaseError('foreign', 'fk violation');
    try {
      handleDbError(err, 'fallback', { foreign: 'Referenced record missing' });
    } catch (e) {
      expect((e as HTTPError).statusCode).toBe(409);
    }
  });

  it('throws 400 for check constraint error when mapped', () => {
    const err = new DatabaseError('check', 'check constraint');
    try {
      handleDbError(err, 'fallback', { check: 'Invalid value' });
    } catch (e) {
      expect((e as HTTPError).statusCode).toBe(400);
    }
  });

  it('throws 500 for DatabaseError when code is not in the mapping', () => {
    const err = new DatabaseError('unique', 'dup');
    try {
      handleDbError(err, 'fallback', {});
    } catch (e) {
      expect((e as HTTPError).statusCode).toBe(500);
    }
  });

  it('throws 500 for DatabaseError with no mapping provided', () => {
    const err = new DatabaseError('unique', 'dup');
    try {
      handleDbError(err, 'fallback');
    } catch (e) {
      expect((e as HTTPError).statusCode).toBe(500);
    }
  });
});
