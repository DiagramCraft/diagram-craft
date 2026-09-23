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
 * mirroring the entity drawer's `mitigatedRisks` filter).
 *
 * This hook intentionally only counts relations; Risk coverage is now materialized on each Risk
 * by the server-derived `risk_coverage` field rather than recomputed in the client.
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
