import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
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
import { resolveApiIntegrationCatalogConfig } from '../apiIntegrationCatalogQueries';
import { IC_APIS_ID, IC_RAIL_PATHS } from '../apiIntegrationCatalogSections';
import { apiFieldValue, apiFieldValues } from '../apiFieldDisplay';
import { useApiOperationsCounts } from '../useApiOperationsCounts';
import { ApiSpecDrawer } from './ApiSpecDrawer';
import filterStyles from '../../../sections/entities/components/EntityBrowser.module.css';
import styles from './ApiIntegrationCatalogPlaceholderScreen.module.css';

type SortKey = 'name' | 'operations';

/**
 * The APIs register: search + sort (name / operations count), opening the shared `ApiSpecDrawer`
 * on row click, deep-linkable at `api-integration-catalog/apis/$apiId`. Mirrors
 * `../../vendor-management/sections/VendorVendorsScreen.tsx`.
 *
 * Fetches APIs with `view: 'full'` — `protocols`/`api_version` (and any other custom fields the
 * list or drawer reads) are only populated on the full view.
 */
export const ApiIntegrationCatalogApisScreen = () => {
  const { workspaceSlug, apiId } = useParams({ strict: false }) as {
    workspaceSlug: string;
    apiId?: string;
  };
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { q?: string };
  const q = search.q ?? '';
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
    if (!needle) return allItems;
    return allItems.filter(entity =>
      `${entity._name} ${entity._publicId}`.toLowerCase().includes(needle)
    );
  }, [allItems, q]);

  const apiIds = useMemo(() => filtered.map(entity => entity._uid), [filtered]);
  const operationsCounts = useApiOperationsCounts(workspaceSlug, apiIds);

  const comparators: Record<SortKey, (a: EntityRecord, b: EntityRecord) => number> = {
    name: (a, b) => a._name.localeCompare(b._name),
    operations: (a, b) =>
      (operationsCounts.byId.get(b._uid) ?? -1) - (operationsCounts.byId.get(a._uid) ?? -1)
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
  const patchSearch = (patch: { q?: string }) =>
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
            <Table.SortableHeaderCell sortKey="operations" sort={sort} onSort={toggleSort} numeric>
              Operations
            </Table.SortableHeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {sorted.length === 0 ? (
            <Table.EmptyRow colSpan={6}>
              {apis.isLoading ? 'Loading APIs…' : 'No APIs match these filters.'}
            </Table.EmptyRow>
          ) : (
            sorted.map(entity => {
              const count = operationsCounts.byId.get(entity._uid);
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
