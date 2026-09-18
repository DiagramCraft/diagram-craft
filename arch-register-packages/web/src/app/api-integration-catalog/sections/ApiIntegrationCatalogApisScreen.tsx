import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { Title } from '../../../components/Title';
import { SearchInput } from '../../../components/SearchInput';
import { Chip } from '../../../components/Chip';
import { StatusChip } from '../../../components/StatusChip';
import { Table } from '../../../components/table/Table';
import { useTableSort } from '../../../components/table/useTableSort';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { useLifecycleStates } from '../../../hooks/useWorkspaceConfig';
import { useSchemas } from '../../../hooks/useSchemas';
import { scalarValues } from '../../../lib/scalarFieldValues';
import { resolveApiIntegrationCatalogConfig } from '../apiIntegrationCatalogQueries';
import { IC_APIS_ID, IC_RAIL_PATHS } from '../apiIntegrationCatalogSections';
import { apiFieldValue, apiFieldValues } from '../apiFieldDisplay';
import { useApiOperationsCounts } from '../useApiOperationsCounts';
import { useApiOperationsFeed } from '../useApiOperationsFeed';
import { useApiEndpointRelations, groupByApiId } from '../apiEndpointRelations';
import type { ApiIntegrationCatalogApisSearchParams } from '../../../routes/searchParams';
import { ApiSpecDrawer } from './ApiSpecDrawer';
import { ApiOperationsTable } from './ApiOperationsTable';
import filterStyles from '../../../sections/entities/components/EntityBrowser.module.css';
import styles from './ApiIntegrationCatalogPlaceholderScreen.module.css';

type SortKey = 'name' | 'operations' | 'providers' | 'consumers';

/**
 * The APIs register: search + sort (name / operations / providers / consumers count), sidebar
 * facets (Protocol/Lifecycle/Owning team, `ApisSidebarContent` in `ApiIntegrationCatalogSidebar.tsx`),
 * and a Catalog/Operations view toggle (#3345) — opening the shared `ApiSpecDrawer` on row click,
 * deep-linkable at `api-integration-catalog/apis/$apiId`. Mirrors
 * `../../vendor-management/sections/VendorVendorsScreen.tsx`.
 *
 * Fetches APIs with `view: 'full'` — `protocols`/`api_version` (and any other custom fields the
 * list or drawer reads) are only populated on the full view.
 *
 * Facets narrow "which APIs are in scope" and apply across both sub-views — switching between
 * Catalog/Operations is a different lens on the same scope, not a different filter.
 *
 * A cross-API "Deprecated operations" view (also #3345) was pulled from this iteration: fanning
 * the projection query out across every API in scope triggered a 409 from the artifacts revisions
 * endpoint that needs a server-side fix first — see the tracking follow-up issue.
 */
