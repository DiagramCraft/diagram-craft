import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { Title } from '../../../components/Title';
import { SearchInput } from '../../../components/SearchInput';
import { FilterDropdown } from '../../../components/FilterDropdown';
import { Chip } from '../../../components/Chip';
import { Table } from '../../../components/table/Table';
import { useTableSort } from '../../../components/table/useTableSort';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { useSchemas } from '../../../hooks/useSchemas';
import { formatCurrencyValue } from '../../../utils/currencyFormat';
import { resolveVendorManagementConfig } from '../vendorManagementQueries';
import { VENDOR_RAIL_PATHS, VENDOR_VENDORS_ID } from '../vendorManagementSections';
import { useVendorSpendRollups } from '../useVendorSpendRollups';
import { useVendorNextRenewals } from '../useVendorNextRenewals';
import { vendorRiskBandFor, VENDOR_RISK_BAND_COLOR } from '../vendorRisk';
import { vendorFieldValue } from '../vendorFieldDisplay';
import type { VendorsSearchParams } from '../../../routes/searchParams';
import { useEntityDrawer } from '../../../sections/entities/entityDrawer/useEntityDrawer';
import filterStyles from '../../../sections/entities/components/EntityBrowser.module.css';
import styles from './VendorManagementPlaceholderScreen.module.css';

type SortKey = 'name' | 'spend' | 'risk' | 'renewal';

const compareNullable = (a: number | string | null, b: number | string | null): number => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
};

/**
 * The Vendors register: search, sort (spend / name / risk / next renewal), and facets (tier,
 * category, owner) delivered by `VendorManagementSidebar`'s `VendorsSidebarContent`, opening the
 * shared entity drawer on row click via `useEntityDrawer`, deep-linkable through its `drawer`
 * search param.
 *
 * Fetches vendors with `view: 'full'` — `view: 'summary'` never carries an entity's custom field
 * data (only `_owner`/`_lifecycle`/etc.), so `tier`, `category`, `relationship_owner`, and the risk
 * dimensions this screen sorts and facets by would otherwise always be empty.
 */
