import { describe, expect, it } from 'vitest';
import { matchesFilterCondition } from './dataHelpers';
import type { EntityDbResult } from './db/catalogDatabase';

const baseEntity = (data: Record<string, unknown>): EntityDbResult => ({
  id: 'e1',
  workspace: 'w1',
  public_id: 'e1',
  slug: 'entity-1',
  namespace: 'ns',
  name: 'Entity 1',
  description: '',
  owner: null,
  lifecycle: null,
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: [],
  links: [],
  schema_id: 's1',
  data,
  project_id: null,
  created_at: new Date(),
  updated_at: new Date(),
  completeness: 100,
  owner_name: null,
  lifecycle_label: null,
  target_lifecycle_label: null,
  schema_name: 'Schema 1'
});

const daysFromNow = (n: number): string => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

describe('matchesFilterCondition with $now', () => {
  it('matches a past date with before $now', () => {
    const entity = baseEntity({ reviewDate: daysFromNow(-1) });
    expect(
      matchesFilterCondition(
        entity,
        { fieldId: 'reviewDate', op: 'before', value: { $now: true } },
        null
      )
    ).toBe(true);
  });

  it('does not match a future date with before $now', () => {
    const entity = baseEntity({ reviewDate: daysFromNow(1) });
    expect(
      matchesFilterCondition(
        entity,
        { fieldId: 'reviewDate', op: 'before', value: { $now: true } },
        null
      )
    ).toBe(false);
  });

  it('matches today with on $now', () => {
    const entity = baseEntity({ reviewDate: daysFromNow(0) });
    expect(
      matchesFilterCondition(
        entity,
        { fieldId: 'reviewDate', op: 'on', value: { $now: true } },
        null
      )
    ).toBe(true);
  });

  it('matches with a positive offset', () => {
    const entity = baseEntity({ reviewDate: daysFromNow(30) });
    expect(
      matchesFilterCondition(
        entity,
        { fieldId: 'reviewDate', op: 'on', value: { $now: true, offsetDays: 30 } },
        null
      )
    ).toBe(true);
  });

  it('matches with a negative offset', () => {
    const entity = baseEntity({ reviewDate: daysFromNow(-7) });
    expect(
      matchesFilterCondition(
        entity,
        { fieldId: 'reviewDate', op: 'on', value: { $now: true, offsetDays: -7 } },
        null
      )
    ).toBe(true);
  });

  it('does not silently fail-closed the way an unresolved marker would', () => {
    // Regression: before the $now resolver, `new Date(String({$now:true}))` produced an
    // Invalid Date, so every comparison always returned false regardless of the actual date.
    const entity = baseEntity({ reviewDate: daysFromNow(-1) });
    const matched = matchesFilterCondition(
      entity,
      { fieldId: 'reviewDate', op: 'before', value: { $now: true } },
      null
    );
    expect(matched).toBe(true);
  });
});
