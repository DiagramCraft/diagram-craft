import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { Title } from '../../../components/Title';
import { SearchInput } from '../../../components/SearchInput';
import { FilterDropdown } from '../../../components/FilterDropdown';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';
import { Chip } from '../../../components/Chip';
import { Table } from '../../../components/table/Table';
import { useTableSort } from '../../../components/table/useTableSort';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { useSchemas } from '../../../hooks/useSchemas';
import { formatDate } from '../../../utils/dateFormat';
import { resolveVendorManagementConfig } from '../vendorManagementQueries';
import { VENDOR_RAIL_PATHS, VENDOR_CONTRACTS_ID } from '../vendorManagementSections';
import { useVendorContracts, type VendorContractRow } from '../useVendorContracts';
import { vendorFieldValue } from '../vendorFieldDisplay';
import { renewalWindow, RENEWAL_WINDOW_COLOR } from '../contractRenewalWindow';
import type { ContractsSearchParams } from '../../../routes/searchParams';
import { useEntityDrawer } from '../../../sections/entities/entityDrawer/useEntityDrawer';
import { VendorContractsCalendar } from './VendorContractsCalendar';
import { VendorContractsTimeline } from './VendorContractsTimeline';
import filterStyles from '../../../sections/entities/components/EntityBrowser.module.css';
import styles from './VendorManagementPlaceholderScreen.module.css';

type SortKey = 'name' | 'vendor' | 'cost' | 'renewal';

const compareNullable = (a: number | string | null, b: number | string | null): number => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
};

/**
 * The Contracts section: search, sort, and facets (renewal window, type, vendor) delivered by
 * `VendorManagementSidebar`'s `ContractsSidebarContent`, toggling between a list view, a
 * 12-month renewal calendar (`VendorContractsCalendar`), and a Gantt-style contract timeline
 * (`VendorContractsTimeline`). Row/entry/bar click opens the workspace-wide entity drawer via the
 * shared `drawer` search param.
 *
 * Fetches Contracts via `useVendorContracts` (a Contract tree join, resolving each Contract's
 * containing Vendor name — a flat entity fetch can't give that, see that hook's own comment).
 */
