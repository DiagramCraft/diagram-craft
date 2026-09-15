import { useMemo } from 'react';
import { useRelations } from '../../hooks/useRelations';

export type ControlRiskCounts = {
  /** Count of distinct `risk-control` relations per mitigating Control's `_uid`. */
  countById: Map<string, number>;
  isLoading: boolean;
  error: Error | null;
};

const EMPTY: ControlRiskCounts = { countById: new Map(), isLoading: false, error: null };

/**
 * How many Risks each Control mitigates, for the Controls library table's "Risks mitigated"
 * column — one `relations.list` request over every `risk-control` relation in the workspace,
 * grouped by the mitigating Control's `_uid` (`relation._out.id` — Control is the `_out` side,
 * mirroring `ControlDrawer.tsx`'s `mitigatedRisks` filter).
 *
 * This used to also compute a per-Control "coverage" percentage by running the same relations
 * through `computeRiskCoverage` (the "probability at least one control catches it" formula the
 * Risks screen uses to combine *multiple controls covering one Risk*). Reused the other way
 * round — combining one Control's coverage/effectiveness values across its *different* Risks —
 * that formula doesn't hold up: the result grows toward 100% purely from how many unrelated
 * Risks a Control happens to be linked to, not from how effective it actually is, so a Control
 * on 5 weakly-covered Risks would out-score one on a single strongly-covered Risk. Removed;
 * `operating_effectiveness` (already a field on Control) is the honest measure of that, and this
 * hook now only counts.
 */
export const useControlRiskCounts = (
  workspaceId: string,
  riskControlRelationSchemaId: string | null
): ControlRiskCounts => {
  const enabled = !!riskControlRelationSchemaId;
  const query = useRelations(
    workspaceId,
    { schemaId: riskControlRelationSchemaId ?? undefined, limit: 1000 },
    { enabled }
  );

  const countById = useMemo(() => {
    const map = new Map<string, number>();
    for (const relation of query.data) {
      const controlId = relation._out.id;
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
