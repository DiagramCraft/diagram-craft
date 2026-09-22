import { EntityDrawer } from '../../../sections/entities/entityDrawer/EntityDrawer';

/**
 * Strategy route adapter for the shared configurable entity drawer. The adapter keeps the
 * section-specific child replacement callback while the renderer owns entity loading, identity,
 * profile resolution, permissions, and the full-record action.
 *
 * Kept as a wrapper (rather than inlined, #3394) for its one extra prop: `onOpenEntity`. Each call
 * site drills down within the Strategy rail's own `$capabilityId` route param, rather than
 * `EntityDrawer`'s built-in default (navigating to the generic Entities detail route) — deliberate,
 * to keep the user in-rail. Documented per-app exception, not a candidate to generalize.
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
