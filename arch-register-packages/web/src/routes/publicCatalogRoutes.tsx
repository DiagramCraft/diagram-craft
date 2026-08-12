import { createRoute, type AnyRoute } from '@tanstack/react-router';
import { PublicCatalogLayout } from '../publicCatalog/PublicCatalogLayout';
import {
  PublicCatalogApiPage,
  PublicCatalogEntities,
  PublicCatalogEntityPage,
  PublicCatalogHome,
  PublicCatalogWikiPage
} from '../publicCatalog/PublicCatalogScreens';
import {
  PublicCatalogTopology,
  PublicCatalogTopologyPicker
} from '../publicCatalog/PublicCatalogTopology';

const parseTopologyDepth = (value: unknown): number | undefined => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 3 ? parsed : undefined;
};

const parseTopologyDirection = (value: unknown) =>
  value === 'incoming' || value === 'outgoing' || value === 'both' ? value : undefined;

type PublicCatalogTopologySearch = {
  depth?: number;
  direction?: 'incoming' | 'outgoing' | 'both';
  q?: string;
  schema?: string;
  relation?: string;
};

type PublicCatalogTopologyPickerSearch = {
  q?: string;
};

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
  const topologyPicker = createRoute({
    getParentRoute: () => route,
    path: 'topology',
    component: PublicCatalogTopologyPicker,
    validateSearch: (search: Record<string, unknown>): PublicCatalogTopologyPickerSearch => ({
      q: typeof search.q === 'string' ? search.q : undefined
    })
  });
  const topology = createRoute({
    getParentRoute: () => route,
    path: 'topology/$entityPublicId',
    component: PublicCatalogTopology,
    validateSearch: (search: Record<string, unknown>): PublicCatalogTopologySearch => ({
      depth: parseTopologyDepth(search.depth),
      direction: parseTopologyDirection(search.direction),
      q: typeof search.q === 'string' ? search.q : undefined,
      schema: typeof search.schema === 'string' ? search.schema : undefined,
      relation: typeof search.relation === 'string' ? search.relation : undefined
    })
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
  return route.addChildren([home, entities, entity, topologyPicker, topology, wiki, api]);
};
