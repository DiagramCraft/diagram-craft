import { useMemo } from 'react';
import type { TreeEdge, TreeNode } from '@arch-register/api-types/entityContract';
import { useEntityTree } from '../../hooks/useEntities';

export type VendorNextRenewals = {
  byId: Map<string, string | null>;
  isLoading: boolean;
};

const EMPTY: VendorNextRenewals = { byId: new Map(), isLoading: false };

/**
 * The earliest upcoming `Contract.contract_end` among each vendor's own Contracts — there is no
 * "next renewal" field on Vendor itself, since `contract_end` lives on Contract (the containment
 * child, "provided by" a Vendor per `schemaTemplates.ts`).
 *
 * Fetches the Contract tree once for the whole table (`useEntityTree` defaults to `view: 'full'`
 * server-side, so `contract_end` is present — same fetch shape `VendorDrawer`'s own "Contracts"
 * section already relies on for `annual_cost`), then groups by `parentId` client-side. A vendor
 * with no contracts, or none with a `contract_end` on or after today, maps to `null`.
 */
export const nextRenewalDate = (
  contracts: readonly { contract_end?: unknown }[],
  today: Date = new Date()
): string | null => {
  const todayStr = today.toISOString().slice(0, 10);
  const upcoming = contracts
    .map(contract => (typeof contract.contract_end === 'string' ? contract.contract_end : null))
    .filter((date): date is string => date != null && date.slice(0, 10) >= todayStr)
    .sort();
  return upcoming[0] ?? null;
};

export const useVendorNextRenewals = (
  workspaceId: string,
  contractSchemaId: string | null,
  vendorIds: readonly string[]
): VendorNextRenewals => {
  const enabled = !!workspaceId && !!contractSchemaId && vendorIds.length > 0;

  const tree = useEntityTree(workspaceId, { schemaId: contractSchemaId ?? undefined }, enabled);

  const byId = useMemo(() => {
    const map = new Map<string, string | null>();
    if (!enabled) return map;

    const nodeById = new Map((tree.data?.nodes ?? []).map((node: TreeNode) => [node._uid, node]));
    const contractsByParent = new Map<string, TreeNode[]>();
    for (const edge of (tree.data?.edges ?? []) as TreeEdge[]) {
      const contract = nodeById.get(edge.childId);
      if (!contract) continue;
      const list = contractsByParent.get(edge.parentId) ?? [];
      list.push(contract);
      contractsByParent.set(edge.parentId, list);
    }

    for (const vendorId of vendorIds) {
      const contracts = (contractsByParent.get(vendorId) ?? []).map(contract => ({
        contract_end: contract.contract_end
      }));
      map.set(vendorId, nextRenewalDate(contracts));
    }
    return map;
  }, [enabled, tree.data, vendorIds]);

  if (!enabled) return EMPTY;

  return { byId, isLoading: tree.isLoading };
};