export const VendorVendorsScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const navigate = useNavigate();
  const { openEntityDrawer } = useEntityDrawer();
  const search = useSearch({ strict: false }) as VendorsSearchParams;
  const q = search.q ?? '';
  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const vendorConfig = resolveVendorManagementConfig(configurations.data);
  const schemas = useSchemas(workspaceSlug);
  const vendorSchema = schemas.data?.find(schema => schema.id === vendorConfig?.vendorSchemaId);

  const vendors = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: vendorConfig?.vendorSchemaId, view: 'full', limit: 500 },
      vendorConfig != null
    )
  );
  const allItems = vendors.data?.items ?? [];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allItems.filter(entity => {
      if (needle && !`${entity._name} ${entity._publicId}`.toLowerCase().includes(needle)) {
        return false;
      }
      if (search.tier && entity.tier !== search.tier) return false;
      if (search.category && entity.category !== search.category) return false;
      if (search.owner && entity.relationship_owner !== search.owner) return false;
      return true;
    });
  }, [allItems, q, search.tier, search.category, search.owner]);

  const vendorIds = useMemo(() => filtered.map(entity => entity._uid), [filtered]);
  const spend = useVendorSpendRollups(
    workspaceSlug,
    vendorConfig?.contractSchemaId ?? null,
    vendorIds
  );
  const renewals = useVendorNextRenewals(
    workspaceSlug,
    vendorConfig?.contractSchemaId ?? null,
    vendorIds
  );

  const riskByUid = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const entity of filtered) {
      map.set(entity._uid, typeof entity.risk === 'number' ? entity.risk : null);
    }
    return map;
  }, [filtered]);

  const comparators: Record<SortKey, (a: EntityRecord, b: EntityRecord) => number> = {
    name: (a, b) => a._name.localeCompare(b._name),
    spend: (a, b) =>
      -compareNullable(
        spend.byId.get(a._uid)?.vmSpend ?? null,
        spend.byId.get(b._uid)?.vmSpend ?? null
      ),
    risk: (a, b) =>
      -compareNullable(
        riskByUid.get(a._uid) ?? null,
        riskByUid.get(b._uid) ?? null
      ),
    renewal: (a, b) =>
      compareNullable(renewals.byId.get(a._uid) ?? null, renewals.byId.get(b._uid) ?? null)
  };
  const { sorted, sort, toggleSort } = useTableSort<EntityRecord, SortKey>(filtered, comparators, {
    key: 'name',
    dir: 'asc'
  });

  const patchSearch = (patch: Partial<VendorsSearchParams>) =>
    navigate({
      to: VENDOR_RAIL_PATHS[VENDOR_VENDORS_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  if (configurations.isLoading) {
    return <div className={styles.empty}>Loading vendor management…</div>;
  }
  if (!vendorConfig) {
    return (
      <div className={styles.empty}>
        Vendor management is not enabled. Configure the vendor management capability in workspace
        settings.
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <Title title="Vendors" chips={!vendors.isLoading && <span>{filtered.length}</span>} />

      <div className={filterStyles.toolbar}>
        <SearchInput
          size="sm"
          className={filterStyles.searchInline}
          value={q}
          placeholder="Search vendors by name…"
          aria-label="Search vendors"
          onChange={value => patchSearch({ q: value || undefined })}
          onClear={() => patchSearch({ q: undefined })}
        />
        <div style={{ marginLeft: 'auto' }}>
          <FilterDropdown
            label="Sort"
            value={sort?.key ?? 'name'}
            onChange={value => value !== sort?.key && toggleSort(value as SortKey)}
            options={[
              { value: 'name', label: 'Name' },
              { value: 'spend', label: 'Spend' },
              { value: 'risk', label: 'Risk' },
              { value: 'renewal', label: 'Next renewal' }
            ]}
          />
        </div>
      </div>

      <Table.Root scroll stickyHeader>
        <Table.Head>
          <Table.Row>
            <Table.SortableHeaderCell sortKey="name" sort={sort} onSort={toggleSort}>
              Name
            </Table.SortableHeaderCell>
            <Table.HeaderCell>Tier</Table.HeaderCell>
            <Table.HeaderCell>Category</Table.HeaderCell>
            <Table.HeaderCell>Owner</Table.HeaderCell>
            <Table.SortableHeaderCell sortKey="spend" sort={sort} onSort={toggleSort} numeric>
              Spend
            </Table.SortableHeaderCell>
            <Table.SortableHeaderCell sortKey="risk" sort={sort} onSort={toggleSort}>
              Risk
            </Table.SortableHeaderCell>
            <Table.SortableHeaderCell sortKey="renewal" sort={sort} onSort={toggleSort}>
              Next renewal
            </Table.SortableHeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {sorted.length === 0 ? (
            <Table.EmptyRow colSpan={7}>
              {vendors.isLoading ? 'Loading vendors…' : 'No vendors match these filters.'}
            </Table.EmptyRow>
          ) : (
            sorted.map(entity => {
              const entitySpend = spend.byId.get(entity._uid);
              const risk = riskByUid.get(entity._uid);
              const riskBand = vendorRiskBandFor(risk);
              const renewal = renewals.byId.get(entity._uid);
              return (
                <Table.Row key={entity._uid} onClick={() => openEntityDrawer(entity._publicId)}>
                  <Table.NameCell title={entity._name} subtitle={entity._publicId} />
                  <Table.Cell>{vendorFieldValue(vendorSchema, entity, 'tier')}</Table.Cell>
                  <Table.Cell>{vendorFieldValue(vendorSchema, entity, 'category')}</Table.Cell>
                  <Table.Cell>
                    {vendorFieldValue(vendorSchema, entity, 'relationship_owner')}
                  </Table.Cell>
                  <Table.Cell numeric>
                    {entitySpend?.vmSpend != null
                      ? formatCurrencyValue({
                          amount: entitySpend.vmSpend,
                          currency: entitySpend.currency
                        })
                      : '—'}
                  </Table.Cell>
                  <Table.Cell>
                    {risk != null && riskBand != null ? (
                      <Chip dot={VENDOR_RISK_BAND_COLOR[riskBand]} tone="ghost">
                        {riskBand} · {risk.toFixed(1)}
                      </Chip>
                    ) : (
                      <span className="dim">—</span>
                    )}
                  </Table.Cell>
                  <Table.Cell>{renewal ?? <span className="dim">—</span>}</Table.Cell>
                </Table.Row>
              );
            })
          )}
        </Table.Body>
      </Table.Root>
    </div>
  );
};
