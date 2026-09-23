import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { entitiesQuery } from '../../queries/entities';
import { useEntitiesByIdSetQuery } from '../../hooks/useEntities';

/** One hop of a traversal provenance chain, as returned in an entity's `_projections.<alias>`. */
type TraversalHop = { context: 'entity' | 'relation'; id: string; schemaId: string };

export type VendorAppsSuppliedItem = {
  system: EntityRecord;
  /** The Contract that links this vendor to `system`. */
  contract: EntityRecord;
};

export type VendorAppsSupplied = {
  items: VendorAppsSuppliedItem[];
  isLoading: boolean;
  error: Error | null;
};

const EMPTY: VendorAppsSupplied = { items: [], isLoading: false, error: null };

/**
 * Systems a vendor's Contracts serve — Vendor -> (backward containment, Contract's own `vendor`
 * field) -> Contract -> (`system-contract` typedRelation, `direction: 'out'` on Contract) ->
 * System. A single hop each way (Vendor->Contract isn't recursive like Capability's `parent`
 * subtree), so this uses one `relation`/`typedRelation` hop chain, not `containmentSubtree`.
 *
 * Reuses the generic `entities.list` `path`-projection mechanism (rather than `metrics.rollup`,
 * which only returns counts) the same way the drawer's generic `query` item
 * (`useEntityDrawerQueryItem.ts`) does — provenance hops only carry `{id, schemaId}`, so the
 * terminal Systems and intermediate Contracts are resolved in one batched follow-up lookup via
 * `useEntitiesByIdSetQuery`.
 *
 * The drawer's "Technology lifecycle" section reuses this hook's `items` directly (each
 * `EntityRecord` already carries its own `_lifecycle`) rather than issuing a separate query.
 */
export const useVendorAppsSupplied = (
  workspaceId: string,
  vendorSchemaId: string | null,
  vendorId: string | null,
  contractSchemaId: string | null,
  systemContractRelationSchemaId: string | null
): VendorAppsSupplied => {
  const enabled =
    !!workspaceId &&
    !!vendorId &&
    !!vendorSchemaId &&
    !!contractSchemaId &&
    !!systemContractRelationSchemaId;

  const query = useQuery(
    entitiesQuery(
      workspaceId,
      {
        schemaId: vendorSchemaId ?? undefined,
        view: 'summary',
        limit: 1,
        entityQuery: enabled
          ? {
              root: {
                kind: 'predicate',
                path: [],
                fieldId: '_id',
                op: 'equals',
                value: vendorId
              },
              projections: [
                {
                  kind: 'path',
                  alias: 'systems',
                  path: [
                    { kind: 'backward', fieldId: 'vendor', ownerSchemaId: contractSchemaId! },
                    {
                      kind: 'typedRelation',
                      fieldId: 'system',
                      relationSchemaId: systemContractRelationSchemaId!,
                      direction: 'out',
                      ownerSchemaIds: [contractSchemaId!]
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

  const chains = useMemo(() => {
    const projections = query.data?.items[0]?._projections as
      | { systems?: TraversalHop[][] }
      | undefined;
    const byTerminalId = new Map<string, { system: TraversalHop; contract: TraversalHop }>();
    for (const chain of projections?.systems ?? []) {
      const system = chain.at(-1);
      const contract = chain.at(-2);
      if (system && contract && !byTerminalId.has(system.id)) {
        byTerminalId.set(system.id, { system, contract });
      }
    }
    return [...byTerminalId.values()];
  }, [query.data]);

  const lookupIds = useMemo(
    () => [...new Set(chains.flatMap(chain => [chain.system.id, chain.contract.id]))],
    [chains]
  );
  const entities = useEntitiesByIdSetQuery(workspaceId, lookupIds, { enabled: query.isSuccess });

  const items = useMemo<VendorAppsSuppliedItem[]>(() => {
    if (!entities.data) return [];
    return chains
      .map(chain => {
        const system = entities.data.get(chain.system.id);
        const contract = entities.data.get(chain.contract.id);
        return system && contract ? { system, contract } : null;
      })
      .filter((item): item is VendorAppsSuppliedItem => item != null);
  }, [chains, entities.data]);

  if (!enabled) return EMPTY;

  const isLoading = query.isLoading || entities.isLoading;
  const firstError = query.error ?? entities.error ?? null;
  const error =
    firstError instanceof Error ? firstError : firstError ? new Error(String(firstError)) : null;

  return { items, isLoading, error };
};
