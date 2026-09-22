import { EntityDrawer } from '../../../sections/entities/entityDrawer/EntityDrawer';
import { formatIsoDate } from '../../../utils/dateFormat';

/**
 * Route adapter for the shared configurable entity drawer. Risk-specific derived content stays in
 * the Risk & Compliance provider registry.
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
    formatDateValue={formatIsoDate}
    entityLabel="risk"
  />
);
