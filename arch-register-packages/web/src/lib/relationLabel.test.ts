import { describe, expect, it } from 'vitest';
import { relationLabel } from './relationLabel';

describe('relationLabel', () => {
  it('joins the in and out entity names with an arrow', () => {
    expect(relationLabel({ _in: { name: 'Billing' }, _out: { name: 'Payments' } })).toBe(
      'Billing → Payments'
    );
  });
});
