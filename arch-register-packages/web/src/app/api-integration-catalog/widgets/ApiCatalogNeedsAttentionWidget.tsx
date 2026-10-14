import { TbAlertTriangle } from 'react-icons/tb';
import { Banner } from '../../../components/Banner';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { useResolvedApiIntegrationCatalogConfig } from '../useResolvedApiIntegrationCatalogConfig';
import { useNeedsAttentionQueue } from '../../../sections/dashboard/widgets/needsAttentionQueue';
import { NeedsAttentionList } from '../../../sections/dashboard/widgets/NeedsAttentionList';
import { IC_QUEUE_CASE_KINDS } from '../apiIntegrationCatalogQueue';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import {
  isValidListConfig,
  ListConfigForm,
  useApiCatalogNavigation,
  type ListWidgetConfig
} from '../apiCatalogWidgetSupport';

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

const ApiCatalogNeedsAttentionHeaderActions = () => {
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

export const apiCatalogNeedsAttentionSpec = defineComponent({
  type: 'api-integration-catalog-needs-attention',
  category: 'data-views',
  surfaces: ['dashboard'],
  dashboardWidget: {
    icon: TbAlertTriangle,
    label: 'API needs attention',
    description: 'Open API change and deprecation cases awaiting a decision.',
    defaultW: 6,
    defaultH: 16,
    surfaces: ['workspace'],
    component: ApiCatalogNeedsAttentionWidget,
    headerActionsComponent: ApiCatalogNeedsAttentionHeaderActions,
    frame: { padded: false, showIcon: false },
    isValidConfig: isValidListConfig,
    createDefaultConfig: () => ({ limit: 8 }),
    configForm: ListConfigForm
  }
});
