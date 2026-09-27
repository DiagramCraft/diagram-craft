import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { Title } from '../../../components/Title';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { useRelations } from '../../../hooks/useRelations';
import { resolveApiIntegrationCatalogConfig } from '../apiIntegrationCatalogQueries';
import { useDataFlowConfig } from '../useDataFlowConfig';
import { useApiOperationsCounts } from '../useApiOperationsCounts';
import { IC_APIS_ID, IC_INTEGRATIONS_ID, IC_RAIL_PATHS } from '../apiIntegrationCatalogSections';
import { ApiIntegrationCatalogStatTiles } from './ApiIntegrationCatalogStatTiles';
import { ApiIntegrationCatalogNeedsAttentionPanel } from './ApiIntegrationCatalogNeedsAttentionPanel';
import { ApiIntegrationCatalogMostConsumedPanel } from './ApiIntegrationCatalogMostConsumedPanel';
import { ApiIntegrationCatalogAtRiskPanel } from './ApiIntegrationCatalogAtRiskPanel';
import placeholderStyles from './ApiIntegrationCatalogPlaceholderScreen.module.css';
import styles from './ApiIntegrationCatalogOverviewScreen.module.css';

/**
 * The API & Integration Catalog's landing screen (`sections[0]`, so the app switcher opens here) —
 * a read-only dashboard summarizing the APIs and Integrations sections, each panel linking into the
 * section that owns the full view. Mirrors the Claude Design reference's `ICOverview` (`ic.jsx`) and
 * this codebase's own `../../risk-compliance/sections/RiskComplianceOverviewScreen.tsx` /
 * `../../vendor-management/sections/VendorOverviewScreen.tsx`.
 *
 * The stat tiles and 3 list/queue panels below are standalone, self-fetching components (#3458) —
 * this screen only resolves the top-level "not enabled" gate, the `Title` description's totals, and
 * navigation callbacks; each panel owns its own React Query fetching and loading/error/empty states,
 * following `ApiBlastRadiusPanel.tsx`'s existing shape. Some panels' internal queries overlap with
 * this screen's own (e.g. Data Flow relations, capability config) and with each other's — React
 * Query dedupes identical query keys, so this is an accepted, deliberate tradeoff for panels that
 * are independently composable and reusable outside this screen.
 */
export const ApiIntegrationCatalogOverviewScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const navigate = useNavigate();

  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const apiConfig = resolveApiIntegrationCatalogConfig(configurations.data);

  const apis = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: apiConfig?.apiSchemaId, view: 'full', limit: 500 },
      apiConfig != null
    )
  );
  const allApis = apis.data?.items ?? [];
  const apiIds = useMemo(() => allApis.map(entity => entity._uid), [allApis]);
  const operationsCounts = useApiOperationsCounts(workspaceSlug, apiIds);
  const totalOperations = useMemo(() => {
    let total = 0;
    let known = false;
    for (const count of operationsCounts.byId.values()) {
      if (count == null) continue;
      known = true;
      total += count;
    }
    return known ? total : null;
  }, [operationsCounts.byId]);

  const dataFlowConfig = useDataFlowConfig(workspaceSlug);
  const relations = useRelations(
    workspaceSlug,
    { schemaId: dataFlowConfig.data?.relationSchemaId, limit: 500 },
    { enabled: dataFlowConfig.data != null }
  );
  const allRelations = relations.data;

  const openApi = (publicId: string) =>
    navigate({
      to: `${IC_RAIL_PATHS[IC_APIS_ID]}/$apiId`,
      params: { workspaceSlug, apiId: publicId },
      search: (previous: Record<string, unknown>) => previous
    });
  const goToIntegrations = (search: Record<string, unknown> = {}) =>
    navigate({
      to: IC_RAIL_PATHS[IC_INTEGRATIONS_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...search })
    });
  const goToApis = () =>
    navigate({
      to: IC_RAIL_PATHS[IC_APIS_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => previous
    });

  if (configurations.isLoading) {
    return <div className={placeholderStyles.empty}>Loading API & Integration Catalog…</div>;
  }
  if (!apiConfig) {
    return (
      <div className={placeholderStyles.empty}>
        API & Integration Catalog is not enabled. Configure the API specification capability in
        workspace settings.
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <Title
        title="Overview"
        chips={!apis.isLoading && <span>{allApis.length}</span>}
        description={`${allApis.length} published specification${allApis.length === 1 ? '' : 's'}, ${totalOperations ?? '—'} operations and ${dataFlowConfig.data ? allRelations.length : '—'} integration relations.`}
      />

      <ApiIntegrationCatalogStatTiles workspaceId={workspaceSlug} />

      <div className={styles.two}>
        <ApiIntegrationCatalogNeedsAttentionPanel
          workspaceId={workspaceSlug}
          apiSchemaId={apiConfig.apiSchemaId}
          onOpenApi={openApi}
        />
        <ApiIntegrationCatalogMostConsumedPanel
          workspaceId={workspaceSlug}
          apiSchemaId={apiConfig.apiSchemaId}
          onOpenApi={openApi}
          onViewCatalog={goToApis}
        />
      </div>

      <ApiIntegrationCatalogAtRiskPanel
        workspaceId={workspaceSlug}
        onViewIntegrations={() => goToIntegrations({ boundary: '1' })}
      />
    </div>
  );
};
