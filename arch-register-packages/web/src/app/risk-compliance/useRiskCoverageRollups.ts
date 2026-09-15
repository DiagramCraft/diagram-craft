import { useMemo } from 'react';
import { useRelations } from '../../hooks/useRelations';
import { computeRiskCoverage, type RiskCoverageResult } from './riskCoverage';

export type RiskCoverageRollups = {
  byId: Map<string, RiskCoverageResult>;
  isLoading: boolean;
  error: Error | null;
};

const EMPTY: RiskCoverageRollups = { byId: new Map(), isLoading: false, error: null };

/**
 * Batched sibling of `useRiskCoverageRollup.ts`, for table/overview screens: one
 * `relations.list` request across every `risk-control` relation in the workspace at once
 * (filtered by schema, not per-Risk), grouped by the mitigated Risk's `_uid`. No metric engine
 * involved, same as the singular hook — `coverage`/`effectiveness` already live on the relation.
 */
export const useRiskCoverageRollups = (
  workspaceId: string,
  riskControlRelationSchemaId: string | null
): RiskCoverageRollups => {
  const enabled = !!riskControlRelationSchemaId;
  const query = useRelations(
    workspaceId,
    { schemaId: riskControlRelationSchemaId ?? undefined, limit: 1000 },
    { enabled }
  );

  const byId = useMemo(() => {
    const byRiskId = new Map<string, { coverage: number | null; effectiveness: string | null }[]>();
    for (const relation of query.data) {
      const riskId = relation._in.id;
      const entry = byRiskId.get(riskId) ?? [];
      entry.push({
        coverage: typeof relation.coverage === 'number' ? relation.coverage : null,
        effectiveness: typeof relation.effectiveness === 'string' ? relation.effectiveness : null
      });
      byRiskId.set(riskId, entry);
    }
    const map = new Map<string, RiskCoverageResult>();
    for (const [riskId, relations] of byRiskId) {
      map.set(riskId, computeRiskCoverage(relations));
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

  return { byId, isLoading: query.isLoading, error };
};
