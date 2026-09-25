import { useQuery } from '@tanstack/react-query';
import { useParams, useSearch } from '@tanstack/react-router';
import { Title } from '../../../components/Title';
import { Button } from '@diagram-craft/app-components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { useLifecycleStates } from '../../../hooks/useWorkspaceConfig';
import { useSchemas } from '../../../hooks/useSchemas';
import { resolveApiIntegrationCatalogConfig } from '../apiIntegrationCatalogQueries';
import {
  resolveTypedRelationSchemaId,
  PROVIDERS_FIELD,
  CONSUMERS_FIELD
} from '../apiEndpointRelations';
import type { ApiIntegrationCatalogImpactSearchParams } from '../../../routes/searchParams';
import { useEntityDrawer } from '../../../sections/entities/entityDrawer/useEntityDrawer';
import { ApiBlastRadiusPanel } from './ApiBlastRadiusPanel';
import styles from './ApiIntegrationCatalogPlaceholderScreen.module.css';

/**
 * The Impact section (#3320): a single-API blast-radius inspector, the API picked from the
 * section's own primary sidebar (`ImpactSidebarContent` in `ApiIntegrationCatalogSidebar.tsx`) —
 * mirrors the Claude Design reference's `ICImpact` (`ic-views.jsx`), which dedicates the whole main
 * content area to one specification's impact rather than a list, including its three-column
 * providers / direct consumers / second-order "Blast radius" panel (`ApiBlastRadiusPanel`) — but
 * backed by the generic traversal engine shipped by #2979 scoped to `Provides API`/`Consumes API`
 * instead of the design's bespoke, fabricated "consumer registration" model.
 */
export const ApiIntegrationCatalogImpactScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const search = useSearch({ strict: false }) as ApiIntegrationCatalogImpactSearchParams;
  const { openEntityDrawer } = useEntityDrawer();
  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const apiConfig = resolveApiIntegrationCatalogConfig(configurations.data);
  const schemas = useSchemas(workspaceSlug);
  const apiSchema = schemas.data?.find(schema => schema.id === apiConfig?.apiSchemaId);
  const { data: lifecycleStates = [] } = useLifecycleStates(workspaceSlug);

  const apis = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: apiConfig?.apiSchemaId, limit: 500 },
      apiConfig != null
    )
  );
  const selectedApi = apis.data?.items.find(entity => entity._publicId === search.api);

  const providersRelationSchemaId = resolveTypedRelationSchemaId(apiSchema, PROVIDERS_FIELD);
  const consumersRelationSchemaId = resolveTypedRelationSchemaId(apiSchema, CONSUMERS_FIELD);

  if (configurations.isLoading) {
    return <div className={styles.empty}>Loading API & Integration Catalog…</div>;
  }
  if (!apiConfig) {
    return (
      <div className={styles.empty}>
        API & Integration Catalog is not enabled. Configure the API specification capability in
        workspace settings.
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      {!selectedApi ? (
        <>
          <Title title="Impact" />
          <EmptyState
            title="Select an API"
            subtitle="Pick an API from the sidebar to see what a change to it would reach."
          />
        </>
      ) : (
        <>
          <Title
            title={`Impact — ${selectedApi._name}`}
            buttons={
              <Button variant="secondary" onClick={() => openEntityDrawer(selectedApi._publicId)}>
                Open specification
              </Button>
            }
            description={
              'What a change to this specification would reach: registered consumers, then whatever consumes their APIs in turn.'
            }
          />
          <ApiBlastRadiusPanel
            workspaceId={workspaceSlug}
            apiId={selectedApi._uid}
            providersRelationSchemaId={providersRelationSchemaId}
            consumersRelationSchemaId={consumersRelationSchemaId}
            schemas={schemas.data ?? []}
            lifecycleStates={lifecycleStates}
          />
        </>
      )}
    </div>
  );
};
