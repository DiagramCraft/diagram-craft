import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { entitiesQuery, entityQueryTextParseQuery } from '../../../queries/entities';
import { useEntitiesByIdSetQuery } from '../../../hooks/useEntities';

/** One hop of a traversal chain, as returned in an entity's `_projections.<alias>` for a
 *  `kind: 'path'` projection (see `EntityQuery`'s `PathProjectionField`). */
type TraversalHop = { context: 'entity' | 'relation'; id: string; schemaId: string };

export type EntityDrawerQueryItemResult = {
  items: EntityRecord[];
  isLoading: boolean;
  error: Error | null;
};

const EMPTY: EntityDrawerQueryItemResult = { items: [], isLoading: false, error: null };

const escapeQueryStringLiteral = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/** Wraps an admin-authored path expression with a root predicate anchored to the given entity,
 *  escaping the schema name / entity id for embedding as query-DSL string literals. */
export const buildWrappedQueryText = (
  schemaName: string,
  entityId: string,
  queryText: string
): string =>
  `schema:"${escapeQueryStringLiteral(schemaName)}" _id = "${escapeQueryStringLiteral(entityId)}" columns path ${queryText} as "value"`;

/** Flattens every matched traversal chain's terminal (last-hop) entity id, deduped. */
export const extractTerminalIds = (chains: readonly TraversalHop[][]): string[] => [
  ...new Set(
    chains.flatMap(chain => {
      const terminal = chain.at(-1);
      return terminal ? [terminal.id] : [];
    })
  )
];

/**
 * Executes a generic `query` drawer item's path expression (specs/QUERY_LANGUAGE.md §4), scoped to
 * the current entity as root. Wraps the admin-authored path expression (e.g.
 * `subtree(parent).->"Business Capability Supports Entity"`) with a root predicate anchored to this
 * entity, parses it via the text query DSL, executes it through the generic `entities.list`
 * endpoint, and resolves the terminal entities of every matched chain in one batched lookup —
 * the same parse -> execute -> resolve pipeline `useCapabilityRealizedBy.ts` hand-built with a
 * bespoke IR, now driven by declarative config instead.
 */
export const useEntityDrawerQueryItem = (
  workspaceId: string,
  schemaName: string,
  entityId: string,
  queryText: string
): EntityDrawerQueryItemResult => {
  const enabled = !!workspaceId && !!schemaName && !!entityId && !!queryText;
  const wrappedText = enabled ? buildWrappedQueryText(schemaName, entityId, queryText) : '';

  const parsed = useQuery(entityQueryTextParseQuery(workspaceId, wrappedText, enabled));
  const ir = parsed.data?.ok ? parsed.data.query : null;

  const query = useQuery(
    entitiesQuery(
      workspaceId,
      { view: 'summary', limit: 1, entityQuery: ir },
      enabled && ir != null
    )
  );

  const terminalIds = useMemo(() => {
    const projections = query.data?.items[0]?._projections as
      | { value?: TraversalHop[][] }
      | undefined;
    return extractTerminalIds(projections?.value ?? []);
  }, [query.data]);

  const entities = useEntitiesByIdSetQuery(workspaceId, terminalIds, { enabled: query.isSuccess });

  const items = useMemo<EntityRecord[]>(() => {
    if (!entities.data) return [];
    return terminalIds.flatMap(id => {
      const entity = entities.data.get(id);
      return entity ? [entity] : [];
    });
  }, [terminalIds, entities.data]);

  if (!enabled) return EMPTY;

  const isLoading = parsed.isLoading || (ir != null && query.isLoading) || entities.isLoading;
  const parseError =
    parsed.data && !parsed.data.ok
      ? new Error(parsed.data.errors.map(entry => entry.message).join('; '))
      : null;
  const firstError = parsed.error ?? parseError ?? query.error ?? entities.error ?? null;
  const error =
    firstError instanceof Error ? firstError : firstError ? new Error(String(firstError)) : null;

  return { items, isLoading, error };
};
