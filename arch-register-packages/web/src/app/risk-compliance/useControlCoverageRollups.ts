import { useMemo } from 'react';
import { useRelations } from '../../hooks/useRelations';
import { computeRiskCoverage, type RiskCoverageResult } from './riskCoverage';

export type ControlCoverageRollups = {
  byId: Map<string, RiskCoverageResult>;
  riskCountById: Map<string, number>;
  isLoading: boolean;
  error: Error | null;
};

const EMPTY: ControlCoverageRollups = {
  byId: new Map(),
  riskCountById: new Map(),
  isLoading: false,
  error: null
};

/**
 * Control-keyed sibling of `useRiskCoverageRollups.ts`: same `relations.list` request over every
 * `risk-control` relation in the workspace, but grouped by the mitigating Control's `_uid`
 * (`relation._out.id` — Control is the `_out` side, mirroring `ControlDrawer.tsx`'s
 * `mitigatedRisks` filter) instead of the mitigated Risk's. Reuses `computeRiskCoverage` as-is —
 * the math is symmetric, it just answers "how well does this Control's own set of `risk-control`
 * relations perform" rather than "how well is this Risk covered".
 */
export const useControlCoverageRollups = (
  workspaceId: string,
  riskControlRelationSchemaId: string | null
): ControlCoverageRollups => {
  const enabled = !!riskControlRelationSchemaId;
  const query = useRelations(
    workspaceId,
    { schemaId: riskControlRelationSchemaId ?? undefined, limit: 1000 },
    { enabled }
  );

  const { byId, riskCountById } = useMemo(() => {
    const byControlId = new Map<
      string,
      { coverage: number | null; effectiveness: string | null }[]
    >();
    for (const relation of query.data) {
      const controlId = relation._out.id;
      const entry = byControlId.get(controlId) ?? [];
      entry.push({
        coverage: typeof relation.coverage === 'number' ? relation.coverage : null,
        effectiveness: typeof relation.effectiveness === 'string' ? relation.effectiveness : null
      });
      byControlId.set(controlId, entry);
    }
    const byId = new Map<string, RiskCoverageResult>();
    const riskCountById = new Map<string, number>();
    for (const [controlId, relations] of byControlId) {
      byId.set(controlId, computeRiskCoverage(relations));
      riskCountById.set(controlId, relations.length);
    }
    return { byId, riskCountById };
  }, [query.data]);

  if (!enabled) return EMPTY;

  const error =
    query.error instanceof Error
      ? query.error
      : query.error
        ? new Error(String(query.error))
        : null;

  return { byId, riskCountById, isLoading: query.isLoading, error };
};
