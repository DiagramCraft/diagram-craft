import { useNavigate, useSearch } from '@tanstack/react-router';
import type { EntityDrawerSearchParams } from '../../../routes/searchParams';

/**
 * App-wide entry point for opening any entity's drawer. Backed by the `drawer` search param
 * declared on the parent `$workspaceSlug` route, so it works from any screen without a
 * per-screen route param, and the current screen's own search state (filters, sort, ...)
 * survives opening/closing the drawer unchanged. `WorkspaceLayout` is the single place that
 * renders the resulting `EntityDrawer`.
 */
export const useEntityDrawer = () => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as EntityDrawerSearchParams;

  // `to` is intentionally omitted so the drawer opens/closes on whatever route is currently
  // active, preserving that screen's own search state (filters, sort, ...) untouched; TanStack's
  // navigate typing can't narrow a search-param patch to an unspecified destination route, hence
  // the cast.
  const openEntityDrawer = (entityId: string) =>
    navigate({
      search: (previous: Record<string, unknown>) => ({ ...previous, drawer: entityId })
    } as Parameters<typeof navigate>[0]);

  const closeEntityDrawer = () =>
    navigate({
      search: (previous: Record<string, unknown>) => ({ ...previous, drawer: undefined })
    } as Parameters<typeof navigate>[0]);

  return { drawerEntityId: search.drawer, openEntityDrawer, closeEntityDrawer };
};
