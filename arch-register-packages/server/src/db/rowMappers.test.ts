import { describe, expect, it } from 'vitest';
import { databaseDateOnly } from './rowMappers';

describe('databaseDateOnly', () => {
  it('formats a postgres.js Date (UTC midnight) as YYYY-MM-DD', () => {
    expect(databaseDateOnly(new Date('2030-07-01T00:00:00.000Z'))).toBe('2030-07-01');
  });

  it('passes through a sqlite TEXT date string unchanged', () => {
    expect(databaseDateOnly('2030-07-01')).toBe('2030-07-01');
  });

  it('truncates a full timestamp string to just the date portion', () => {
    expect(databaseDateOnly('2030-07-01T12:34:56.000Z')).toBe('2030-07-01');
  });
});
