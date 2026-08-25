import { describe, expect, it } from 'vitest';
import {
  defineSearchParamSchema,
  enumCodec,
  mapCodec,
  numberInRangeCodec,
  omitDefaultCodec,
  parseSearchParams,
  positivePageCodec,
  stringCodec
} from './searchParamCodecs';

describe('search parameter codecs', () => {
  it('accepts strings and rejects non-string values', () => {
    expect(stringCodec.decode('query')).toBe('query');
    expect(stringCodec.decode(123)).toBeUndefined();
    expect(stringCodec.decode(null)).toBeUndefined();
  });

  it('accepts only configured enum values', () => {
    const codec = enumCodec(['table', 'graph'] as const);

    expect(codec.decode('graph')).toBe('graph');
    expect(codec.decode('cards')).toBeUndefined();
    expect(codec.decode(123)).toBeUndefined();
  });

  it('maps legacy values through a reusable codec', () => {
    const codec = mapCodec(enumCodec(['home', 'filters'] as const), value =>
      value === 'filters' ? 'home' : value
    );

    expect(codec.decode('home')).toBe('home');
    expect(codec.decode('filters')).toBe('home');
    expect(codec.decode('views')).toBeUndefined();
  });

  it('normalizes positive page values and rejects invalid pages', () => {
    expect(positivePageCodec.decode('2')).toBe(2);
    expect(positivePageCodec.decode(3)).toBe(3);
    expect(positivePageCodec.decode('0')).toBeUndefined();
    expect(positivePageCodec.decode('-1')).toBeUndefined();
    expect(positivePageCodec.decode('1.5')).toBeUndefined();
    expect(positivePageCodec.decode('9007199254740992')).toBeUndefined();
  });

  it('normalizes bounded numbers and omits configured defaults', () => {
    const codec = numberInRangeCodec({ min: 1, max: 10, defaultValue: 5, integer: true });

    expect(codec.decode('3')).toBe(3);
    expect(codec.decode(10)).toBe(10);
    expect(codec.decode('5')).toBeUndefined();
    expect(codec.decode('1.5')).toBeUndefined();
    expect(codec.decode('11')).toBeUndefined();
    expect(codec.decode('Infinity')).toBeUndefined();
    expect(codec.decode('')).toBeUndefined();
  });

  it('omits a default enum value while retaining the normalized alternative', () => {
    const codec = omitDefaultCodec(enumCodec(['default', 'alternative'] as const), 'default');

    expect(codec.decode('default')).toBeUndefined();
    expect(codec.decode('alternative')).toBe('alternative');
    expect(codec.decode('unknown')).toBeUndefined();
  });

  it('parses only declared fields and validates each field independently', () => {
    const schema = defineSearchParamSchema({
      q: stringCodec,
      category: enumCodec(['entities', 'projects'] as const)
    });

    expect(
      parseSearchParams(schema, {
        q: 'api',
        category: 'unknown',
        extra: 'ignored'
      })
    ).toEqual({ q: 'api', category: undefined });
  });
});
