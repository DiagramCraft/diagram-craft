import { describe, expect, it } from 'vitest';
import { findDashboardByKeyOrId, resolveHomeDashboardId } from './applicationDashboards';

describe('findDashboardByKeyOrId', () => {
  const dashboards = [
    { id: 'id-1', key: 'overview' },
    { id: 'id-2', key: 'vendors' }
  ];

  it('matches by key', () => {
    expect(findDashboardByKeyOrId(dashboards, 'vendors')?.id).toBe('id-2');
  });

  it('falls back to id for old links', () => {
    expect(findDashboardByKeyOrId(dashboards, 'id-1')?.key).toBe('overview');
  });

  it('prefers a key match over an id match', () => {
    const clash = [
      { id: 'a', key: 'b' },
      { id: 'b', key: 'c' }
    ];
    expect(findDashboardByKeyOrId(clash, 'b')?.id).toBe('a');
  });

  it('returns undefined when nothing matches or the list is missing', () => {
    expect(findDashboardByKeyOrId(dashboards, 'nope')).toBeUndefined();
    expect(findDashboardByKeyOrId(undefined, 'overview')).toBeUndefined();
  });
});

describe('resolveHomeDashboardId', () => {
  const shared = [
    { id: 'id-1', key: 'overview' },
    { id: 'id-2', key: 'ops' }
  ];

  it('defaults to the first shared dashboard', () => {
    expect(resolveHomeDashboardId(shared, undefined)).toBe('id-1');
  });

  it('resolves a shared key or id to its id', () => {
    expect(resolveHomeDashboardId(shared, 'ops')).toBe('id-2');
    expect(resolveHomeDashboardId(shared, 'id-2')).toBe('id-2');
  });

  it('passes other values through as personal dashboard ids', () => {
    expect(resolveHomeDashboardId(shared, 'personal-1')).toBe('personal-1');
  });
});
