import { ORPCError } from '@orpc/server';
import { describe, expect, it } from 'vitest';
import { orpcAssert } from './orpcAssert';

const errorOf = (fn: () => void): unknown => {
  try {
    fn();
    throw new Error('should have thrown');
  } catch (error) {
    expect(error).toBeInstanceOf(ORPCError);
    return error;
  }
};

describe('orpcAssert.json', () => {
  it('accepts objects and arrays', () => {
    expect(() => orpcAssert.json({ a: 1 })).not.toThrow();
    expect(() => orpcAssert.json([])).not.toThrow();
  });

  it('rejects null and primitives', () => {
    expect(errorOf(() => orpcAssert.json(null))).toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Required value must be valid JSON object'
    });
    expect(errorOf(() => orpcAssert.json('string'))).toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('orpcAssert.present', () => {
  it('accepts non-null values, including false and zero', () => {
    expect(() => orpcAssert.present(false)).not.toThrow();
    expect(() => orpcAssert.present(0)).not.toThrow();
  });

  it('rejects null and undefined', () => {
    expect(errorOf(() => orpcAssert.present(null))).toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Required value is missing'
    });
    expect(errorOf(() => orpcAssert.present(undefined))).toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('orpcAssert.true', () => {
  it('accepts true and rejects other falsy values', () => {
    expect(() => orpcAssert.true(true)).not.toThrow();
    expect(errorOf(() => orpcAssert.true(false))).toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('orpcAssert.string', () => {
  it('accepts non-empty strings', () => {
    expect(() => orpcAssert.string('value')).not.toThrow();
  });

  it('rejects empty strings and non-strings', () => {
    expect(errorOf(() => orpcAssert.string(''))).toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Required string is missing'
    });
    expect(errorOf(() => orpcAssert.string(42))).toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('orpcAssert.boolean', () => {
  it('accepts both boolean values', () => {
    expect(() => orpcAssert.boolean(true)).not.toThrow();
    expect(() => orpcAssert.boolean(false)).not.toThrow();
  });

  it('rejects non-booleans', () => {
    expect(errorOf(() => orpcAssert.boolean('true'))).toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Required value must be a boolean'
    });
  });
});

describe('orpcAssert.array', () => {
  it('accepts empty and non-empty arrays', () => {
    expect(() => orpcAssert.array([])).not.toThrow();
    expect(() => orpcAssert.array([1, 2, 3])).not.toThrow();
  });

  it('rejects null, undefined, and non-arrays', () => {
    expect(errorOf(() => orpcAssert.array(null))).toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Required value must be an array'
    });
    expect(errorOf(() => orpcAssert.array(undefined))).toMatchObject({ code: 'BAD_REQUEST' });
    expect(errorOf(() => orpcAssert.array({}))).toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('orpcAssert error input', () => {
  it('uses custom code and message', () => {
    expect(
      errorOf(() => orpcAssert.present(null, { code: 'NOT_FOUND', message: 'Missing' }))
    ).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Missing'
    });
  });
});
