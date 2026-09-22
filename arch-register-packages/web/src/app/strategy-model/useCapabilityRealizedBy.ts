import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { entitiesQuery } from '../../queries/entities';
import { useEntitiesByIdSetQuery } from '../../hooks/useEntities';

/** One hop of a traversal provenance chain, as returned in an entity's `_projections.<alias>`. */
type TraversalHop = { context: 'entity' | 'relation'; id: string; schemaId: string };

export type CapabilityRealizedByItem = {
  entity: EntityRecord;
  /** The descendant capability whose direct link surfaced this entity, or `null` for a link the
   *  drawer's own capability carries directly. */
  contributingCapability: EntityRecord | null;
};

export type CapabilityRealizedBy = {
  items: CapabilityRealizedByItem[];
  isLoading: boolean;
  error: Error | null;
};

const EMPTY: CapabilityRealizedBy = { items: [], isLoading: false, error: null };

/**
 * Unions `business-capability-supports-entity` links across a capability's own direct links and
 * its full recursive `parent` containment subtree (#3205) — the metric engine's `containmentSubtree`
 * walk excludes the box entity itself (see `useEntityRollupMetric.ts`), so the capability's own
 * links are queried as a separate zero-depth path rather than being folded into the subtree one.
 *
 * Reuses the shared entity-traversal engine (`executeEntityTraversal` /
 * `addTraversalProjectionValues`) via the generic `entities.list` endpoint's `path` projections —
 * the same hop chain (`containmentSubtree(parent)` -> `typedRelation(business-capability-supports-entity, in)`)
 * already proven by `useCapabilityRollups.ts`'s Apps-count metric, just projected as an entity set
 * with provenance instead of reduced to a count. Provenance hops only carry `{id, schemaId}`, no
 * display name, so terminal entities and contributing capabilities are resolved in one batched
 * follow-up lookup via `useEntitiesByIdSetQuery`.
 */
export const useCapabilityRealizedBy = (
  workspaceId: string,
  businessCapabilitySchemaId: string | null,
  capabilityId: string | null,
  businessCapabilitySupportsEntityRelationSchemaId: string | null
): CapabilityRealizedBy => {
  const enabled =
    !!workspaceId &&
    !!capabilityId &&
    !!businessCapabilitySchemaId &&
    !!businessCapabilitySupportsEntityRelationSchemaId;

  const query = useQuery(
    entitiesQuery(
      workspaceId,
      {
        schemaId: businessCapabilitySchemaId ?? undefined,
        view: 'summary',
        limit: 1,
        entityQuery: enabled
          ? {
              root: {
                kind: 'predicate',
                path: [],
                fieldId: '_id',
                op: 'equals',
                value: capabilityId
              },
              projections: [
                {
                  kind: 'path',
                  alias: 'ownLinks',
                  path: [
                    {
                      kind: 'typedRelation',
                      fieldId: 'supported_entities',
                      relationSchemaId: businessCapabilitySupportsEntityRelationSchemaId!,
                      direction: 'in',
                      ownerSchemaIds: [businessCapabilitySchemaId!]
                    }
                  ]
                },
                {
                  kind: 'path',
                  alias: 'subtreeLinks',
                  path: [
                    {
                      kind: 'containmentSubtree',
                      fieldId: 'parent',
                      ownerSchemaId: businessCapabilitySchemaId!
                    },
                    {
                      kind: 'typedRelation',
                      fieldId: 'supported_entities',
                      relationSchemaId: businessCapabilitySupportsEntityRelationSchemaId!,
                      direction: 'in',
                      ownerSchemaIds: [businessCapabilitySchemaId!]
                    }
                  ]
                }
              ]
            }
          : null
      },
      enabled
    )
  );

  // For each terminal entity, keep the first provenance chain found — `ownLinks` (direct, no
  // contributing descendant) before `subtreeLinks` (via a descendant capability) — so a
  // capability that both links an application directly and reaches it again through a
  // descendant is shown once, without a spurious "via" label.
  const chains = useMemo(() => {
    const projections = query.data?.items[0]?._projections as
      | { ownLinks?: TraversalHop[][]; subtreeLinks?: TraversalHop[][] }
      | undefined;
    const byTerminalId = new Map<
      string,
      { terminal: TraversalHop; contributingCapabilityId: string | null }
    >();
    for (const chain of projections?.ownLinks ?? []) {
      const terminal = chain.at(-1);
      if (terminal && !byTerminalId.has(terminal.id)) {
        byTerminalId.set(terminal.id, { terminal, contributingCapabilityId: null });
      }
    }
    for (const chain of projections?.subtreeLinks ?? []) {
      const terminal = chain.at(-1);
      const contributingCapability = chain.at(-2);
      if (terminal && contributingCapability && !byTerminalId.has(terminal.id)) {
        byTerminalId.set(terminal.id, {
          terminal,
          contributingCapabilityId: contributingCapability.id
        });
      }
    }
    return [...byTerminalId.values()];
  }, [query.data]);

  const lookupIds = useMemo(
    () => [
      ...new Set(
        chains.flatMap(chain =>
          chain.contributingCapabilityId
            ? [chain.terminal.id, chain.contributingCapabilityId]
            : [chain.terminal.id]
        )
      )
    ],
    [chains]
  );
  const entities = useEntitiesByIdSetQuery(workspaceId, lookupIds, { enabled: query.isSuccess });

  const items = useMemo<CapabilityRealizedByItem[]>(() => {
    if (!entities.data) return [];
    return chains
      .map(chain => {
        const entity = entities.data.get(chain.terminal.id);
        if (!entity) return null;
        const contributingCapability = chain.contributingCapabilityId
          ? (entities.data.get(chain.contributingCapabilityId) ?? null)
          : null;
        return { entity, contributingCapability };
      })
      .filter((item): item is CapabilityRealizedByItem => item != null);
  }, [chains, entities.data]);

  if (!enabled) return EMPTY;

  const isLoading = query.isLoading || entities.isLoading;
  const firstError = query.error ?? entities.error ?? null;
  const error =
    firstError instanceof Error ? firstError : firstError ? new Error(String(firstError)) : null;

  return { items, isLoading, error };
};
