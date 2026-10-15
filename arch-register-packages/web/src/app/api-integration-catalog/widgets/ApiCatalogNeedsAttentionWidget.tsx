import { Banner } from '../../../components/Banner';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { useResolvedApiIntegrationCatalogConfig } from '../useResolvedApiIntegrationCatalogConfig';
import { useNeedsAttentionQueue } from '../../../widgets/data-views/needs-attention/needsAttentionQueue';
import { NeedsAttentionList } from '../../../widgets/data-views/needs-attention/NeedsAttentionList';
import { IC_QUEUE_CASE_KINDS } from '../apiIntegrationCatalogQueue';

import { useApiCatalogNavigation, type ListWidgetConfig } from '../apiCatalogWidgetSupport';

export const ApiCatalogNeedsAttentionWidget = ({ config }: { config: ListWidgetConfig }) => {
  const { workspaceSlug, openApi } = useApiCatalogNavigation();
  const { apiConfig, isLoading, isError } = useResolvedApiIntegrationCatalogConfig(workspaceSlug);
  const apiSchemaId = apiConfig?.apiSchemaId ?? null;
  const queue = useNeedsAttentionQueue(
    workspaceSlug,
    { schemaId: apiSchemaId, caseKinds: IC_QUEUE_CASE_KINDS, scope: 'workspace' },
    apiSchemaId != null
  );

  if (isLoading) return <LoadingState text="Loading API catalog…" size="sm" />;
  if (isError) return <Banner variant="error">Could not load API catalog configuration.</Banner>;
  if (!apiConfig) return <EmptyState title="API specification not configured" compact />;

  return (
    <NeedsAttentionList
      items={queue.items}
      isLoading={queue.isLoading}
      isError={queue.isError}
      severity="due-date"
      limit={config.limit}
      onOpenEntity={openApi}
    />
  );
};

export const ApiCatalogNeedsAttentionHeaderActions = () => {
  const { workspaceSlug } = useApiCatalogNavigation();
  const { apiConfig } = useResolvedApiIntegrationCatalogConfig(workspaceSlug);
  const apiSchemaId = apiConfig?.apiSchemaId ?? null;
  const queue = useNeedsAttentionQueue(
    workspaceSlug,
    { schemaId: apiSchemaId, caseKinds: IC_QUEUE_CASE_KINDS, scope: 'workspace' },
    apiSchemaId != null
  );
  return <span className="dim mono">{queue.items.length}</span>;
};
