import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { ApiIntegrationCatalogSingleStatTile } from '../sections/ApiIntegrationCatalogSingleStatTile';

import { type BaseWidgetConfig } from '../apiCatalogWidgetSupport';

export const ApiCatalogPairGapsWidget = ({ config: _config }: { config: BaseWidgetConfig }) => {
  const { workspaceSlug } = useWorkspaceContext();
  return <ApiIntegrationCatalogSingleStatTile workspaceId={workspaceSlug} kind="pair-gaps" />;
};
