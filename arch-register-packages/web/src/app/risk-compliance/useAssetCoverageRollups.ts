import { useMemo } from 'react';
import { useRelations } from '../../hooks/useRelations';

export type AssetCoverageRollup = {
  /** The asset's `_uid` — `entities.get`/`entityDetailRoute` resolve by uid or publicId alike, and
   *  a relation endpoint only carries `{ id, name }` (no publicId), so this is what row-click
   *  navigation uses. */
  assetId: string;
  assetName: string;
  riskCount: number;
  controlCount: number;
};

export type AssetCoverageRollups = {
  items: AssetCoverageRollup[];
  isLoading: boolean;
  error: Error | null;
};

const EMPTY: AssetCoverageRollups = { items: [], isLoading: false, error: null };

/**
 * "Coverage by information asset" roll-up for the Controls section's coverage view — mirrors the
 * design reference's `rcRisksForAsset`/`rcControlsForAsset` (`rc-data.jsx`): for each information
 * asset, the count of distinct Risks affecting it (`risk-affects`) and the count of distinct
 * Controls directly protecting it (`control-affects`) — both direct links read straight off the
 * relations, not a derived percentage. The design's Classification / Personal data / Steward /
 * Retention columns have no analog on the shipped schema (an asset here is an arbitrary entity
 * via `outSymSchemaIds: 'any'`, not a dedicated Information Asset domain schema) and are dropped,
 * per #3151's "adapt to the shipped schema rather than reworking it" precedent.
 */
export const useAssetCoverageRollups = (
  workspaceId: string,
  riskAffectsRelationSchemaId: string | null,
  controlAffectsRelationSchemaId: string | null
): AssetCoverageRollups => {
  const enabled = !!riskAffectsRelationSchemaId || !!controlAffectsRelationSchemaId;
  const riskAffects = useRelations(
    workspaceId,
    { schemaId: riskAffectsRelationSchemaId ?? undefined, limit: 1000 },
    { enabled: !!riskAffectsRelationSchemaId }
  );
  const controlAffects = useRelations(
    workspaceId,
    { schemaId: controlAffectsRelationSchemaId ?? undefined, limit: 1000 },
    { enabled: !!controlAffectsRelationSchemaId }
  );

  const items = useMemo(() => {
    const byAssetId = new Map<
      string,
      { assetName: string; riskIds: Set<string>; controlIds: Set<string> }
    >();
    const entryFor = (assetId: string, assetName: string) => {
      const existing = byAssetId.get(assetId);
      if (existing) return existing;
      const created = { assetName, riskIds: new Set<string>(), controlIds: new Set<string>() };
      byAssetId.set(assetId, created);
      return created;
    };
    // `risk-affects`: Risk is `_in`, the asset is `_out`. `control-affects`: Control is `_in`, the
    // asset is `_out` — both relation schemas share that shape (`inSymSchemaIds` the fixed side,
    // `outSymSchemaIds: 'any'` the asset), mirroring `ControlDrawer.tsx`'s role-by-endpoint rule.
    for (const relation of riskAffects.data) {
      entryFor(relation._out.id, relation._out.name).riskIds.add(relation._in.id);
    }
    for (const relation of controlAffects.data) {
      entryFor(relation._out.id, relation._out.name).controlIds.add(relation._in.id);
    }
    return [...byAssetId.entries()].map(([assetId, { assetName, riskIds, controlIds }]) => ({
      assetId,
      assetName,
      riskCount: riskIds.size,
      controlCount: controlIds.size
    }));
  }, [riskAffects.data, controlAffects.data]);

  if (!enabled) return EMPTY;

  const isLoading = riskAffects.isLoading || controlAffects.isLoading;
  const firstError = riskAffects.error ?? controlAffects.error ?? null;
  const error =
    firstError instanceof Error ? firstError : firstError ? new Error(String(firstError)) : null;

  return { items, isLoading, error };
};
