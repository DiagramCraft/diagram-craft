import { useMemo } from 'react';
import { useRelations } from '../../hooks/useRelations';

export type ControlAssetCounts = {
  /** Count of distinct information assets each Control protects (`control-affects`), keyed by
   *  the Control's `_uid`. */
  countById: Map<string, number>;
  isLoading: boolean;
  error: Error | null;
};

const EMPTY: ControlAssetCounts = { countById: new Map(), isLoading: false, error: null };

/**
 * How many information assets each Control directly protects, for the Controls library table's
 * "Assets" column (the design reference's `c.assets.length`, `rc-views.jsx`) — one
 * `relations.list` request over every `control-affects` relation in the workspace, grouped by
 * the protecting Control's `_uid` (`relation._in.id` — Control is the `_in` side, mirroring
 * the entity drawer's `protectedEntities` filter). Sibling of `useControlRiskCounts.ts`, same
 * shape, different relation and endpoint role.
 */
export const useControlAssetCounts = (
  workspaceId: string,
  controlAffectsRelationSchemaId: string | null
): ControlAssetCounts => {
  const enabled = !!controlAffectsRelationSchemaId;
  const query = useRelations(
    workspaceId,
    { schemaId: controlAffectsRelationSchemaId ?? undefined, limit: 1000 },
    { enabled }
  );

  const countById = useMemo(() => {
    const map = new Map<string, number>();
    for (const relation of query.data) {
      const controlId = relation._in.id;
      map.set(controlId, (map.get(controlId) ?? 0) + 1);
    }
    return map;
  }, [query.data]);

  if (!enabled) return EMPTY;

  const error =
    query.error instanceof Error
      ? query.error
      : query.error
        ? new Error(String(query.error))
        : null;

  return { countById, isLoading: query.isLoading, error };
};
