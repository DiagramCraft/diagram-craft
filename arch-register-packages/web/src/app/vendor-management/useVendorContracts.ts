import { useMemo } from 'react';
import type { EntityRecord, TreeEdge, TreeNode } from '@arch-register/api-types/entityContract';
import { useEntityTree } from '../../hooks/useEntities';

export type VendorContractRow = {
  contract: EntityRecord;
  vendorId: string | null;
  vendorName: string | null;
};

export type VendorContracts = {
  items: VendorContractRow[];
  isLoading: boolean;
};

const EMPTY: VendorContracts = { items: [], isLoading: false };

/**
 * All Contracts for the workspace, each paired with its containing Vendor's id and name — the
 * Contracts section's list, calendar, and sidebar facets all need both a Contract's own fields and
 * its vendor's name, which a flat `entitiesQuery` fetch can't give (the `vendor` containment field
 * on a Contract record is only the bare parent uid, wrapped in an array — no name). Fetching the
 * Contract tree once (as `useVendorNextRenewals.ts` and the vendor drawer already do) and joining
 * `edges` against `nodes` client-side resolves both in a single request.
 */
export const useVendorContracts = (
  workspaceId: string,
  contractSchemaId: string | null
): VendorContracts => {
  const enabled = !!workspaceId && !!contractSchemaId;

  const tree = useEntityTree(workspaceId, { schemaId: contractSchemaId ?? undefined }, enabled);

  const items = useMemo(() => {
    if (!enabled) return [];

    const nodeById = new Map((tree.data?.nodes ?? []).map((node: TreeNode) => [node._uid, node]));
    const vendorIdByContractId = new Map<string, string>();
    for (const edge of (tree.data?.edges ?? []) as TreeEdge[]) {
      if (nodeById.has(edge.childId)) vendorIdByContractId.set(edge.childId, edge.parentId);
    }

    return (tree.data?.nodes ?? [])
      .filter((node: TreeNode) => vendorIdByContractId.has(node._uid))
      .map((contract: TreeNode) => {
        const vendorId = vendorIdByContractId.get(contract._uid) ?? null;
        const vendor = vendorId ? nodeById.get(vendorId) : undefined;
        return { contract, vendorId, vendorName: vendor?._name ?? null };
      });
  }, [enabled, tree.data]);

  if (!enabled) return EMPTY;

  return { items, isLoading: tree.isLoading };
};
