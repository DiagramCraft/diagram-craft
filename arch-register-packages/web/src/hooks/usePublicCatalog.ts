import { useQuery } from '@tanstack/react-query';
import type {
  PublicCatalogEntity,
  PublicCatalogEntityList,
  PublicCatalogManifest,
  PublicCatalogTopology,
  PublicCatalogWikiPage
} from '@arch-register/api-types/publicCatalogContract';
import { publicCatalogRequest } from '../lib/orpcClient';

const publicPath = (workspaceSlug: string) => encodeURIComponent(workspaceSlug);

export const publicCatalogKeys = {
  all: ['public-catalog'] as const,
  manifest: (workspaceSlug: string) =>
    [...publicCatalogKeys.all, 'manifest', workspaceSlug] as const,
  entities: (workspaceSlug: string, q?: string, schema?: string, limit?: number, offset?: number) =>
    [
      ...publicCatalogKeys.all,
      'entities',
      workspaceSlug,
      q ?? '',
      schema ?? '',
      limit ?? 50,
      offset ?? 0
    ] as const,
  entity: (workspaceSlug: string, entityPublicId: string) =>
    [...publicCatalogKeys.all, 'entity', workspaceSlug, entityPublicId] as const,
  topology: (workspaceSlug: string, entityPublicId: string, depth: number, direction: string) =>
    [
      ...publicCatalogKeys.all,
      'topology',
      workspaceSlug,
      entityPublicId,
      depth,
      direction
    ] as const,
  wiki: (workspaceSlug: string, path: string) =>
    [...publicCatalogKeys.all, 'wiki', workspaceSlug, path] as const
};

export const usePublicCatalogManifest = (workspaceSlug: string) =>
  useQuery({
    queryKey: publicCatalogKeys.manifest(workspaceSlug),
    queryFn: () =>
      publicCatalogRequest<PublicCatalogManifest>(`/${publicPath(workspaceSlug)}/manifest`),
    enabled: Boolean(workspaceSlug),
    staleTime: 60_000
  });

export const usePublicCatalogEntities = (
  workspaceSlug: string,
  options: { q?: string; schema?: string; limit?: number; offset?: number } = {}
) =>
  useQuery({
    queryKey: publicCatalogKeys.entities(
      workspaceSlug,
      options.q,
      options.schema,
      options.limit,
      options.offset
    ),
    queryFn: () => {
      const query = new URLSearchParams();
      if (options.q) query.set('q', options.q);
      if (options.schema) query.set('schema', options.schema);
      if (options.limit) query.set('limit', String(options.limit));
      if (options.offset) query.set('offset', String(options.offset));
      return publicCatalogRequest<PublicCatalogEntityList>(
        `/${publicPath(workspaceSlug)}/entities${query.size ? `?${query}` : ''}`
      );
    },
    enabled: Boolean(workspaceSlug),
    staleTime: 30_000
  });

export const usePublicCatalogEntity = (workspaceSlug: string, entityPublicId: string) =>
  useQuery({
    queryKey: publicCatalogKeys.entity(workspaceSlug, entityPublicId),
    queryFn: () =>
      publicCatalogRequest<PublicCatalogEntity>(
        `/${publicPath(workspaceSlug)}/entities/${encodeURIComponent(entityPublicId)}`
      ),
    enabled: Boolean(workspaceSlug && entityPublicId),
    staleTime: 30_000
  });

export const usePublicCatalogTopology = (
  workspaceSlug: string,
  entityPublicId: string,
  options: { depth: number; direction: 'both' | 'incoming' | 'outgoing' }
) =>
  useQuery({
    queryKey: publicCatalogKeys.topology(
      workspaceSlug,
      entityPublicId,
      options.depth,
      options.direction
    ),
    queryFn: () =>
      publicCatalogRequest<PublicCatalogTopology>(
        `/${publicPath(workspaceSlug)}/topology/${encodeURIComponent(entityPublicId)}?depth=${options.depth}&direction=${options.direction}`
      ),
    enabled: Boolean(workspaceSlug && entityPublicId),
    staleTime: 30_000
  });

export const usePublicCatalogWikiPage = (workspaceSlug: string, path: string) =>
  useQuery({
    queryKey: publicCatalogKeys.wiki(workspaceSlug, path),
    queryFn: () =>
      publicCatalogRequest<PublicCatalogWikiPage>(
        `/${publicPath(workspaceSlug)}/wiki?path=${encodeURIComponent(path)}`
      ),
    enabled: Boolean(workspaceSlug && path),
    staleTime: 30_000
  });
