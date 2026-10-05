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
};

type Props = {
  config: RiskMatrixWidgetConfig;
};

/**
 * Likelihood × impact matrix over the live (not closed) entities of a Risk-shaped schema, with an
 * Inherent/Residual axis toggle. Wraps `RiskComplianceMatrix`.
 */
export const RiskMatrixWidget = ({ config }: Props) => {
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const { openEntityDrawer } = useEntityDrawer();
  const [axis, setAxis] = useState<RiskMatrixAxis>(config.axis ?? 'residual');
  const schema = schemas.find(candidate => candidate.name === config.schemaName);

  const { data: entities = [], isLoading } = useEntities(
    workspaceSlug,
    { schemaId: schema?.id, limit: FETCH_LIMIT },
    { enabled: !!workspaceSlug && !!schema }
  );

  const risks = useMemo<RiskComplianceMatrixRisk[]>(
    () =>
      entities
        .filter(entity => entity.status !== 'closed')
        .map(entity => ({
          id: entity._publicId,
          name: entity._name,
          likelihood: typeof entity.likelihood === 'number' ? entity.likelihood : null,
          impact: typeof entity.impact === 'number' ? entity.impact : null,
          residualRiskScore:
            typeof entity.residual_risk_score === 'number' ? entity.residual_risk_score : null
        })),
    [entities]
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
