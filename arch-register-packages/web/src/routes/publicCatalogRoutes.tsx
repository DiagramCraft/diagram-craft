import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { PublicCatalogLayout } from '../publicCatalog/PublicCatalogLayout';
import {
  PublicCatalogApiPage,
  PublicCatalogEntities,
  PublicCatalogEntityPage,
  PublicCatalogHome,
  PublicCatalogWikiPage
} from '../publicCatalog/PublicCatalogScreens';

export const createPublicCatalogRoutes = <TParentRoute extends AnyRoute>(
  rootRoute: TParentRoute
) => {
  const route = createRoute({
    getParentRoute: () => rootRoute,
    path: '/public/$workspaceSlug',
    component: PublicCatalogLayout
  });
  const home = createRoute({
    getParentRoute: () => route,
    path: '/',
    component: PublicCatalogHome
  });
  const entities = createRoute({
    getParentRoute: () => route,
    path: 'entities',
    component: PublicCatalogEntities
  });
  const entity = createRoute({
    getParentRoute: () => route,
    path: 'entities/$entityPublicId',
    component: PublicCatalogEntityPage
  });
  const wiki = createRoute({
    getParentRoute: () => route,
    path: 'wiki',
    component: PublicCatalogWikiPage,
    validateSearch: (search: Record<string, unknown>) => ({
      path: typeof search.path === 'string' ? search.path : ''
    })
  });
  const api = createRoute({
    getParentRoute: () => route,
    path: 'api/$entityPublicId/$artifactId/$revisionId',
    component: PublicCatalogApiPage
  });
  return route.addChildren([home, entities, entity, wiki, api]);
};
