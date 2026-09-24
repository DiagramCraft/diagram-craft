import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { Title } from '../../../components/Title';
import { FilterDropdown } from '../../../components/FilterDropdown';
import { Table } from '../../../components/table/Table';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { useSchemas } from '../../../hooks/useSchemas';
import { formatCurrencyValue } from '../../../utils/currencyFormat';
import { resolveVendorManagementConfig } from '../vendorManagementQueries';
import { VENDOR_RAIL_PATHS, VENDOR_SPEND_ID } from '../vendorManagementSections';
import { useVendorSpendRollups, type VendorSpendRollupValue } from '../useVendorSpendRollups';
import { useVendorContracts, type VendorContractRow } from '../useVendorContracts';
import { computeVmTotalSpend, computeVmGroupSpend } from '../vendorSpendAggregates';
import type { SpendSearchParams } from '../../../routes/searchParams';
import { SpendShareBar, SpendShareStrip } from './SpendShareBar';
import { useEntityDrawer } from '../../../sections/entities/entityDrawer/useEntityDrawer';
import filterStyles from '../../../sections/entities/components/EntityBrowser.module.css';
import styles from './VendorSpendScreen.module.css';

// Vendor's `tier` select field value for the "Strategic tier" stat — `schemaTemplates.ts`'s
// `vendor-tier` enum (`strategic` / `tactical` / `commodity`).
const STRATEGIC_TIER = 'strategic';

type SpendRow = {
  key: string;
  label: string;
  subtitle?: string;
  amount: number;
  vendorId?: string;
  contractCount: number;
  largestContractName: string | null;
};

const currencyAmount = (value: unknown): number | null =>
  value != null && typeof value === 'object' && 'amount' in value
    ? ((value as { amount: unknown }).amount as number)
    : null;

// `formatCurrencyValue` falls back to `String(value)` (rendering `[object Object]`) when it isn't
// given a real currency code — which happens here whenever there's no spend data yet to read a
// currency off of. Guarding on a known currency and showing a dash otherwise mirrors
// `VendorVendorsScreen.tsx`'s `entitySpend?.vmSpend != null ? formatCurrencyValue(...) : '—'`.
const fmtMoney = (amount: number, currency: string | null): string =>
  currency != null ? formatCurrencyValue({ amount, currency }) : '—';

const costCentreLabel = (vendorSchema: EntitySchema | undefined, value: string): string => {
  if (value === '—') return value;
  const field = vendorSchema?.fields.find(candidate => candidate.id === 'cost_centre');
  if (field && (field.type === 'select' || field.type === 'derived') && 'options' in field) {
    return field.options?.find(option => option.value === value)?.label ?? value;
  }
  return value;
};

const largestContract = (rows: readonly VendorContractRow[]): string | null => {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort(
    (a, b) =>
      (currencyAmount(b.contract.annual_cost) ?? 0) - (currencyAmount(a.contract.annual_cost) ?? 0)
  );
  return sorted[0]!.contract._name;
};

/**
 * Spend rows for the table: grouped by vendor, or by Vendor's `cost_centre` field, each carrying
 * its own contract count and largest contract, sorted by spend descending.
 */
