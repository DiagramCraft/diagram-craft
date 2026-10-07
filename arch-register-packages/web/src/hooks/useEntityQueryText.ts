import { useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { orpcClient } from '../lib/orpcClient';
import { entityQueryTextCountQuery } from '../queries/entities';
import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import { resolveEntityQuery } from '../sections/markdown/mdx-components/blocks/entity-browser-embed/EntityBrowserEmbedFieldResolution';
import { stripEmptyGroups } from '../sections/entities/components/entityBrowserState';

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

export type WidgetRecordSource = {
  /** Entity-query DSL text. */
  query?: string;
  /** Structured query; takes precedence over `query` (it can carry sidebar `in` filters). */
  entityQuery?: EntityQuery;
  /** Root schema NAME the `entityQuery` is scoped to; its field NAMEs resolve against it. */
  schemaName?: string;
};

export const hasWidgetRecordSource = (source: WidgetRecordSource): boolean =>
  source.entityQuery !== undefined || (source.query ?? '').trim() !== '';

/**
 * Records for a dashboard widget from either a structured `entityQuery` (empty filter groups are
 * stripped, so an unset sidebar facet means "no filter") or DSL `query` text. `ok: false` means the
 * DSL text did not parse.
 */
export const useWidgetRecords = (workspaceId: string, source: WidgetRecordSource) => {
  const { schemas, relationSchemas } = useWorkspaceContext();
  const structured = source.entityQuery !== undefined;
  const resolvedQuery = useMemo(() => {
    if (!source.entityQuery) return undefined;
    const rootSchema = schemas.find(schema => schema.name === source.schemaName);
    return stripEmptyGroups(
      resolveEntityQuery(source.entityQuery, rootSchema, rootSchema?.id ?? null, {
        schemas,
        relationSchemas
      })
    );
  }, [source.entityQuery, source.schemaName, schemas, relationSchemas]);
  const structuredResult = useQuery({
    queryKey: ['entities', 'structuredQuery', 'entities', workspaceId, resolvedQuery],
    queryFn: async ({ signal }) => {
      const result = await orpcClient.entities.list(
        {
          params: { workspace: workspaceId },
          query: {
            entityQuery: JSON.stringify(resolvedQuery),
            view: 'full',
            limit: QUERY_TEXT_ENTITY_LIMIT
          }
        },
        { signal }
      );
      return { ok: true as const, entities: result.items };
    },
    enabled: structured && !!workspaceId
  });
  const textResult = useQueryTextEntities(workspaceId, source.query ?? '', !structured);
  return structured ? structuredResult : textResult;
};
