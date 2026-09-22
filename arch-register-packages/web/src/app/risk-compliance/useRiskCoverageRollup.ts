import type { RelationRecord } from '@arch-register/api-types/relationContract';
import { useEntityTypedRelations } from '../../hooks/useRelations';
import { computeRiskCoverage, type RiskCoverageResult } from './riskCoverage';

/** One mitigating Control relation, resolved for display in the Risk drawer's Coverage section. */
export type RiskMitigatingControl = {
  relation: RelationRecord;
  controlId: string;
  controlName: string;
};

export type RiskCoverageRollup = RiskCoverageResult & {
  controls: RiskMitigatingControl[];
  isLoading: boolean;
  error: Error | null;
};

const EMPTY: RiskCoverageRollup = {
  rcCoverage: null,
  rcBand: null,
  controls: [],
  isLoading: false,
  error: null
};

/**
 * `risk-control` relations already carry their own `coverage`/`effectiveness` — unlike the vendor
 * spend roll-up, there's no metric-engine traversal needed, just this Risk's own typed relations
 * (`useEntityTypedRelations`, one `relations.listForEntity` request), which already return each
 * relation's `_in`/`_out` endpoint `{id, name, schemaId}` alongside its own fields. No second
 * fetch is needed to name the mitigating Controls.
 *
 * `riskControlRelationSchemaId` is the real, per-workspace relation schema id — like
 * `VendorEntityDrawerProviders.tsx`'s `systemContractRelationSchemaId`, `risk-control` isn't a capability
 * binding (it's a fixed relation on Risk's own `mitigating_controls` field), so callers resolve
 * it off that field's `relationSchemaId` rather than matching the template's `symRelationSchemaId`
 * string, which isn't the persisted schema id.
 *
 * A relation's Risk/Control role is read off `_in`/`_out` directly rather than trusted from the
 * `outgoing`/`incoming` bucket names — those buckets are keyed by which endpoint (`_in` vs
 * `_out`) this entity is, not by "this entity's own field direction", so relying on the bucket
 * name for a schema where the drawer's entity is the `_in` side (as Risk is on `risk-control`)
 * would be reading the API's internal endpoint-role naming instead of the schema semantics.
 */
export const useRiskCoverageRollup = (
  workspaceId: string,
  riskId: string | null,
  riskControlRelationSchemaId: string | null
): RiskCoverageRollup => {
  const query = useEntityTypedRelations(workspaceId, riskId ?? '');
  if (!riskId || !riskControlRelationSchemaId) return EMPTY;

  const all = [...(query.data?.outgoing ?? []), ...(query.data?.incoming ?? [])];
  const mitigations = all.filter(
    relation => relation._schema.id === riskControlRelationSchemaId && relation._in.id === riskId
  );

  const controls: RiskMitigatingControl[] = mitigations.map(relation => ({
    relation,
    controlId: relation._out.id,
    controlName: relation._out.name
  }));

  const coverage = computeRiskCoverage(
    mitigations.map(relation => ({
      coverage: typeof relation.coverage === 'number' ? relation.coverage : null,
      effectiveness: typeof relation.effectiveness === 'string' ? relation.effectiveness : null
    }))
  );

  const error =
    query.error instanceof Error
      ? query.error
      : query.error
        ? new Error(String(query.error))
        : null;

  return { ...coverage, controls, isLoading: query.isLoading, error };
};
