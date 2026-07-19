import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime } from './dateFormat';

describe('date formatting', () => {
  it('parses date-only values at local midnight', () => {
    expect(formatDate('2024-01-02')).toBe(new Date(2024, 0, 2).toLocaleDateString());
  });

  it('uses the supplied fallback for missing values', () => {
    expect(formatDate(null, 'Never')).toBe('Never');
    expect(formatDateTime(null, 'Never')).toBe('Never');
  });
});
