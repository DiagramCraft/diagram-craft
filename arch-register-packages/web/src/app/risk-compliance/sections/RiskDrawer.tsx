import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@diagram-craft/app-components/Button';
import { Chip } from '../../../components/Chip';
import { Drawer } from '../../../components/Drawer';
import { useSchemas } from '../../../hooks/useSchemas';
import { useEntityTypedRelations } from '../../../hooks/useRelations';
import { entityDetailQuery } from '../../../queries/entities';
import { asEntityPublicId, entityDetailRoute } from '../../../routes/publicObjectRoutes';
import { useRiskCoverageRollup } from '../useRiskCoverageRollup';
import { RESIDUAL_RISK_BAND_COLOR, residualRiskBand } from '../residualRiskBand';
import { COVERAGE_BAND_COLOR } from '../riskCoverage';
import { fieldLabel, riskFieldValue } from '../riskFieldDisplay';
import type { RiskComplianceConfig } from '../riskComplianceQueries';
import styles from './RiskDrawer.module.css';

const RISK_PROFILE_FIELDS = [
  'likelihood',
  'impact',
  'inherent_risk_score',
  'mitigation_effectiveness',
  'residual_risk_score'
] as const;

const ATTRIBUTE_FIELDS = ['category', 'status', 'risk_owner', 'treatment_target_date'] as const;

const RISK_AFFECTS_SCHEMA_ROLE_FIELD = 'affected_entities';
const RISK_MITIGATING_CONTROLS_FIELD = 'mitigating_controls';

/**
 * Slide-over showing one Risk's profile (likelihood/impact/inherent/residual score, banded),
 * attributes, multi-control coverage roll-up, and the entities it affects — mirrors
 * `../../vendor-management/sections/VendorDrawer.tsx`. Deep-linkable from the Risks list
 * (`risk-compliance/risks/$riskId`).
 */
export const RiskDrawer = ({
  workspaceSlug,
  riskId,
  riskConfig,
  onClose
}: {
  workspaceSlug: string;
  riskId: string;
  riskConfig: RiskComplianceConfig;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const risk = useQuery(entityDetailQuery(workspaceSlug, riskId));
  const uid = risk.data?._uid ?? null;
  const schemas = useSchemas(workspaceSlug);
  const riskSchema = schemas.data?.find(schema => schema.id === riskConfig.riskSchemaId);

  // `risk-control`/`risk-affects` aren't capability bindings (they're fixed relations on Risk's
  // own typedRelation fields) — read their real, per-workspace relation schema ids off those
  // fields, mirroring `VendorDrawer.tsx`'s `systemContractRelationSchemaId`.
  const mitigatingControlsField = riskSchema?.fields.find(
    field => field.id === RISK_MITIGATING_CONTROLS_FIELD
  );
  const riskControlRelationSchemaId =
    mitigatingControlsField?.type === 'typedRelation'
      ? mitigatingControlsField.relationSchemaId
      : null;
  const affectsField = riskSchema?.fields.find(
    field => field.id === RISK_AFFECTS_SCHEMA_ROLE_FIELD
  );
  const riskAffectsRelationSchemaId =
    affectsField?.type === 'typedRelation' ? affectsField.relationSchemaId : null;

  const coverage = useRiskCoverageRollup(workspaceSlug, uid, riskControlRelationSchemaId);
  const relations = useEntityTypedRelations(workspaceSlug, uid ?? '');
  const affected = [
    ...(relations.data?.outgoing ?? []),
    ...(relations.data?.incoming ?? [])
  ].filter(
    relation => relation._schema.id === riskAffectsRelationSchemaId && relation._in.id === uid
  );

  if (risk.isLoading) {
    return (
      <Drawer onClose={onClose} title="Loading…">
        <div className={styles.empty}>Loading risk…</div>
      </Drawer>
    );
  }
  if (risk.isError || !risk.data) {
    return (
      <Drawer onClose={onClose} title="Unavailable">
        <div className={styles.empty}>This risk is unavailable.</div>
      </Drawer>
    );
  }

  const entity = risk.data;
  const residualScore =
    typeof entity.residual_risk_score === 'number' ? entity.residual_risk_score : null;
  const band = residualRiskBand(residualScore);

  return (
    <Drawer
      onClose={onClose}
      eyebrow={<span className="dim mono">{entity._publicId}</span>}
      title={entity._name}
      badges={
        <>
          {typeof entity.category === 'string' && <Chip tone="ghost">{entity.category}</Chip>}
          {typeof entity.status === 'string' && <Chip tone="ghost">{entity.status}</Chip>}
        </>
      }
      footer={
        <Button
          variant="primary"
          onClick={() =>
            navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entity._publicId)))
          }
        >
          Open record in Entities
        </Button>
      }
    >
      <div className={styles.sectionLabel}>Risk profile</div>
      <div className={styles.statGrid}>
        {RISK_PROFILE_FIELDS.map(fieldId => (
          <div className={styles.stat} key={fieldId}>
            <div className={styles.statLabel}>{fieldLabel(riskSchema, fieldId)}</div>
            <div className={styles.statValue}>{riskFieldValue(riskSchema, entity, fieldId)}</div>
          </div>
        ))}
      </div>
      {band && (
        <div className={styles.riskBandRow}>
          <Chip dot={RESIDUAL_RISK_BAND_COLOR[band]} tone="ghost">
            {band}
          </Chip>
        </div>
      )}

      <div className={styles.sectionLabel}>Attributes</div>
      {ATTRIBUTE_FIELDS.map(fieldId => (
        <div className={styles.attributeRow} key={fieldId}>
          <span className={styles.attributeLabel}>{fieldLabel(riskSchema, fieldId)}</span>
          <span>{riskFieldValue(riskSchema, entity, fieldId)}</span>
        </div>
      ))}

      <div className={styles.sectionLabel}>
        Coverage
        <span className={styles.sectionCaption}>
          Combined coverage across every mitigating Control.
        </span>
      </div>
      <div className={styles.statGrid}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>rcCoverage</div>
          <div className={styles.statValue}>
            {coverage.rcCoverage != null ? `${coverage.rcCoverage.toFixed(1)}%` : '—'}
          </div>
        </div>
      </div>
      {coverage.rcBand && (
        <div className={styles.riskBandRow}>
          <Chip dot={COVERAGE_BAND_COLOR[coverage.rcBand]} tone="ghost">
            {coverage.rcBand}
          </Chip>
        </div>
      )}

      <div className={styles.sectionLabel}>Mitigating controls</div>
      {coverage.isLoading ? (
        <span className="dim">Loading…</span>
      ) : coverage.controls.length > 0 ? (
        coverage.controls.map(({ relation, controlId, controlName }) => (
          <div className={styles.attributeRow} key={controlId}>
            <span className={styles.attributeLabel}>{controlName}</span>
            <span>
              {typeof relation.coverage === 'number' ? `${relation.coverage}%` : '—'} ·{' '}
              {typeof relation.effectiveness === 'string' ? relation.effectiveness : '—'}
            </span>
          </div>
        ))
      ) : (
        <span className="dim">No mitigating controls.</span>
      )}

      <div className={styles.sectionLabel}>Affected entities</div>
      {relations.isLoading ? (
        <span className="dim">Loading…</span>
      ) : affected.length > 0 ? (
        <div className={styles.tags}>
          {affected.map(relation => (
            <Chip key={relation._uid} tone="ghost">
              {relation._out.name}
            </Chip>
          ))}
        </div>
      ) : (
        <span className="dim">No affected entities linked.</span>
      )}
    </Drawer>
  );
};
