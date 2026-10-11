import { describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import {
  dashboardKeyFromName,
  isValidDashboardKey,
  uniqueDashboardKey
} from './dashboardKey';

const dbWithKeys = (taken: Record<string, string>) =>
  ({
    dashboard: {
      getByKey: async (_workspace: string, _applicationId: string | null, key: string) =>
        key in taken ? { id: taken[key] } : null
    }
  }) as unknown as DatabaseAdapter;

describe('isValidDashboardKey', () => {
  it('accepts lowercase slugs', () => {
    expect(isValidDashboardKey('overview')).toBe(true);
    expect(isValidDashboardKey('vendor-risk-2')).toBe(true);
  });

  it('rejects anything else', () => {
    for (const key of ['', 'Overview', 'a b', '-a', 'a-', 'a--b', 'a/b']) {
      expect(isValidDashboardKey(key)).toBe(false);
    }
  });
});

describe('dashboardKeyFromName', () => {
  it('slugifies the name', () => {
    expect(dashboardKeyFromName('Security Posture & Risk')).toBe('security-posture-risk');
  });

  it('falls back when nothing usable remains', () => {
    expect(dashboardKeyFromName('日本')).toBe('dashboard');
  });
});

describe('uniqueDashboardKey', () => {
  it('returns the base when it is free', async () => {
    expect(await uniqueDashboardKey(dbWithKeys({}), 'w', null, 'overview')).toBe('overview');
  });

  it('suffixes on collision', async () => {
    const db = dbWithKeys({ overview: 'a', 'overview-2': 'b' });
    expect(await uniqueDashboardKey(db, 'w', null, 'overview')).toBe('overview-3');
  });

  it('does not collide with the dashboard being edited', async () => {
    expect(await uniqueDashboardKey(dbWithKeys({ overview: 'a' }), 'w', null, 'overview', 'a')).toBe(
      'overview'
    );
  });
});
