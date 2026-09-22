import { EntityDrawer } from '../../../sections/entities/entityDrawer/EntityDrawer';

/**
 * Strategy route adapter for the shared configurable entity drawer. The adapter keeps the
 * section-specific child replacement callback while the renderer owns entity loading, identity,
 * profile resolution, permissions, and the full-record action.
 */
export const CapabilityDrawer = ({
  workspaceSlug,
  capabilityId,
  onClose,
  onOpenCapability
}: {
  workspaceSlug: string;
  capabilityId: string;
  onClose: () => void;
  onOpenCapability: (id: string) => void;
}) => (
  <EntityDrawer
    workspaceSlug={workspaceSlug}
    entityId={capabilityId}
    onClose={onClose}
    onOpenEntity={onOpenCapability}
    entityLabel="capability"
  />
);
