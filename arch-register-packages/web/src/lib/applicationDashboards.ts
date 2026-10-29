/** Anything with the identity of an application dashboard. */
type DashboardRef = { id: string; key: string };

/**
 * Finds the dashboard a URL segment refers to: by key, falling back to id so links created before
 * dashboards had keys keep working. Keys are only unique within an application, so callers pass
 * that application's dashboards.
 */
export const findDashboardByKeyOrId = <T extends DashboardRef>(
  dashboards: ReadonlyArray<T> | undefined,
  keyOrId: string
): T | undefined =>
  dashboards?.find(dashboard => dashboard.key === keyOrId) ??
  dashboards?.find(dashboard => dashboard.id === keyOrId);

/**
 * Id of the dashboard selected by the home `?dashboard=` param, which holds a shared dashboard's
 * key (or its id, for older links) or a personal dashboard's id. Defaults to the first shared one.
 */
export const resolveHomeDashboardId = (
  sharedDashboards: ReadonlyArray<DashboardRef> | undefined,
  param: string | undefined
): string | undefined =>
  param === undefined
    ? sharedDashboards?.[0]?.id
    : (findDashboardByKeyOrId(sharedDashboards, param)?.id ?? param);
