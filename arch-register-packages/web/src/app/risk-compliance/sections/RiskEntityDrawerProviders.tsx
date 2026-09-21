import { Chip } from '../../../components/Chip';
import { useRiskCoverageRollup } from '../useRiskCoverageRollup';
import {
  EntityDrawerProviderStatus,
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

const allTypedRelations = (context: EntityDrawerProviderContext) => [
  ...context.typedRelations.outgoing,
  ...context.typedRelations.incoming
];

const supportsRiskField = (fieldId: string) => (context: EntityDrawerProviderContext) =>
  typedRelationField(context, fieldId) !== undefined;

const RiskCoverageProvider = ({
  context,
  label,
  showLabel
}: EntityDrawerProviderProps) => {
  const field = typedRelationField(context, 'mitigating_controls');
  const coverage = useRiskCoverageRollup(
    context.workspaceId,
    context.entity._uid,
    field?.relationSchemaId ?? null
  );
  const controlsState = coverage.isLoading
    ? 'loading'
    : coverage.error
      ? 'unavailable'
      : coverage.controls.length > 0
        ? 'ready'
        : 'empty';

  return (
    <div className={styles.provider}>
      {showLabel !== false && <div className={styles.sectionLabel}>{label}</div>}
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
      <EntityDrawerProviderStatus
        state={controlsState}
        emptyMessage="No mitigating controls."
        unavailableMessage="Mitigating controls are unavailable."
      >
        {coverage.controls.map(({ relation, controlId, controlName }) => (
          <div className={styles.attributeRow} key={controlId}>
            <span className={styles.attributeLabel}>{controlName}</span>
            <span className={styles.attributeValue}>
              {typeof relation.coverage === 'number' ? `${relation.coverage}%` : '—'} ·{' '}
              {typeof relation.effectiveness === 'string' ? relation.effectiveness : '—'}
            </span>
          </div>
        ))}
      </EntityDrawerProviderStatus>
    </div>
  );
};

const AffectedEntitiesProvider = ({
  context,
  label,
  showLabel
}: EntityDrawerProviderProps) => {
  const field = typedRelationField(context, 'affected_entities');
  const matches = field
    ? allTypedRelations(context).filter(
        relation =>
          relation._schema.id === field.relationSchemaId && relation._in.id === context.entity._uid
      )
    : [];
  const state = context.typedRelationsStatus.isLoading
    ? 'loading'
    : context.typedRelationsStatus.isError
      ? 'unavailable'
      : matches.length > 0
        ? 'ready'
        : 'empty';

  return (
    <div className={styles.provider}>
      {showLabel !== false && <div className={styles.sectionLabel}>{label}</div>}
      <EntityDrawerProviderStatus
        state={state}
        emptyMessage="No affected entities linked."
        unavailableMessage="Affected entities are unavailable."
      >
        <div className={styles.tags}>
          {matches.map(relation => (
            <Chip key={relation._uid} tone="ghost">
              {relation._out.name}
            </Chip>
          ))}
        </div>
      </EntityDrawerProviderStatus>
    </div>
  );
};

export const riskEntityDrawerProviderDefinitions = [
  {
    slotId: 'risk.coverage',
    supports: supportsRiskField('mitigating_controls'),
    Component: RiskCoverageProvider
  },
  {
    slotId: 'risk.affected-entities',
    supports: supportsRiskField('affected_entities'),
    Component: AffectedEntitiesProvider
  }
] satisfies readonly EntityDrawerProviderDefinition[];
