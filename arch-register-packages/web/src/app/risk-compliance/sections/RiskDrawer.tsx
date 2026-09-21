import { EntityDrawer } from '../../../sections/entities/entityDrawer/EntityDrawer';
import { Chip } from '../../../components/Chip';
import { RESIDUAL_RISK_BAND_COLOR, residualRiskBand } from '../residualRiskBand';

/**
 * Route adapter for the shared configurable entity drawer. Risk-specific derived content stays in
 * the Risk & Compliance provider registry; the residual band is a fixed supplemental badge because
 * it is derived from the entity score rather than being a persisted field configuration item.
 */
export const RiskDrawer = ({
  workspaceSlug,
  riskId,
  onClose
}: {
  workspaceSlug: string;
  riskId: string;
  onClose: () => void;
}) => (
  <EntityDrawer
    workspaceSlug={workspaceSlug}
    entityId={riskId}
    onClose={onClose}
    additionalBadges={entity => {
      const score =
        typeof entity.residual_risk_score === 'number' ? entity.residual_risk_score : null;
      const band = residualRiskBand(score);
      return band ? (
        <Chip dot={RESIDUAL_RISK_BAND_COLOR[band]} tone="ghost">
          {band}
        </Chip>
      ) : null;
    }}
    loadingMessage="Loading risk…"
    unavailableMessage="This risk is unavailable."
  />
);
