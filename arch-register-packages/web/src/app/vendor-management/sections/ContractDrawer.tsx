import { useNavigate } from '@tanstack/react-router';
import { EntityDrawer } from '../../../sections/entities/entityDrawer/EntityDrawer';
import { VENDOR_RAIL_PATHS, VENDOR_VENDORS_ID } from '../vendorManagementSections';

/**
 * Shared, configurable Contract drawer used by the Contracts list and renewal calendar. The
 * contract profile owns declarative fields, the systems-used provider, and the renewal-window
 * header badge; this adapter retains Vendor Management's nested vendor navigation (see #3372 for
 * generalizing nested drawer navigation).
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
      entityLabel="contract"
    />
  );
};
