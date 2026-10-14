import { TbAffiliate } from 'react-icons/tb';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { useSchemas } from '../../../hooks/useSchemas';
import { useLifecycleStates } from '../../../hooks/useWorkspaceConfig';
import { useEntity } from '../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntityDrawer } from '../../../sections/entities/entityDrawer/useEntityDrawer';
import { BlastRadiusPanel } from '../../../sections/entities/components/BlastRadiusPanel';
import { useResolvedApiIntegrationCatalogConfig } from '../useResolvedApiIntegrationCatalogConfig';
import {
  PROVIDERS_FIELD,
  CONSUMERS_FIELD,
  resolveTypedRelationSchemaId
} from '../apiEndpointRelations';
import {
  API_BLAST_RADIUS_GROUPS,
  API_BLAST_RADIUS_MAX_DEPTH,
  API_BLAST_RADIUS_NO_PATHS_STATE,
  buildApiBlastRadiusPaths
} from '../sections/apiBlastRadiusConfig';
import panelStyles from '../sections/ApiIntegrationCatalogPanels.module.css';
import { defineComponent } from '../../../sections/markdown/mdx-components/defineComponent';
import { isValidImpactConfig, type ImpactWidgetConfig } from '../apiCatalogWidgetSupport';

export const ApiCatalogImpactWidget = ({ config }: { config: ImpactWidgetConfig }) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { apiConfig } = useResolvedApiIntegrationCatalogConfig(workspaceSlug);
  const schemas = useSchemas(workspaceSlug);
  const apiSchema = schemas.data?.find(schema => schema.id === apiConfig?.apiSchemaId);
  const { data: lifecycleStates = [] } = useLifecycleStates(workspaceSlug);
  const entityId = config.entityId ?? '';
  const { data: entity, isLoading } = useEntity(workspaceSlug, entityId, entityId !== '');

  if (entityId === '') {
    return (
      <EmptyState
        title="Select an API"
        subtitle="Pick an API from the sidebar to see what a change to it would reach."
      />
    );
  }
  if (isLoading || !entity) {
    return isLoading ? (
      <LoadingState text="Loading API…" size="sm" />
    ) : (
      <EmptyState title="API not found" subtitle="The selected API no longer exists." />
    );
  }

  const providersRelationSchemaId = resolveTypedRelationSchemaId(apiSchema, PROVIDERS_FIELD);
  const consumersRelationSchemaId = resolveTypedRelationSchemaId(apiSchema, CONSUMERS_FIELD);

  return (
    <BlastRadiusPanel
      workspaceId={workspaceSlug}
      subject={{ kind: 'entity', entityId: entity._uid }}
      paths={buildApiBlastRadiusPaths(providersRelationSchemaId, consumersRelationSchemaId)}
      groups={API_BLAST_RADIUS_GROUPS}
      showFilters={false}
      maxDepth={API_BLAST_RADIUS_MAX_DEPTH}
      noPathsState={API_BLAST_RADIUS_NO_PATHS_STATE}
      schemas={schemas.data ?? []}
      lifecycleStates={lifecycleStates}
      embedded
    />
  );
};

const ApiCatalogImpactHeaderActions = ({ config }: { config: ImpactWidgetConfig }) => {
  const { openEntityDrawer } = useEntityDrawer();
  const entityId = config.entityId ?? '';
  if (entityId === '') return null;
  return (
    <button
      type="button"
      className={panelStyles.panelLink}
      onClick={() => openEntityDrawer(entityId)}
    >
      Open specification
    </button>
  );
};

export const apiCatalogImpactSpec = defineComponent({
  type: 'api-integration-catalog-impact',
  category: 'visualizations',
  surfaces: ['dashboard'],
  dashboardWidget: {
    icon: TbAffiliate,
    label: 'API impact',
    description:
      'Blast radius (providers, direct consumers, second order) for the API selected in the dashboard sidebar.',
    defaultW: 12,
    defaultH: 30,
    surfaces: ['workspace'],
    component: ApiCatalogImpactWidget,
    headerActionsComponent: ApiCatalogImpactHeaderActions,
    // BlastRadiusPanel owns its padding because it is also shared with the entity drawer.
    frame: { padded: false },
    isValidConfig: isValidImpactConfig,
    createDefaultConfig: () => ({ entityId: '$apiEntityId' }),
    getTitle: () => 'Blast radius'
  }
});
