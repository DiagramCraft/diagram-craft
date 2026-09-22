import { EntityDrawer } from '../../../sections/entities/entityDrawer/EntityDrawer';

/**
 * Route/application adapter for the configurable API entity drawer. The API-specific catalog is
 * registered as provider content, while identity, relations, fields, permissions, and layout are
 * supplied by the shared entity drawer renderer.
 */
export const ApiSpecDrawer = ({
  workspaceSlug,
  apiId,
  onClose
}: {
  workspaceSlug: string;
  apiId: string;
  onClose: () => void;
}) => (
  <EntityDrawer
    workspaceSlug={workspaceSlug}
    entityId={apiId}
    loadingMessage="Loading API…"
    unavailableMessage="This API is unavailable."
    onClose={onClose}
  />
);
