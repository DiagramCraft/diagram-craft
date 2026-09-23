import { Chip } from '../../../components/Chip';
import { useRiskCoverageRollup } from '../useRiskCoverageRollup';
import {
  type EntityDrawerProviderContext,
  type EntityDrawerProviderDefinition,
  type EntityDrawerProviderProps
} from '../../../sections/entities/entityDrawer/EntityDrawerProviderRegistry';
import { COVERAGE_BAND_COLOR } from '../riskCoverage';
import styles from './RiskEntityDrawerProviders.module.css';

const typedRelationField = (context: EntityDrawerProviderContext, fieldId: string) => {
  const field = context.schema.fields.find(candidate => candidate.id === fieldId);
  return field?.type === 'typedRelation' ? field : undefined;
};

const supportsRiskField = (fieldId: string) => (context: EntityDrawerProviderContext) =>
  typedRelationField(context, fieldId) !== undefined;

// Renders only the coverage stat + band — the "Mitigating controls" row list moved to a
// `typed-relation-list` drawer item (see `schemaTemplates.ts`'s `risk` profile), since
// `mitigating_controls` is a plain typed-relation field and needs no bespoke rendering.
const RiskCoverageProvider = ({ context }: EntityDrawerProviderProps) => {
  const field = typedRelationField(context, 'mitigating_controls');
  const coverage = useRiskCoverageRollup(
    context.workspaceId,
    context.entity._uid,
    field?.relationSchemaId ?? null
  );

  return (
    <>
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
    </>
  );
};

export const riskEntityDrawerProviderDefinitions = [
  {
    slotId: 'risk.coverage',
    supports: supportsRiskField('mitigating_controls'),
    Component: RiskCoverageProvider
  }
] satisfies readonly EntityDrawerProviderDefinition[];