export const buildSpendRows = ({
  group,
  scopedVendors,
  spendById,
  contractItems,
  contractsByVendorUid,
  costCentreByVendorUid,
  vendorSchema
}: {
  group: 'vendor' | 'costCentre' | 'capability';
  scopedVendors: readonly EntityRecord[];
  spendById: ReadonlyMap<string, VendorSpendRollupValue>;
  contractItems: readonly VendorContractRow[];
  contractsByVendorUid: Map<string, VendorContractRow[]>;
  costCentreByVendorUid: Map<string, string>;
  vendorSchema: EntitySchema | undefined;
}): SpendRow[] => {
  if (group === 'capability') return [];
  if (group === 'costCentre') {
    const grouped = computeVmGroupSpend(scopedVendors, spendById, 'cost_centre');
    return [...grouped.entries()]
      .map(([value, amount]) => {
        const groupContracts = contractItems.filter(
          row => row.vendorId && costCentreByVendorUid.get(row.vendorId) === value
        );
        return {
          key: value,
          label: costCentreLabel(vendorSchema, value),
          amount,
          contractCount: groupContracts.length,
          largestContractName: largestContract(groupContracts)
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }
  return scopedVendors
    .map(entity => {
      const vendorContracts = contractsByVendorUid.get(entity._uid) ?? [];
      return {
        key: entity._uid,
        label: entity._name,
        subtitle: entity._publicId,
        amount: spendById.get(entity._uid)?.vmSpend ?? 0,
        vendorId: entity._publicId,
        contractCount: vendorContracts.length,
        largestContractName: largestContract(vendorContracts)
      };
    })
    .sort((a, b) => b.amount - a.amount);
};

/**
 * The Spend section: portfolio-wide spend roll-ups grouped by vendor or by Vendor's `cost_centre`
 * field (a toolbar toggle), each shown as a table with a per-row magnitude bar, share of the
 * portfolio total, contract count, and largest contract — plus a portfolio-wide share strip above
 * the table. Four header stats (total, fixed-term commitment, strategic-tier share, cost centres
 * charged) mirror the design reference's `VMStat` row.
 *
 * A third "By capability" grouping is selectable (matching the design reference's three-way
 * toggle) but shows an explanatory empty state instead of data: no Contract→capability schema link
 * exists yet, and `VendorManagementConfig` has no `capabilitySchemaId` to resolve one.
 *
 * Spend figures reuse the shared roll-up model from `useVendorSpendRollups`/`vendorSpendAggregates`
 * (`vmSpend`/`vmTotalSpend`/`vmGroupSpend`, also used by the vendor drawer); contract count and
 * largest-contract are read from the raw Contract records via `useVendorContracts` (the shared
 * model's batched `metrics.rollup` doesn't expose per-contract detail).
 *
 * Selecting a vendor (a row, or a share-strip segment) opens the shared vendor drawer in place via
 * the workspace-wide `drawer` search param, rather than navigating to the Vendors section, so
 * grouping/filter state on this screen survives.
 */
export const VendorSpendScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const navigate = useNavigate();
  const { openEntityDrawer } = useEntityDrawer();
  const search = useSearch({ strict: false }) as SpendSearchParams;
  const group = search.group ?? 'vendor';

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
  const allVendors = vendors.data?.items ?? [];

  const vendorIds = useMemo(() => allVendors.map(entity => entity._uid), [allVendors]);
  const spend = useVendorSpendRollups(
    workspaceSlug,
    vendorConfig?.contractSchemaId ?? null,
    vendorIds
  );
  const contracts = useVendorContracts(workspaceSlug, vendorConfig?.contractSchemaId ?? null);

  const totalSpend = useMemo(() => computeVmTotalSpend(spend.byId), [spend.byId]);
  const totalCurrency = useMemo(
    () => [...spend.byId.values()].find(value => value.currency != null)?.currency ?? null,
    [spend.byId]
  );

  const contractsByVendorUid = useMemo(() => {
    const map = new Map<string, VendorContractRow[]>();
    for (const row of contracts.items) {
      if (!row.vendorId) continue;
      const list = map.get(row.vendorId) ?? [];
      list.push(row);
      map.set(row.vendorId, list);
    }
    return map;
  }, [contracts.items]);

  const costCentreByVendorUid = useMemo(
    () =>
      new Map(
        allVendors.map(entity => [
          entity._uid,
          typeof entity.cost_centre === 'string' && entity.cost_centre.length > 0
            ? entity.cost_centre
            : '—'
        ])
      ),
    [allVendors]
  );

  // The sidebar's Cost Centre and Owner facets narrow the roll-up rows (not the header stats,
  // which stay portfolio-wide — matching the design reference). A cost-centre filter is ignored
  // once already grouped by cost centre, since it would just collapse the table to one row.
  const ccFilter = group !== 'costCentre' ? (search.cc ?? null) : null;
  const ownerFilter = search.owner ?? null;
  const scopedVendors = useMemo(
    () =>
      allVendors.filter(entity => {
        if (ccFilter && costCentreByVendorUid.get(entity._uid) !== ccFilter) return false;
        if (ownerFilter && entity.relationship_owner !== ownerFilter) return false;
        return true;
      }),
    [allVendors, ccFilter, ownerFilter, costCentreByVendorUid]
  );

  const rows: SpendRow[] = useMemo(
    () =>
      buildSpendRows({
        group,
        scopedVendors,
        spendById: spend.byId,
        contractItems: contracts.items,
        contractsByVendorUid,
        costCentreByVendorUid,
        vendorSchema
      }),
    [
      group,
      scopedVendors,
      spend.byId,
      contracts.items,
      contractsByVendorUid,
      costCentreByVendorUid,
      vendorSchema
    ]
  );

  const rowsTotal = useMemo(() => rows.reduce((sum, row) => sum + row.amount, 0), [rows]);
  const maxRowAmount = useMemo(() => Math.max(...rows.map(row => row.amount), 1), [rows]);

  const fixedTermCommitment = useMemo(
    () =>
      contracts.items.reduce(
        (sum, row) =>
          row.contract.auto_renew === true
            ? sum
            : sum + (currencyAmount(row.contract.annual_cost) ?? 0),
        0
      ),
    [contracts.items]
  );
  const strategicSpend = useMemo(
    () =>
      allVendors
        .filter(entity => entity.tier === STRATEGIC_TIER)
        .reduce((sum, entity) => sum + (spend.byId.get(entity._uid)?.vmSpend ?? 0), 0),
    [allVendors, spend.byId]
  );
  const strategicPct = totalSpend > 0 ? Math.round((strategicSpend / totalSpend) * 100) : 0;
  const costCentresCharged = useMemo(() => {
    const grouped = computeVmGroupSpend(allVendors, spend.byId, 'cost_centre');
    return [...grouped.entries()].filter(([value, amount]) => value !== '—' && amount > 0).length;
  }, [allVendors, spend.byId]);

  const openVendor = (id: string) => openEntityDrawer(id);
  const patchSearch = (patch: Partial<SpendSearchParams>) =>
    navigate({
      to: VENDOR_RAIL_PATHS[VENDOR_SPEND_ID],
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
  if (!vendorConfig.contractSchemaId) {
    return (
      <div className={styles.empty}>
        No Contract entity schema is bound. Configure the vendor management capability's Contract
        binding in workspace settings.
      </div>
    );
  }

  const isLoading = vendors.isLoading || spend.isLoading || contracts.isLoading;

  return (
    <div className={styles.screen}>
      <Title
        title="Spend"
        description="Annualised contract value rolled up by vendor or by cost centre. Grouping by capability
          isn't available yet — no Contract-to-capability link exists in the schema."
      />

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Total annualised</div>
          <div className={styles.tileValue}>{fmtMoney(totalSpend, totalCurrency)}</div>
          <div className={styles.tileSub}>{contracts.items.length} contracts</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Fixed-term commitment</div>
          <div className={styles.tileValue}>{fmtMoney(fixedTermCommitment, totalCurrency)}</div>
          <div className={styles.tileSub}>not auto-renewing</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Strategic tier</div>
          <div className={styles.tileValue}>{strategicPct}%</div>
          <div className={styles.tileSub}>of total spend</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Cost centres</div>
          <div className={styles.tileValue}>{costCentresCharged}</div>
          <div className={styles.tileSub}>charged</div>
        </div>
      </div>

      <div className={filterStyles.toolbar}>
        <FilterDropdown
          label="Group by"
          value={group}
          onChange={value =>
            patchSearch({
              group: value === 'vendor' ? undefined : (value as 'costCentre' | 'capability')
            })
          }
          options={[
            { value: 'vendor', label: 'By vendor' },
            { value: 'costCentre', label: 'By cost centre' },
            { value: 'capability', label: 'By capability' }
          ]}
        />
        <div style={{ marginLeft: 'auto' }}>
          {group !== 'capability' && !isLoading && (
            <span className={`${styles.inView} mono tabular`}>
              {fmtMoney(rowsTotal, totalCurrency)} in view
            </span>
          )}
        </div>
      </div>

      {group === 'capability' ? (
        <div className={styles.capabilityEmpty}>
          Capability roll-ups need a Contract-to-capability schema link, which doesn't exist yet.
          Once that link is added, spend can be grouped by the capability each contract funds — use
          vendor or cost centre grouping above until then.
        </div>
      ) : (
        <>
          <SpendShareStrip
            segments={rows.slice(0, 12).map(row => ({
              key: row.key,
              label: row.label,
              amount: row.amount,
              onClick: row.vendorId ? () => openVendor(row.vendorId!) : undefined
            }))}
            total={rowsTotal}
          />

          <Table.Root scroll stickyHeader>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>
                  {group === 'costCentre' ? 'Cost centre' : 'Vendor'}
                </Table.HeaderCell>
                <Table.HeaderCell width={160}>Share</Table.HeaderCell>
                <Table.HeaderCell numeric>Spend / yr</Table.HeaderCell>
                <Table.HeaderCell numeric>%</Table.HeaderCell>
                <Table.HeaderCell numeric>Contracts</Table.HeaderCell>
                <Table.HeaderCell>Largest contract</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {rows.length === 0 ? (
                <Table.EmptyRow colSpan={6}>
                  {isLoading ? 'Loading spend…' : 'No spend recorded yet.'}
                </Table.EmptyRow>
              ) : (
                rows.map(row => (
                  <Table.Row
                    key={row.key}
                    onClick={row.vendorId ? () => openVendor(row.vendorId!) : undefined}
                  >
                    <Table.NameCell title={row.label} subtitle={row.subtitle} />
                    <Table.Cell>
                      <SpendShareBar value={row.amount} max={maxRowAmount} />
                    </Table.Cell>
                    <Table.Cell numeric>{fmtMoney(row.amount, totalCurrency)}</Table.Cell>
                    <Table.Cell numeric>
                      <span className="dim mono tabular">
                        {rowsTotal > 0 ? ((row.amount / rowsTotal) * 100).toFixed(1) : '0.0'}%
                      </span>
                    </Table.Cell>
                    <Table.Cell numeric>{row.contractCount}</Table.Cell>
                    <Table.Cell>
                      {row.largestContractName ?? <span className="dim">—</span>}
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table.Root>
        </>
      )}
    </div>
  );
};
