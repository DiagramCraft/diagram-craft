import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { Title } from '../../../components/Title';
import { FilterDropdown } from '../../../components/FilterDropdown';
import { Table } from '../../../components/table/Table';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { useSchemas } from '../../../hooks/useSchemas';
import { formatCurrencyValue } from '../../../utils/currencyFormat';
import { resolveVendorManagementConfig } from '../vendorManagementQueries';
import { VENDOR_RAIL_PATHS, VENDOR_VENDORS_ID } from '../vendorManagementSections';
import { useVendorSpendRollups } from '../useVendorSpendRollups';
import { computeVmTotalSpend, computeVmGroupSpend } from '../vendorSpendAggregates';
import type { SpendSearchParams } from '../../../routes/searchParams';
import { SpendShareBar } from './SpendShareBar';
import filterStyles from '../../../sections/entities/components/EntityBrowser.module.css';
import styles from './VendorManagementPlaceholderScreen.module.css';

type SpendRow = {
  key: string;
  label: string;
  subtitle?: string;
  amount: number;
  vendorId?: string;
};

const costCentreLabel = (vendorSchema: EntitySchema | undefined, value: string): string => {
  if (value === '—') return value;
  const field = vendorSchema?.fields.find(candidate => candidate.id === 'cost_centre');
  if (field && (field.type === 'select' || field.type === 'derived') && 'options' in field) {
    return field.options?.find(option => option.value === value)?.label ?? value;
  }
  return value;
};

/**
 * The Spend section: portfolio-wide spend roll-ups grouped either by vendor or by Vendor's
 * `cost_centre` field, each row shown with a `SpendShareBar` (its share of the portfolio total).
 * Grouping is controlled by the `group` search param, mirroring the Contracts screen's `view`
 * toggle. Vendor rows open the shared `VendorDrawer` via the Vendors section's own
 * `vendors/$vendorId` route rather than a Spend-local detail route — cost-centre rows aren't
 * clickable (no single entity to drill into).
 *
 * Only vendor/cost-centre grouping is supported today. The issue also calls for a capability
 * dimension, but no Contract→capability schema link exists yet (tracked separately) and
 * `VendorManagementConfig` has no `capabilitySchemaId` to resolve it — that grouping is deferred
 * until the schema link lands.
 *
 * Roll-ups reuse `useVendorSpendRollups` (batched `metrics.rollup` over `annual_cost`) and the
 * pure client-side aggregations in `../vendorSpendAggregates.ts` (`computeVmTotalSpend`,
 * `computeVmGroupSpend`) — there's no server-side "group by field value" aggregation, see that
 * module's own comments.
 */
export const VendorSpendScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const navigate = useNavigate();
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

  const totalSpend = useMemo(() => computeVmTotalSpend(spend.byId), [spend.byId]);
  const totalCurrency = useMemo(
    () => [...spend.byId.values()].find(value => value.currency != null)?.currency ?? null,
    [spend.byId]
  );

  const rows: SpendRow[] = useMemo(() => {
    if (group === 'costCentre') {
      const grouped = computeVmGroupSpend(allVendors, spend.byId, 'cost_centre');
      return [...grouped.entries()]
        .map(([value, amount]) => ({
          key: value,
          label: costCentreLabel(vendorSchema, value),
          amount
        }))
        .sort((a, b) => b.amount - a.amount);
    }
    return allVendors
      .map(entity => ({
        key: entity._uid,
        label: entity._name,
        subtitle: entity._publicId,
        amount: spend.byId.get(entity._uid)?.vmSpend ?? 0,
        vendorId: entity._publicId
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [group, allVendors, spend.byId, vendorSchema]);

  const openVendor = (vendorId: string) =>
    navigate({
      to: `${VENDOR_RAIL_PATHS[VENDOR_VENDORS_ID]}/$vendorId`,
      params: { workspaceSlug, vendorId },
      search: (previous: Record<string, unknown>) => previous
    });
  const patchSearch = (patch: Partial<SpendSearchParams>) =>
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
      <Title
        title="Spend"
        chips={
          !spend.isLoading &&
          totalSpend > 0 && (
            <span>{formatCurrencyValue({ amount: totalSpend, currency: totalCurrency })}</span>
          )
        }
      />

      <div className={filterStyles.toolbar}>
        <div style={{ marginLeft: 'auto' }}>
          <FilterDropdown
            label="Group by"
            value={group}
            onChange={value =>
              patchSearch({ group: value === 'vendor' ? undefined : (value as 'costCentre') })
            }
            options={[
              { value: 'vendor', label: 'Vendor' },
              { value: 'costCentre', label: 'Cost centre' }
            ]}
          />
        </div>
      </div>

      <Table.Root scroll stickyHeader>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>{group === 'costCentre' ? 'Cost centre' : 'Vendor'}</Table.HeaderCell>
            <Table.HeaderCell>Share of spend</Table.HeaderCell>
            <Table.HeaderCell numeric>Annual spend</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {rows.length === 0 ? (
            <Table.EmptyRow colSpan={3}>
              {vendors.isLoading || spend.isLoading ? 'Loading spend…' : 'No spend recorded yet.'}
            </Table.EmptyRow>
          ) : (
            rows.map(row => (
              <Table.Row
                key={row.key}
                onClick={row.vendorId ? () => openVendor(row.vendorId!) : undefined}
              >
                <Table.NameCell title={row.label} subtitle={row.subtitle} />
                <Table.Cell>
                  <SpendShareBar amount={row.amount} total={totalSpend} />
                </Table.Cell>
                <Table.Cell numeric>
                  {formatCurrencyValue({ amount: row.amount, currency: totalCurrency })}
                </Table.Cell>
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table.Root>
    </div>
  );
};
