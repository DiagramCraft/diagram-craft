import { useMutation, useQuery } from '@tanstack/react-query';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { orpcClient } from '../lib/orpcClient';
import { entityQueryTextCountQuery } from '../queries/entities';

// Wraps entityQuery.{parseText,printText} (specs/QUERY_LANGUAGE.md §4) — mutations rather than
// queries since callers trigger these on demand (debounced typing, mode switch), not as a
// cache-keyed read.

export const useParseEntityQueryText = (workspaceId: string) =>
  useMutation({
    mutationFn: (text: string) =>
      orpcClient.entityQueryText.parseText({
        params: { workspace: workspaceId },
        query: { text }
      })
  });

export const usePrintEntityQueryText = (workspaceId: string) =>
  useMutation({
    mutationFn: (variables: {
      query: Parameters<typeof orpcClient.entityQueryText.printText>[0]['body']['query'];
      pretty?: boolean;
    }) =>
      orpcClient.entityQueryText.printText({
        params: { workspace: workspaceId },
        body: variables
      })
  });

export const useRunEntityQuery = (workspaceId: string) =>
  useMutation({
    mutationFn: (query: EntityQuery) =>
      orpcClient.entities.list({
        params: { workspace: workspaceId },
        query: { entityQuery: JSON.stringify(query), view: 'full' }
      })
  });

export const useQueryTextCount = (workspaceId: string, text: string, enabled = true) =>
  useQuery(entityQueryTextCountQuery(workspaceId, text, enabled));

const QUERY_TEXT_ENTITY_LIMIT = 500;

/**
 * Runs entity-query DSL text and returns the matching records (full view). `ok: false` means the
 * text did not parse. Capped at {@link QUERY_TEXT_ENTITY_LIMIT} records, which suits dashboard
 * widgets that aggregate or rank client-side.
 */
export const useQueryTextEntities = (workspaceId: string, text: string, enabled = true) =>
  useQuery({
    queryKey: ['entities', 'queryText', 'entities', workspaceId, text],
    queryFn: async ({ signal }) => {
      const parsed = await orpcClient.entityQueryText.parseText(
        { params: { workspace: workspaceId }, query: { text } },
        { signal }
      );
      if (!parsed.ok) return { ok: false as const, entities: [] };
      const result = await orpcClient.entities.list(
        {
          params: { workspace: workspaceId },
          query: {
            entityQuery: JSON.stringify(parsed.query),
            view: 'full',
            limit: QUERY_TEXT_ENTITY_LIMIT
          }
        },
        { signal }
      );
      return { ok: true as const, entities: result.items };
    },
    enabled: enabled && !!workspaceId && text.trim() !== ''
  });
