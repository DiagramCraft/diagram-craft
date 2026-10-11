import { slugify } from '../../utils/http';
import type { DatabaseAdapter } from '../../db/database';

export const DASHBOARD_KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const isValidDashboardKey = (key: string): boolean => DASHBOARD_KEY_PATTERN.test(key);

/** Slug for a dashboard name, falling back to `dashboard` when nothing usable remains. */
export const dashboardKeyFromName = (name: string): string => slugify(name) || 'dashboard';

/**
 * Returns a key based on `base` that is unused in the given scope (the application, or the
 * workspace home dashboards when `applicationId` is null), appending `-2`, `-3`, ... on collision.
 */
export const uniqueDashboardKey = async (
  db: DatabaseAdapter,
  workspace: string,
  applicationId: string | null,
  base: string,
  excludeId?: string
): Promise<string> => {
  let candidate = base;
  let suffix = 2;
  for (;;) {
    const existing = await db.dashboard.getByKey(workspace, applicationId, candidate);
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
};
