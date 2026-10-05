import { useMemo, useState } from 'react';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';
import { useEntities } from '../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntityDrawer } from '../../../sections/entities/entityDrawer/useEntityDrawer';
import { RiskComplianceMatrix, type RiskComplianceMatrixRisk } from './RiskComplianceMatrix';
import styles from '../../../sections/dashboard/widgets/WidgetRowList.module.css';

const FETCH_LIMIT = 500;

export type RiskMatrixAxis = 'inherent' | 'residual';

export type RiskMatrixWidgetConfig = {
  schemaName: string;
  axis?: RiskMatrixAxis;
  label?: string;
  /** Include closed risks (default: false). */
  includeClosed?: boolean;
  /**
   * Optional facet filters on the Category / Status / Risk Owner fields. Intended to hold
   * dashboard sidebar references (e.g. `['$categories']`); an empty list, or an unresolved
   * reference, means "no filter".
   */
  categories?: string[];
  statuses?: string[];
  owners?: string[];
};

/** Drops unresolved `$variable` references; an empty result means the facet is not filtering. */
const activeFilter = (values: string[] | undefined): string[] =>
  (values ?? []).filter(value => value !== '' && !value.startsWith('$'));

type Props = {
  config: RiskMatrixWidgetConfig;
};

/**
 * Likelihood × impact matrix over the (by default live, i.e. not closed) entities of a Risk-shaped schema, with an
 * Inherent/Residual axis toggle. Wraps `RiskComplianceMatrix`.
 */
const matchesFacet = (selected: string[], value: unknown): boolean =>
  selected.length === 0 || (typeof value === 'string' && selected.includes(value));

export const RiskMatrixWidget = ({ config }: Props) => {
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const { openEntityDrawer } = useEntityDrawer();
  const [axis, setAxis] = useState<RiskMatrixAxis>(config.axis ?? 'inherent');
  const categories = activeFilter(config.categories);
  const statuses = activeFilter(config.statuses);
  const owners = activeFilter(config.owners);
  const schema = schemas.find(candidate => candidate.name === config.schemaName);

  const { data: entities = [], isLoading } = useEntities(
    workspaceSlug,
    { schemaId: schema?.id, limit: FETCH_LIMIT },
    { enabled: !!workspaceSlug && !!schema }
  );

  const risks = useMemo<RiskComplianceMatrixRisk[]>(
    () =>
      entities
        .filter(entity => config.includeClosed || entity.status !== 'closed')
        .filter(
          entity =>
            matchesFacet(categories, entity.category) &&
            matchesFacet(statuses, entity.status) &&
            matchesFacet(owners, entity.risk_owner)
        )
        .map(entity => ({
          id: entity._publicId,
          name: entity._name,
          likelihood: typeof entity.likelihood === 'number' ? entity.likelihood : null,
          impact: typeof entity.impact === 'number' ? entity.impact : null,
          residualRiskScore:
            typeof entity.residual_risk_score === 'number' ? entity.residual_risk_score : null
        })),
    [entities, config.includeClosed, categories, statuses, owners]
  );

  if (!schema) {
    return <div className={`${styles.emptyInline} dim`}>This widget is not fully configured.</div>;
  }
  if (isLoading) {
    return <div className={`${styles.emptyInline} dim`}>Loading risks…</div>;
  }

  return (
    <div>
      <ToggleButtonGroup.Root
        type="single"
        aria-label="Matrix axis"
        value={axis}
        onChange={value => {
          if (value) setAxis(value as RiskMatrixAxis);
        }}
      >
        <ToggleButtonGroup.Item value="inherent">Inherent</ToggleButtonGroup.Item>
        <ToggleButtonGroup.Item value="residual">Residual</ToggleButtonGroup.Item>
      </ToggleButtonGroup.Root>
      <RiskComplianceMatrix risks={risks} axis={axis} onOpenRisk={id => openEntityDrawer(id)} />
    </div>
  );
};
