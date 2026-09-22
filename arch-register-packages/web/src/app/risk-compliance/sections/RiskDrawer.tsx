import { EntityDrawer } from '../../../sections/entities/entityDrawer/EntityDrawer';
import { formatIsoDate } from '../../../utils/dateFormat';

/**
 * Route adapter for the shared configurable entity drawer. Risk-specific derived content stays in
 * the Risk & Compliance provider registry.
 *
 * Kept as a wrapper (rather than inlined, #3394) for its one extra prop: `formatDateValue`. ISO
 * dates are a Risk & Compliance-specific convention — `EntityDrawer`'s own default (`formatDate`,
 * locale-formatted) differs in output, so making ISO the shared default would change date
 * rendering for every other drawer. Documented per-app exception, not a candidate to generalize.
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
