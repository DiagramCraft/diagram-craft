import { EntityDrawer } from '../../../sections/entities/entityDrawer/EntityDrawer';

/**
 * Shared, configurable Vendor drawer used by the Vendors, Spend, and Risk routes. Vendor-specific
 * fields and derived application content are supplied by the Vendor Management drawer profile and
 * provider registry.
 */
export const VendorDrawer = ({
  workspaceSlug,
  vendorId,
  onClose
}: {
  workspaceSlug: string;
  vendorId: string;
  onClose: () => void;
}) => (
  <EntityDrawer
    workspaceSlug={workspaceSlug}
    entityId={vendorId}
    entityLabel="vendor"
    onClose={onClose}
  />
);