export const ApiIntegrationCatalogApisScreen = () => {
  const { workspaceSlug, apiId } = useParams({ strict: false }) as {
    workspaceSlug: string;
    apiId?: string;
  };
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as ApiIntegrationCatalogApisSearchParams;
  const q = search.q ?? '';
  const view = search.view ?? 'catalog';
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

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allItems.filter(entity => {
      if (search.protocol && !scalarValues(entity.protocols).includes(search.protocol)) {
        return false;
      }
      if (search.lifecycle && entity._lifecycle?.id !== search.lifecycle) return false;
      if (search.owner && entity._owner?.id !== search.owner) return false;
      if (needle && !`${entity._name} ${entity._publicId}`.toLowerCase().includes(needle)) {
        return false;
      }
      return true;
    });
  }, [allItems, q, search.protocol, search.lifecycle, search.owner]);

  const apiIds = useMemo(() => filtered.map(entity => entity._uid), [filtered]);
  const apiRefs = useMemo(
    () => filtered.map(entity => ({ id: entity._uid, publicId: entity._publicId, name: entity._name })),
    [filtered]
  );
  const operationsCounts = useApiOperationsCounts(workspaceSlug, apiIds);

  const { providers, consumers } = useApiEndpointRelations(workspaceSlug, apiSchema);
  const providersByApi = useMemo(() => groupByApiId(providers), [providers]);
  const consumersByApi = useMemo(() => groupByApiId(consumers), [consumers]);

  const operationsFeed = useApiOperationsFeed(workspaceSlug, apiRefs, {}, view === 'operations');

  const comparators: Record<SortKey, (a: EntityRecord, b: EntityRecord) => number> = {
    name: (a, b) => a._name.localeCompare(b._name),
    operations: (a, b) =>
      (operationsCounts.byId.get(b._uid) ?? -1) - (operationsCounts.byId.get(a._uid) ?? -1),
    providers: (a, b) =>
      (providersByApi.get(b._uid)?.length ?? 0) - (providersByApi.get(a._uid)?.length ?? 0),
    consumers: (a, b) =>
      (consumersByApi.get(b._uid)?.length ?? 0) - (consumersByApi.get(a._uid)?.length ?? 0)
  };
  const { sorted, sort, toggleSort } = useTableSort<EntityRecord, SortKey>(filtered, comparators, {
    key: 'name',
    dir: 'asc'
  });

  const openApi = (id: string) =>
    navigate({
      to: `${IC_RAIL_PATHS[IC_APIS_ID]}/$apiId`,
      params: { workspaceSlug, apiId: id },
      search: (previous: Record<string, unknown>) => previous
    });
  const closeApi = () =>
    navigate({
      to: IC_RAIL_PATHS[IC_APIS_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => previous
    });
  const patchSearch = (patch: Partial<ApiIntegrationCatalogApisSearchParams>) =>
    navigate({
      to: IC_RAIL_PATHS[IC_APIS_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

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
      <Title title="APIs" chips={!apis.isLoading && <span>{filtered.length}</span>} />

      <Tabs.Root
        value={view}
        onValueChange={value => patchSearch({ view: value === 'catalog' ? undefined : 'operations' })}
      >
        <Tabs.List aria-label="APIs view">
          <Tabs.Trigger value="catalog">Catalog</Tabs.Trigger>
          <Tabs.Trigger value="operations">Operations</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>

      <div className={filterStyles.toolbar}>
        <SearchInput
          size="sm"
          className={filterStyles.searchInline}
          value={q}
          placeholder="Search APIs by name…"
          aria-label="Search APIs"
          onChange={value => patchSearch({ q: value || undefined })}
          onClear={() => patchSearch({ q: undefined })}
        />
      </div>

      {view === 'operations' ? (
        <ApiOperationsTable
          rows={operationsFeed.rows}
          isLoading={operationsFeed.isLoading}
          q={q}
          emptyLabel="No operations match these filters."
          onOpenApi={openApi}
        />
      ) : (
        <Table.Root scroll stickyHeader>
          <Table.Head>
            <Table.Row>
              <Table.SortableHeaderCell sortKey="name" sort={sort} onSort={toggleSort}>
                Name
              </Table.SortableHeaderCell>
              <Table.HeaderCell>Protocol</Table.HeaderCell>
              <Table.HeaderCell>Version</Table.HeaderCell>
              <Table.HeaderCell>Lifecycle</Table.HeaderCell>
              <Table.HeaderCell>Owner</Table.HeaderCell>
              <Table.SortableHeaderCell sortKey="providers" sort={sort} onSort={toggleSort} numeric>
                Providers
              </Table.SortableHeaderCell>
              <Table.SortableHeaderCell sortKey="consumers" sort={sort} onSort={toggleSort} numeric>
                Consumers
              </Table.SortableHeaderCell>
              <Table.SortableHeaderCell sortKey="operations" sort={sort} onSort={toggleSort} numeric>
                Operations
              </Table.SortableHeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {sorted.length === 0 ? (
              <Table.EmptyRow colSpan={8}>
                {apis.isLoading ? 'Loading APIs…' : 'No APIs match these filters.'}
              </Table.EmptyRow>
            ) : (
              sorted.map(entity => {
                const count = operationsCounts.byId.get(entity._uid);
                const entityProviders = providersByApi.get(entity._uid) ?? [];
                const entityConsumers = consumersByApi.get(entity._uid) ?? [];
                return (
                  <Table.Row key={entity._uid} onClick={() => openApi(entity._publicId)}>
                    <Table.NameCell title={entity._name} subtitle={entity._publicId} />
                    <Table.Cell>
                      {apiFieldValues(apiSchema, entity, 'protocols').map(value => (
                        <Chip key={value} tone="ghost">
                          {value}
                        </Chip>
                      ))}
                    </Table.Cell>
                    <Table.Cell>{apiFieldValue(apiSchema, entity, 'api_version')}</Table.Cell>
                    <Table.Cell>
                      {entity._lifecycle ? (
                        <StatusChip value={entity._lifecycle.id} lifecycleStates={lifecycleStates} />
                      ) : (
                        <span className="dim">—</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>{entity._owner?.name ?? <span className="dim">—</span>}</Table.Cell>
                    <Table.Cell className="dim">
                      {entityProviders.length === 0
                        ? '—'
                        : entityProviders.map(relation => relation._in.name).join(', ')}
                    </Table.Cell>
                    <Table.Cell className="dim">
                      {entityConsumers.length === 0
                        ? '—'
                        : entityConsumers.map(relation => relation._in.name).join(', ')}
                    </Table.Cell>
                    <Table.Cell numeric>
                      {operationsCounts.isLoading && count == null ? (
                        <span className="dim">…</span>
                      ) : (
                        (count ?? <span className="dim">—</span>)
                      )}
                    </Table.Cell>
                  </Table.Row>
                );
              })
            )}
          </Table.Body>
        </Table.Root>
      )}

      {apiId && (
        <ApiSpecDrawer
          workspaceSlug={workspaceSlug}
          apiId={apiId}
          apiSchemaId={apiConfig.apiSchemaId}
          onClose={closeApi}
        />
      )}
    </div>
  );
};
