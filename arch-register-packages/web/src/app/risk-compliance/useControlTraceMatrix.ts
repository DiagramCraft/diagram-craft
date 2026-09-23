import { useMemo } from 'react';
import { useRelations } from '../../hooks/useRelations';

export type ControlTraceMatrix = {
  /** Risk ids each Control mitigates (`risk-control`), keyed by the Control's `_uid`. */
  riskIdsByControlId: Map<string, Set<string>>;
  /** Asset ids each Control protects (`control-affects`), keyed by the Control's `_uid`. */
  assetIdsByControlId: Map<string, Set<string>>;
  /** Control ids mitigating each Risk, keyed by the Risk's `_uid` — column totals / the
   *  "uncontrolled" highlight for a Risk with no entry. */
  controlIdsByRiskId: Map<string, Set<string>>;
  /** Control ids protecting each asset, keyed by the asset's `_uid` — column totals / the
   *  "uncontrolled" highlight for an asset with no entry. */
  controlIdsByAssetId: Map<string, Set<string>>;
  isLoading: boolean;
  error: Error | null;
};

const EMPTY: ControlTraceMatrix = {
  riskIdsByControlId: new Map(),
  assetIdsByControlId: new Map(),
  controlIdsByRiskId: new Map(),
  controlIdsByAssetId: new Map(),
  isLoading: false,
  error: null
};

const addTo = (map: Map<string, Set<string>>, key: string, value: string) => {
  const set = map.get(key) ?? new Set<string>();
  set.add(value);
  map.set(key, set);
};

/**
 * Control × risk/asset membership for the Controls section's Traceability matrix (#3282) — unlike
 * `useControlRiskCounts.ts`/`useControlAssetCounts.ts`, which only tally how many risks/assets
 * each Control has, this hook keeps the actual pairs so the matrix can plot a cell per
 * control/column and derive per-row and per-column totals from the same data. Two
 * `relations.list` requests, using the same `{ schemaId, limit: 1000 }` filters as the Coverage
 * view's existing relation queries — react-query dedupes these when switching between Coverage
 * and Traceability, so the workspace-wide data isn't refetched.
 *
 * Relation endpoint roles mirror the entity drawer: `risk-control` has Control as `_out`, Risk
 * as `_in`; `control-affects` has Control as `_in`, the asset as `_out`.
 */
export const useControlTraceMatrix = (
  workspaceId: string,
  riskControlRelationSchemaId: string | null,
  controlAffectsRelationSchemaId: string | null
): ControlTraceMatrix => {
  const enabled = !!riskControlRelationSchemaId || !!controlAffectsRelationSchemaId;
  const riskControl = useRelations(
    workspaceId,
    { schemaId: riskControlRelationSchemaId ?? undefined, limit: 1000 },
    { enabled: !!riskControlRelationSchemaId }
  );
  const controlAffects = useRelations(
    workspaceId,
    { schemaId: controlAffectsRelationSchemaId ?? undefined, limit: 1000 },
    { enabled: !!controlAffectsRelationSchemaId }
  );

  const maps = useMemo(() => {
    const riskIdsByControlId = new Map<string, Set<string>>();
    const controlIdsByRiskId = new Map<string, Set<string>>();
    for (const relation of riskControl.data) {
      const controlId = relation._out.id;
      const riskId = relation._in.id;
      addTo(riskIdsByControlId, controlId, riskId);
      addTo(controlIdsByRiskId, riskId, controlId);
    }
    const assetIdsByControlId = new Map<string, Set<string>>();
    const controlIdsByAssetId = new Map<string, Set<string>>();
    for (const relation of controlAffects.data) {
      const controlId = relation._in.id;
      const assetId = relation._out.id;
      addTo(assetIdsByControlId, controlId, assetId);
      addTo(controlIdsByAssetId, assetId, controlId);
    }
    return { riskIdsByControlId, controlIdsByRiskId, assetIdsByControlId, controlIdsByAssetId };
  }, [riskControl.data, controlAffects.data]);

  if (!enabled) return EMPTY;

  const isLoading = riskControl.isLoading || controlAffects.isLoading;
  const firstError = riskControl.error ?? controlAffects.error ?? null;
  const error =
    firstError instanceof Error ? firstError : firstError ? new Error(String(firstError)) : null;

  return { ...maps, isLoading, error };
};
