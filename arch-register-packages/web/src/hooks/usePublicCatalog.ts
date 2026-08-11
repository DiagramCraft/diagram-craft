import { useQuery } from '@tanstack/react-query';
import type {
  PublicCatalogEntity,
  PublicCatalogEntityList,
  PublicCatalogManifest,
  PublicCatalogWikiPage
} from '@arch-register/api-types/publicCatalogContract';
import { publicCatalogRequest } from '../lib/orpcClient';

const publicPath = (workspaceSlug: string) => encodeURIComponent(workspaceSlug);

export const publicCatalogKeys = {
  all: ['public-catalog'] as const,
  manifest: (workspaceSlug: string) =>
    [...publicCatalogKeys.all, 'manifest', workspaceSlug] as const,
  entities: (workspaceSlug: string, q?: string, schema?: string) =>
    [...publicCatalogKeys.all, 'entities', workspaceSlug, q ?? '', schema ?? ''] as const,
  entity: (workspaceSlug: string, entityPublicId: string) =>
    [...publicCatalogKeys.all, 'entity', workspaceSlug, entityPublicId] as const,
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
  options: { q?: string; schema?: string } = {}
) =>
  useQuery({
    queryKey: publicCatalogKeys.entities(workspaceSlug, options.q, options.schema),
    queryFn: () => {
      const query = new URLSearchParams();
      if (options.q) query.set('q', options.q);
      if (options.schema) query.set('schema', options.schema);
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
