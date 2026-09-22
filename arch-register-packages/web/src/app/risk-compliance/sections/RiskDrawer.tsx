import { EntityDrawer } from '../../../sections/entities/entityDrawer/EntityDrawer';
import { formatIsoDate } from '../../../utils/dateFormat';

/**
 * Route adapter for the shared configurable entity drawer. Risk-specific derived content,
 * including the residual-risk-band header badge, is supplied by the drawer profile configuration
 * and the entity-drawer badge registry.
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
