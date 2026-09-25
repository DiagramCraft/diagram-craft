import { useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { TbAlertTriangle, TbApi, TbPlugConnected, TbTag, TbUser } from 'react-icons/tb';
import {
  SidebarGroupLabel,
  SidebarTitleHeader
} from '../../../components/sidebar/SidebarPrimitives';
import { TreeRow } from '../../../components/TreeRow';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { entitiesQuery } from '../../../queries/entities';
import { useRelations } from '../../../hooks/useRelations';
import { useRelationSchemas } from '../../../hooks/useRelationSchemas';
import { useSchemas } from '../../../hooks/useSchemas';
import { useLifecycleStates } from '../../../hooks/useWorkspaceConfig';
import { scalarValues } from '../../../lib/scalarFieldValues';
import { resolveApiIntegrationCatalogConfig } from '../apiIntegrationCatalogQueries';
import { useDataFlowConfig } from '../useDataFlowConfig';
import {
  IC_APIS_ID,
  IC_IMPACT_ID,
  IC_INTEGRATIONS_ID,
  IC_RAIL_PATHS,
  IC_SECTIONS,
  IC_SECTION_LABELS,
  type ApiIntegrationCatalogRailItemId
} from '../apiIntegrationCatalogSections';
import { useApiEndpointRelations, groupByApiId } from '../apiEndpointRelations';
import type {
  ApiIntegrationCatalogApisSearchParams,
  ApiIntegrationCatalogImpactSearchParams,
  ApiIntegrationCatalogIntegrationsSearchParams
} from '../../../routes/searchParams';
import styles from '../../../shell/SidePanel.module.css';

/**
 * The Integrations section's own primary-sidebar content: Protocol / Classification facets plus a
 * "crosses a boundary" toggle over the Data Flow register, replacing the plain "Sections" nav list
 * for this section only — mirrors `../../risk-compliance/sections/RiskComplianceSidebar.tsx`'s
 * `RisksSidebarContent`. Facet values come straight off the Data Flow relation schema's own
 * `protocol`/`data_classification` select-field options; the Claude Design reference's `ICSidebar`
 * (`ic.jsx`) also facets by Style, Health, and Adapter, but those have no analog on this schema (no
 * backing data source — see `ApiIntegrationCatalogIntegrationsScreen.tsx`'s doc comment).
 */
const IntegrationsSidebarContent = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as ApiIntegrationCatalogIntegrationsSearchParams;

  const dataFlowConfig = useDataFlowConfig(workspaceSlug);
  const relationSchemas = useRelationSchemas(workspaceSlug, dataFlowConfig.data != null);
  const relationSchema = relationSchemas.data?.find(
    candidate => candidate.id === dataFlowConfig.data?.relationSchemaId
  );
  const relations = useRelations(
    workspaceSlug,
    { schemaId: dataFlowConfig.data?.relationSchemaId, limit: 500 },
    { enabled: dataFlowConfig.data != null }
  );
  const allRelations = relations.data;

  const fieldOptions = (fieldId: string) => {
    const field = relationSchema?.fields.find(candidate => candidate.id === fieldId);
    return field && field.type === 'select' ? (field.options ?? []) : [];
  };

  const countByValue = useMemo(() => {
    const build = (fieldId: string) => {
      const counts = new Map<string, number>();
      for (const relation of allRelations) {
        const value = relation[fieldId];
        if (typeof value === 'string' && value) counts.set(value, (counts.get(value) ?? 0) + 1);
      }
      return counts;
    };
    return { protocol: build('protocol'), classification: build('data_classification') };
  }, [allRelations]);
  const boundaryCount = allRelations.filter(
    relation => relation.cross_boundary === 'cross-boundary'
  ).length;

  const patchSearch = (patch: Partial<ApiIntegrationCatalogIntegrationsSearchParams>) =>
    navigate({
      to: IC_RAIL_PATHS[IC_INTEGRATIONS_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  const hasAnySelection = !!search.protocol || !!search.classification || !!search.boundary;
  const clearAll = () =>
    patchSearch({ protocol: undefined, classification: undefined, boundary: undefined });

  if (!dataFlowConfig.data) {
    return <div className={`${styles.emptyState} dim`}>No Data Flow relation is configured.</div>;
  }

  return (
    <>
      <TreeRow
        icon={<TbPlugConnected size={12} />}
        label="All integrations"
        testId="integration-facet-all"
        active={!hasAnySelection}
        onClick={clearAll}
        trailing={<span className="dim mono">{allRelations.length}</span>}
      />
      <TreeRow
        icon={<TbAlertTriangle size={12} />}
        label="Crosses a boundary"
        testId="integration-facet-boundary"
        active={!!search.boundary}
        onClick={() => patchSearch({ boundary: search.boundary ? undefined : '1' })}
        trailing={<span className="dim mono">{boundaryCount}</span>}
      />
      <SidebarGroupLabel>Protocol</SidebarGroupLabel>
      {fieldOptions('protocol').map(option => (
        <TreeRow
          key={option.value}
          icon={<TbTag size={12} />}
          label={option.label}
          testId={`integration-facet-protocol-${option.value}`}
          active={search.protocol === option.value}
          onClick={() =>
            patchSearch({ protocol: search.protocol === option.value ? undefined : option.value })
          }
          trailing={
            <span className="dim mono">{countByValue.protocol.get(option.value) ?? 0}</span>
          }
        />
      ))}
      <SidebarGroupLabel>Classification</SidebarGroupLabel>
      {fieldOptions('data_classification').map(option => (
        <TreeRow
          key={option.value}
          icon={<TbTag size={12} />}
          label={option.label}
          testId={`integration-facet-classification-${option.value}`}
          active={search.classification === option.value}
          onClick={() =>
            patchSearch({
              classification: search.classification === option.value ? undefined : option.value
            })
          }
          trailing={
            <span className="dim mono">{countByValue.classification.get(option.value) ?? 0}</span>
          }
        />
      ))}
    </>
  );
};

/**
 * The APIs section's own primary-sidebar content: Protocol / Lifecycle / Owning team facets over
 * the workspace's `api` entities — mirrors `IntegrationsSidebarContent` above, fetching its own
 * data independently (the screen's identical `entitiesQuery` call is deduped by react-query's
 * cache, so this isn't a real extra network round trip). `protocols` is a multi-value field (an
 * entity can carry more than one protocol), unlike `IntegrationsSidebarContent`'s single-value
 * `countByValue`, so counting walks `scalarValues(entity.protocols)` per entity instead. Owning
 * team has no schema-backed option list (unlike Protocol) — its facet values are the distinct
 * `_owner`s actually observed on the fetched entities, mirroring how free-text-owner facets are
 * built elsewhere in this app.
 */
const ApisSidebarContent = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as ApiIntegrationCatalogApisSearchParams;

  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const apiConfig = resolveApiIntegrationCatalogConfig(configurations.data);
  const schemas = useSchemas(workspaceSlug);
  const apiSchema = schemas.data?.find(schema => schema.id === apiConfig?.apiSchemaId);
  const { data: lifecycleStates = [] } = useLifecycleStates(workspaceSlug);

  const apis = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: apiConfig?.apiSchemaId, view: 'full', limit: 500 },
      apiConfig != null
    )
  );
  const allItems = apis.data?.items ?? [];

  const protocolField = apiSchema?.fields.find(field => field.id === 'protocols');
  const protocolOptions = protocolField?.type === 'select' ? (protocolField.options ?? []) : [];

  const protocolCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entity of allItems) {
      for (const value of scalarValues(entity.protocols)) {
        if (typeof value === 'string' && value) counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    return counts;
  }, [allItems]);

  const lifecycleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entity of allItems) {
      const id = entity._lifecycle?.id;
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [allItems]);

  const owners = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const entity of allItems) {
      const owner = entity._owner;
      if (!owner) continue;
      const existing = map.get(owner.id);
      if (existing) existing.count += 1;
      else map.set(owner.id, { id: owner.id, name: owner.name, count: 1 });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [allItems]);

  const patchSearch = (patch: Partial<ApiIntegrationCatalogApisSearchParams>) =>
    navigate({
      to: IC_RAIL_PATHS[IC_APIS_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  const hasAnySelection = !!search.protocol || !!search.lifecycle || !!search.owner;
  const clearAll = () =>
    patchSearch({ protocol: undefined, lifecycle: undefined, owner: undefined });

  if (configurations.isLoading || apis.isLoading) return null;

  return (
    <>
      <TreeRow
        icon={<TbApi size={12} />}
        label="All APIs"
        testId="api-facet-all"
        active={!hasAnySelection}
        onClick={clearAll}
        trailing={<span className="dim mono">{allItems.length}</span>}
      />
      <SidebarGroupLabel>Protocol</SidebarGroupLabel>
      {protocolOptions.map(option => (
        <TreeRow
          key={option.value}
          icon={<TbTag size={12} />}
          label={option.label}
          testId={`api-facet-protocol-${option.value}`}
          active={search.protocol === option.value}
          onClick={() =>
            patchSearch({ protocol: search.protocol === option.value ? undefined : option.value })
          }
          trailing={<span className="dim mono">{protocolCounts.get(option.value) ?? 0}</span>}
        />
      ))}
      <SidebarGroupLabel>Lifecycle</SidebarGroupLabel>
      {lifecycleStates.map(state => (
        <TreeRow
          key={state.id}
          icon={<TbTag size={12} />}
          label={state.label}
          testId={`api-facet-lifecycle-${state.id}`}
          active={search.lifecycle === state.id}
          onClick={() =>
            patchSearch({ lifecycle: search.lifecycle === state.id ? undefined : state.id })
          }
          trailing={<span className="dim mono">{lifecycleCounts.get(state.id) ?? 0}</span>}
        />
      ))}
      <SidebarGroupLabel>Owning team</SidebarGroupLabel>
      {owners.map(owner => (
        <TreeRow
          key={owner.id}
          icon={<TbUser size={12} />}
          label={owner.name}
          testId={`api-facet-owner-${owner.id}`}
          active={search.owner === owner.id}
          onClick={() => patchSearch({ owner: search.owner === owner.id ? undefined : owner.id })}
          trailing={<span className="dim mono">{owner.count}</span>}
        />
      ))}
    </>
  );
};

/**
 * The Impact section's own primary-sidebar content (#3320): every API, picked via the `api` search
 * param — mirrors the Claude Design reference's `ICSidebar` "impact" branch ("Pick a specification"),
 * which is this section's only way to choose a subject (the design has no list in its main content,
 * unlike APIs/Integrations). The trailing count is the API's total `Provides API`/`Consumes API`
 * relation count, not the design's fabricated per-spec "registered consumers" count.
 */
const ImpactSidebarContent = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as ApiIntegrationCatalogImpactSearchParams;

  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const apiConfig = resolveApiIntegrationCatalogConfig(configurations.data);
  const schemas = useSchemas(workspaceSlug);
  const apiSchema = schemas.data?.find(schema => schema.id === apiConfig?.apiSchemaId);

  const apis = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: apiConfig?.apiSchemaId, limit: 500 },
      apiConfig != null
    )
  );
  const allItems = apis.data?.items ?? [];
  const sorted = [...allItems].sort((a, b) => a._name.localeCompare(b._name));

  const { providers, consumers } = useApiEndpointRelations(workspaceSlug, apiSchema);
  const providersByApi = useMemo(() => groupByApiId(providers), [providers]);
  const consumersByApi = useMemo(() => groupByApiId(consumers), [consumers]);

  const patchSearch = (patch: Partial<ApiIntegrationCatalogImpactSearchParams>) =>
    navigate({
      to: IC_RAIL_PATHS[IC_IMPACT_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  if (configurations.isLoading || apis.isLoading) return null;

  return (
    <>
      <SidebarGroupLabel>APIs</SidebarGroupLabel>
      {sorted.map(entity => {
        const relationCount =
          (providersByApi.get(entity._uid)?.length ?? 0) +
          (consumersByApi.get(entity._uid)?.length ?? 0);
        return (
          <TreeRow
            key={entity._uid}
            icon={<TbApi size={12} />}
            label={entity._name}
            testId={`impact-facet-api-${entity._uid}`}
            active={search.api === entity._publicId}
            onClick={() => patchSearch({ api: entity._publicId })}
            trailing={<span className="dim mono">{relationCount}</span>}
          />
        );
      })}
    </>
  );
};

/**
 * Section-dependent primary sidebar for the API & Integration Catalog app: navigation between the
 * app's rail sections, gated on the `api-specification` capability configuration — mirrors
 * `../../data-stewardship/sections/DataStewardshipSidebar.tsx`'s `!enabled` empty state and its
 * fallback "Sections" nav list.
 *
 * The Integrations, APIs, and Impact sections replace this nav list with their own facet content
 * (`IntegrationsSidebarContent`, `ApisSidebarContent`, `ImpactSidebarContent`) — mirrors
 * `RiskComplianceSidebar.tsx`'s Risks/Controls facet sections.
 */
export const ApiIntegrationCatalogSidebar = ({
  workspaceSlug,
  activeSection
}: {
  workspaceSlug: string;
  activeSection: ApiIntegrationCatalogRailItemId;
}) => {
  const navigate = useNavigate();
  const { data: configurations } = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const enabled = resolveApiIntegrationCatalogConfig(configurations) !== null;

  return (
    <>
      <SidebarTitleHeader title={IC_SECTION_LABELS[activeSection]} />
      <div className={styles.scroll}>
        {!enabled ? (
          <div className={`${styles.emptyState} dim`}>
            API & Integration Catalog is not enabled.
          </div>
        ) : activeSection === IC_INTEGRATIONS_ID ? (
          <IntegrationsSidebarContent workspaceSlug={workspaceSlug} />
        ) : activeSection === IC_APIS_ID ? (
          <ApisSidebarContent workspaceSlug={workspaceSlug} />
        ) : activeSection === IC_IMPACT_ID ? (
          <ImpactSidebarContent workspaceSlug={workspaceSlug} />
        ) : (
          <>
            <SidebarGroupLabel>Sections</SidebarGroupLabel>
            {IC_SECTIONS.map(section => (
              <TreeRow
                key={section.id}
                label={section.label}
                testId={`api-integration-catalog-nav-${section.id}`}
                active={section.id === activeSection}
                onClick={() =>
                  navigate({
                    to: IC_RAIL_PATHS[section.id],
                    params: { workspaceSlug }
                  })
                }
              />
            ))}
          </>
        )}
      </div>
    </>
  );
};
