import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { entitiesQuery } from '../../queries/entities';

/** One hop of a traversal provenance chain, as returned in an entity's `_projections.<alias>` —
 *  same shape as `useVendorTechnologyExposure.ts` and the entity-drawer query read. */
type TraversalHop = { context: 'entity' | 'relation'; id: string; schemaId: string };

export type VendorAppsSuppliedCounts = {
  byId: Map<string, number>;
  isLoading: boolean;
};

const EMPTY: VendorAppsSuppliedCounts = { byId: new Map(), isLoading: false };

/**
 * Batched traversal for table/overview screens that only need a count
 * (not each System's own fields): the number of distinct Systems each vendor's Contracts serve,
 * across every vendor at once. Same single-hop-each-way traversal
 * (Vendor -> backward Contract's `vendor` field -> Contract -> typedRelation `system` -> System)
 * `useVendorTechnologyExposure.ts`'s own `vendorSystems` query performs, generalized here to every
 * vendor id at once via an `op: 'in'` root predicate — but without that hook's second (System ->
 * Technology Release) hop or its follow-up `useEntitiesByIdSetQuery` lookup, since only the count
 * of terminal ids is needed, not the System records themselves.
 */
export const useVendorAppsSuppliedCounts = (
  workspaceId: string,
  vendorSchemaId: string | null,
  vendorIds: readonly string[],
  contractSchemaId: string | null,
  systemContractRelationSchemaId: string | null
): VendorAppsSuppliedCounts => {
  const boxVendorIds = useMemo(() => [...vendorIds], [vendorIds]);
  const enabled =
    !!workspaceId &&
    !!vendorSchemaId &&
    !!contractSchemaId &&
    !!systemContractRelationSchemaId &&
    boxVendorIds.length > 0;

  const query = useQuery(
    entitiesQuery(
      workspaceId,
      {
        schemaId: vendorSchemaId ?? undefined,
        view: 'summary',
        limit: boxVendorIds.length || undefined,
        entityQuery: enabled
          ? {
              root: {
                kind: 'predicate',
                path: [],
                fieldId: '_id',
                op: 'in',
                value: boxVendorIds
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

  const byId = useMemo(() => {
    const map = new Map<string, number>();
    if (!enabled) return map;
    for (const vendor of query.data?.items ?? []) {
      const projections = vendor._projections as { systems?: TraversalHop[][] } | undefined;
      const distinctSystemIds = new Set(
        (projections?.systems ?? [])
          .map(chain => chain.at(-1)?.id)
          .filter((id): id is string => id != null)
      );
      map.set(vendor._uid, distinctSystemIds.size);
    }
    return map;
  }, [enabled, query.data]);

  if (!enabled) return EMPTY;

  return { byId, isLoading: query.isLoading };
};
