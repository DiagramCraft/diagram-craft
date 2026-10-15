import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { ApiIntegrationCatalogStatTiles } from '../sections/ApiIntegrationCatalogStatTiles';

import { type BaseWidgetConfig } from '../apiCatalogWidgetSupport';

export const ApiCatalogStatsWidget = ({ config: _config }: { config: BaseWidgetConfig }) => {
  const { workspaceSlug } = useWorkspaceContext();
  return <ApiIntegrationCatalogStatTiles workspaceId={workspaceSlug} />;
};
