import { EntityDrawer } from '../../../sections/entities/entityDrawer/EntityDrawer';
import { formatIsoDate } from '../../../utils/dateFormat';

/**
 * Route adapter for the shared configurable entity drawer. Risk-specific derived content stays in
 * the Risk & Compliance provider registry.
 *
 * The workspace-wide drawer uses the Risk & Compliance app's static ISO date display option. This
 * wrapper remains for Overview and Controls, which still mount a risk drawer locally while their
 * nested/stacked navigation is handled separately.
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
