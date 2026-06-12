import { createRoute } from '@tanstack/react-router';
import { SearchScreen } from '../../sections/search/SearchScreen';
import { validateSearchSearch } from '../searchParams';
import { buildSearchBreadcrumbs } from '../../layouts/workspaceShellDescriptors';
import { withWorkspaceShell } from './workspaceShellRoute';

export const createSearchWorkspaceRoute = (
  // biome-ignore lint/suspicious/noExplicitAny: TanStack route parent generics are cumbersome to thread through these factories
  workspaceRoute: any
): object[] => {
  const route = withWorkspaceShell(createRoute({
    getParentRoute: () => workspaceRoute,
    path: 'search',
    validateSearch: validateSearchSearch,
    component: SearchScreen
  }), ctx => ({
    variant: 'full-bleed',
    activeRailItem: 'search',
    breadcrumbs: buildSearchBreadcrumbs(ctx)
  }));

  return [route];
};