export const VendorContractsScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as {
    workspaceSlug: string;
  };
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as ContractsSearchParams;
  const { openEntityDrawer } = useEntityDrawer();
  const q = search.q ?? '';
  const view = search.view ?? 'list';

  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const vendorConfig = resolveVendorManagementConfig(configurations.data);
  const schemas = useSchemas(workspaceSlug);
  const contractSchema = schemas.data?.find(schema => schema.id === vendorConfig?.contractSchemaId);

  const contracts = useVendorContracts(workspaceSlug, vendorConfig?.contractSchemaId ?? null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return contracts.items.filter(row => {
      const { contract, vendorId, vendorName } = row;
      if (
        needle &&
        !`${contract._name} ${contract._publicId} ${vendorName ?? ''}`
          .toLowerCase()
          .includes(needle)
      ) {
        return false;
      }
      if (search.type && contract.contract_type !== search.type) return false;
      if (search.vendor && vendorId !== search.vendor) return false;
      if (
        search.renewalWindow &&
        renewalWindow(typeof contract.contract_end === 'string' ? contract.contract_end : null) !==
          search.renewalWindow
      ) {
        return false;
      }
      return true;
    });
  }, [contracts.items, q, search.type, search.vendor, search.renewalWindow]);

  const comparators: Record<SortKey, (a: VendorContractRow, b: VendorContractRow) => number> = {
    name: (a, b) => a.contract._name.localeCompare(b.contract._name),
    vendor: (a, b) => compareNullable(a.vendorName, b.vendorName),
    cost: (a, b) =>
      -compareNullable(
        currencyAmount(a.contract.annual_cost),
        currencyAmount(b.contract.annual_cost)
      ),
    renewal: (a, b) =>
      compareNullable(
        typeof a.contract.contract_end === 'string' ? a.contract.contract_end : null,
        typeof b.contract.contract_end === 'string' ? b.contract.contract_end : null
      )
  };
  const { sorted, sort, toggleSort } = useTableSort<VendorContractRow, SortKey>(
    filtered,
    comparators,
    { key: 'renewal', dir: 'asc' }
  );

  const patchSearch = (patch: Partial<ContractsSearchParams>) =>
    navigate({
      to: VENDOR_RAIL_PATHS[VENDOR_CONTRACTS_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  const openContract = (contract: EntityRecord) => openEntityDrawer(contract._publicId);

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
  if (!vendorConfig.contractSchemaId) {
    return (
      <div className={styles.empty}>
        No Contract entity schema is bound. Configure the vendor management capability's Contract
        binding in workspace settings.
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <Title title="Contracts" chips={!contracts.isLoading && <span>{filtered.length}</span>} />

      <div className={filterStyles.toolbar}>
        <ToggleButtonGroup.Root
          type="single"
          aria-label="Contracts view"
          value={view}
          onChange={value => {
            // BaseUI's single-select toggle group allows deselecting the active item (giving
            // `undefined`); a view switch shouldn't be able to leave no view selected, so a
            // deselect is ignored rather than clearing `view` back to 'list'.
            if (value)
              patchSearch({
                view: value === 'list' ? undefined : (value as 'calendar' | 'timeline')
              });
          }}
        >
          <ToggleButtonGroup.Item value="list">List</ToggleButtonGroup.Item>
          <ToggleButtonGroup.Item value="calendar">Renewal calendar</ToggleButtonGroup.Item>
          <ToggleButtonGroup.Item value="timeline">Timelines</ToggleButtonGroup.Item>
        </ToggleButtonGroup.Root>
        <SearchInput
          size="sm"
          className={filterStyles.searchInline}
          value={q}
          placeholder="Search contracts by name or vendor…"
          aria-label="Search contracts"
          onChange={value => patchSearch({ q: value || undefined })}
          onClear={() => patchSearch({ q: undefined })}
        />
        {view === 'list' && (
          <div style={{ marginLeft: 'auto' }}>
            <FilterDropdown
              label="Sort"
              value={sort?.key ?? 'renewal'}
              onChange={value => value !== sort?.key && toggleSort(value as SortKey)}
              options={[
                { value: 'name', label: 'Name' },
                { value: 'vendor', label: 'Vendor' },
                { value: 'cost', label: 'Annual cost' },
                { value: 'renewal', label: 'Renewal date' }
              ]}
            />
          </div>
        )}
      </div>

      {view === 'calendar' ? (
        <VendorContractsCalendar contracts={sorted} onOpenContract={openContract} />
      ) : view === 'timeline' ? (
        <VendorContractsTimeline contracts={sorted} onOpenContract={openContract} />
      ) : (
        <Table.Root scroll stickyHeader>
          <Table.Head>
            <Table.Row>
              <Table.SortableHeaderCell sortKey="name" sort={sort} onSort={toggleSort}>
                Name
              </Table.SortableHeaderCell>
              <Table.SortableHeaderCell sortKey="vendor" sort={sort} onSort={toggleSort}>
                Vendor
              </Table.SortableHeaderCell>
              <Table.HeaderCell>Type</Table.HeaderCell>
              <Table.SortableHeaderCell sortKey="cost" sort={sort} onSort={toggleSort} numeric>
                Annual cost
              </Table.SortableHeaderCell>
              <Table.HeaderCell>Auto-renew</Table.HeaderCell>
              <Table.SortableHeaderCell sortKey="renewal" sort={sort} onSort={toggleSort}>
                Renewal date
              </Table.SortableHeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {sorted.length === 0 ? (
              <Table.EmptyRow colSpan={6}>
                {contracts.isLoading ? 'Loading contracts…' : 'No contracts match these filters.'}
              </Table.EmptyRow>
            ) : (
              sorted.map(({ contract, vendorName }) => {
                const contractWindow = renewalWindow(
                  typeof contract.contract_end === 'string' ? contract.contract_end : null
                );
                return (
                  <Table.Row key={contract._uid} onClick={() => openContract(contract)}>
                    <Table.NameCell title={contract._name} subtitle={contract._publicId} />
                    <Table.Cell>{vendorName ?? <span className="dim">—</span>}</Table.Cell>
                    <Table.Cell>
                      {vendorFieldValue(contractSchema, contract, 'contract_type')}
                    </Table.Cell>
                    <Table.Cell numeric>
                      {vendorFieldValue(contractSchema, contract, 'annual_cost')}
                    </Table.Cell>
                    <Table.Cell>
                      {vendorFieldValue(contractSchema, contract, 'auto_renew')}
                    </Table.Cell>
                    <Table.Cell>
                      <Chip dot={RENEWAL_WINDOW_COLOR[contractWindow]} tone="ghost">
                        {formatDate(contract.contract_end)}
                      </Chip>
                    </Table.Cell>
                  </Table.Row>
                );
              })
            )}
          </Table.Body>
        </Table.Root>
      )}
    </div>
  );
};

const currencyAmount = (value: unknown): number | null =>
  value != null && typeof value === 'object' && 'amount' in value
    ? ((value as { amount: unknown }).amount as number)
    : null;
