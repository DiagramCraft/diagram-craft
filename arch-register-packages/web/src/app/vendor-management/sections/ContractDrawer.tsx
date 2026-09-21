import { useNavigate } from '@tanstack/react-router';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { Chip } from '../../../components/Chip';
import { EntityDrawer } from '../../../sections/entities/entityDrawer/EntityDrawer';
import { renewalWindow, RENEWAL_WINDOWS, RENEWAL_WINDOW_COLOR } from '../contractRenewalWindow';
import { VENDOR_RAIL_PATHS, VENDOR_VENDORS_ID } from '../vendorManagementSections';

const RENEWAL_WINDOW_LABEL = new Map(RENEWAL_WINDOWS.map(window => [window.id, window.label]));

/**
 * Shared, configurable Contract drawer used by the Contracts list and renewal calendar. The
 * contract profile owns declarative fields and the systems-used provider; this adapter retains the
 * computed renewal badge and Vendor Management's nested vendor navigation.
 */
export const ContractDrawer = ({
  workspaceSlug,
  contractId,
  onClose
}: {
  workspaceSlug: string;
  contractId: string;
  onClose: () => void;
}) => {
  const navigate = useNavigate();

  const openRelatedEntity = (fieldId: string, publicId: string): boolean => {
    if (fieldId !== 'vendor') return false;
    navigate({
      to: `${VENDOR_RAIL_PATHS[VENDOR_VENDORS_ID]}/$vendorId`,
      params: { workspaceSlug, vendorId: publicId },
      search: (previous: Record<string, unknown>) => previous
    });
    return true;
  };

  return (
    <EntityDrawer
      workspaceSlug={workspaceSlug}
      entityId={contractId}
      onClose={onClose}
      onOpenRelatedEntity={openRelatedEntity}
      additionalBadges={(entity: EntityRecord) => {
        const contractWindow = renewalWindow(
          typeof entity.contract_end === 'string' ? entity.contract_end : null
        );
        return (
          <Chip dot={RENEWAL_WINDOW_COLOR[contractWindow]} tone="ghost">
            {RENEWAL_WINDOW_LABEL.get(contractWindow)}
          </Chip>
        );
      }}
      loadingMessage="Loading contract…"
      unavailableMessage="This contract is unavailable."
    />
  );
};
