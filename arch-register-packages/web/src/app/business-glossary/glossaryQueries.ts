import { queryOptions } from '@tanstack/react-query';
import { orpcClient } from '../../lib/orpcClient';

export const glossaryKeys = {
  all: ['glossary'] as const,
  config: (workspaceId: string) => [...glossaryKeys.all, 'config', workspaceId] as const,
  terms: (workspaceId: string, query: Record<string, unknown>) =>
    [...glossaryKeys.all, 'terms', workspaceId, query] as const,
  term: (workspaceId: string, id: string) =>
    [...glossaryKeys.all, 'term', workspaceId, id] as const,
  usage: (workspaceId: string, id: string) =>
    [...glossaryKeys.all, 'usage', workspaceId, id] as const
};

export const glossaryConfigQuery = (workspaceId: string, enabled = true) =>
  queryOptions({
    queryKey: glossaryKeys.config(workspaceId),
    queryFn: () => orpcClient.glossary.config({ params: { workspace: workspaceId } }),
    enabled: enabled && !!workspaceId,
    staleTime: 5 * 60 * 1000
  });

export const glossaryTermsQuery = (
  workspaceId: string,
  query: {
    q?: string;
    categoryIds?: string[];
    owner?: string;
    status?: string;
    lifecycle?: string;
    quality?: 'unused' | 'conflicting' | 'deprecated' | 'ownerless';
    limit?: number;
    offset?: number;
  } = {},
  enabled = true
) =>
  queryOptions({
    queryKey: glossaryKeys.terms(workspaceId, query),
    queryFn: () => orpcClient.glossary.terms.list({ params: { workspace: workspaceId }, query }),
    enabled: enabled && !!workspaceId,
    staleTime: 30 * 1000
  });

export const glossaryTermQuery = (workspaceId: string, id: string, enabled = true) =>
  queryOptions({
    queryKey: glossaryKeys.term(workspaceId, id),
    queryFn: () => orpcClient.glossary.terms.get({ params: { workspace: workspaceId, id } }),
    enabled: enabled && !!workspaceId && !!id
  });

export const glossaryUsageQuery = (workspaceId: string, id: string, enabled = true) =>
  queryOptions({
    queryKey: glossaryKeys.usage(workspaceId, id),
    queryFn: () => orpcClient.glossary.terms.usage({ params: { workspace: workspaceId, id } }),
    enabled: enabled && !!workspaceId && !!id
  });
