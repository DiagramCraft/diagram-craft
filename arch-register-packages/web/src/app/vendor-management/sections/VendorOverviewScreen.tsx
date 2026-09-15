import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { Title } from '../../../components/Title';
import { Chip } from '../../../components/Chip';
import { Table } from '../../../components/table/Table';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { useSchemas } from '../../../hooks/useSchemas';
import { formatDate } from '../../../utils/dateFormat';
import { formatCurrencyValue } from '../../../utils/currencyFormat';
import { resolveVendorManagementConfig } from '../vendorManagementQueries';
import {
  VENDOR_RAIL_PATHS,
  VENDOR_CONTRACTS_ID,
  VENDOR_SPEND_ID,
  VENDOR_RISK_ID
} from '../vendorManagementSections';
import { useVendorContracts, type VendorContractRow } from '../useVendorContracts';
import { renewalWindow, RENEWAL_WINDOW_COLOR } from '../contractRenewalWindow';
import { useVendorSpendRollups } from '../useVendorSpendRollups';
import { computeVmTotalSpend } from '../vendorSpendAggregates';
import { computeVendorRisk, VENDOR_RISK_BAND_COLOR } from '../vendorRisk';
import {
  useVendorTechnologyExposure,
  groupVendorTechnologyExposure
} from '../useVendorTechnologyExposure';
import { useVendorAppsSuppliedCounts } from '../useVendorAppsSuppliedCounts';
import { SpendShareBar } from './SpendShareBar';
import tileStyles from './VendorSpendScreen.module.css';
import styles from './VendorOverviewScreen.module.css';

const NEXT_RENEWALS_LIMIT = 7;
const SPEND_LIST_LIMIT = 8;
const EOL_LIST_LIMIT = 5;
const RENEWAL_MONTHS = 12;
// The monthly renewal strip flags a month as urgent when it holds a contract due this soon —
// matching the Claude Design reference's `VMOverview` (`vendor.jsx`) 45-day threshold, expressed
// here via the shared `renewalWindow` buckets (`next30`) rather than a bespoke day count, since
// `next30` is the closest existing bucket boundary and keeps one definition of "due soon" across
// the app instead of introducing a second one just for this strip.
const STRIP_URGENT_WINDOWS = new Set(['overdue', 'next30']);

const currencyAmount = (value: unknown): number | null =>
  value != null && typeof value === 'object' && 'amount' in value
    ? ((value as { amount: unknown }).amount as number)
    : null;

const fmtMoney = (amount: number, currency: string | null): string =>
  currency != null ? formatCurrencyValue({ amount, currency }) : '—';

const contractEndOf = (row: VendorContractRow): string | null =>
  typeof row.contract.contract_end === 'string' ? row.contract.contract_end : null;

/** Days between `today` and a `YYYY-MM-DD` date-only string, positive for the future, negative for
 *  the past — the numeric sibling of `renewalWindow`'s bucketed classification, needed here for the
 *  "Xd" / "Xd ago" countdown the design reference shows on each next-renewal row. */
const daysUntil = (dateStr: string, today: Date = new Date()): number => {
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  return Math.round((end.getTime() - todayMidnight.getTime()) / 86_400_000);
};

const monthKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const MONTH_LABEL = new Intl.DateTimeFormat(undefined, { month: 'short' });

/**
 * The Vendor Management app's landing screen (`sections[0]`, so the app switcher opens here) — a
 * read-only dashboard summarizing the other four sections, each panel linking into the section
 * that owns the full view. Mirrors the Claude Design reference's `VMOverview` (`vendor.jsx`)
 * closely: four header stats, a 12-month renewal strip, a two-column row (next renewals / spend by
 * vendor), a second two-column row (vendors above tolerance / technology EOL exposure), and a
 * footnote linking back to Entities. Everything is derived client-side from the same
 * entity/contract/metric queries and hooks the other four sections already use — no bespoke server
 * endpoint and no new logic beyond `useVendorAppsSuppliedCounts` (a batched sibling of
 * `useVendorAppsSupplied.ts`, added so the "vendors above tolerance" table can show each vendor's
 * applications-supplied count without a per-row hook call).
 */
export const VendorOverviewScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const navigate = useNavigate();

  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const vendorConfig = resolveVendorManagementConfig(configurations.data);
  const schemas = useSchemas(workspaceSlug);
  const contractSchema = schemas.data?.find(schema => schema.id === vendorConfig?.contractSchemaId);
  // `system-contract` isn't exposed by `resolveVendorManagementConfig` — read its real,
  // per-workspace relation schema id off Contract's `system` typedRelation field, same as
  // `VendorRiskScreen.tsx`/`VendorDrawer.tsx` do.
  const systemField = contractSchema?.fields.find(field => field.id === 'system');
  const systemContractRelationSchemaId =
    systemField?.type === 'typedRelation' ? systemField.relationSchemaId : null;

  const vendors = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: vendorConfig?.vendorSchemaId, view: 'full', limit: 500 },
      vendorConfig != null
    )
  );
  const allVendors = vendors.data?.items ?? [];
  const vendorIds = useMemo(() => allVendors.map(entity => entity._uid), [allVendors]);

  const contracts = useVendorContracts(workspaceSlug, vendorConfig?.contractSchemaId ?? null);

  const spend = useVendorSpendRollups(workspaceSlug, vendorConfig?.contractSchemaId ?? null, vendorIds);
  const totalSpend = useMemo(() => computeVmTotalSpend(spend.byId), [spend.byId]);
  const totalCurrency = useMemo(
    () => [...spend.byId.values()].find(value => value.currency != null)?.currency ?? null,
    [spend.byId]
  );

  const appCounts = useVendorAppsSuppliedCounts(
    workspaceSlug,
    vendorConfig?.vendorSchemaId ?? null,
    vendorIds,
    vendorConfig?.contractSchemaId ?? null,
    systemContractRelationSchemaId
  );

  const exposure = useVendorTechnologyExposure(
    workspaceSlug,
    vendorConfig?.vendorSchemaId ?? null,
    vendorIds,
    vendorConfig?.contractSchemaId ?? null,
    systemContractRelationSchemaId,
    vendorConfig?.technologyReleaseSchemaId ?? null,
    schemas.data ?? []
  );
  const eolGroups = useMemo(
    () =>
      [...groupVendorTechnologyExposure(exposure.items)].sort(
        (a, b) => (a.exposure.daysUntilEol ?? Infinity) - (b.exposure.daysUntilEol ?? Infinity)
      ),
    [exposure.items]
  );

  const riskByUid = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeVendorRisk>>();
    for (const entity of allVendors) {
      map.set(
        entity._uid,
        computeVendorRisk({
          security_risk: typeof entity.security_risk === 'number' ? entity.security_risk : null,
          concentration_risk:
            typeof entity.concentration_risk === 'number' ? entity.concentration_risk : null,
          financial_risk: typeof entity.financial_risk === 'number' ? entity.financial_risk : null,
          compliance_risk:
            typeof entity.compliance_risk === 'number' ? entity.compliance_risk : null,
          criticality: typeof entity.criticality === 'number' ? entity.criticality : null
        })
      );
    }
    return map;
  }, [allVendors]);
  const riskyVendors = useMemo(
    () =>
      allVendors
        .filter(entity => {
          const band = riskByUid.get(entity._uid)?.vmRiskBand;
          return band === 'elevated' || band === 'high';
        })
        .sort((a, b) => (riskByUid.get(b._uid)?.vmRisk ?? 0) - (riskByUid.get(a._uid)?.vmRisk ?? 0)),
    [allVendors, riskByUid]
  );

  // Header stats
  const due90 = useMemo(
    () =>
      contracts.items.filter(row => {
        const end = contractEndOf(row);
        if (!end) return false;
        const days = daysUntil(end);
        return days >= 0 && days <= 90;
      }),
    [contracts.items]
  );
  const due90Amount = useMemo(
    () => due90.reduce((sum, row) => sum + (currencyAmount(row.contract.annual_cost) ?? 0), 0),
    [due90]
  );
  const autoRenewCount = contracts.items.filter(row => row.contract.auto_renew === true).length;

  // 12-month renewal strip — current month + next 11, folding an already-overdue contract into the
  // current month's cell rather than dropping it (same convention `VendorContractsCalendar.tsx`
  // uses for its own grid).
  const months = useMemo(() => {
    const today = new Date();
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const currentKey = monthKey(currentMonthStart);
    const starts = Array.from(
      { length: RENEWAL_MONTHS },
      (_, i) => new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + i, 1)
    );
    const buckets = new Map(
      starts.map(start => [
        monthKey(start),
        { key: monthKey(start), start, rows: [] as VendorContractRow[] }
      ])
    );
    const lastKey = monthKey(starts[starts.length - 1]!);
    for (const row of contracts.items) {
      const end = contractEndOf(row);
      if (!end) continue;
      const endDate = new Date(`${end.slice(0, 10)}T00:00:00`);
      if (Number.isNaN(endDate.getTime())) continue;
      const key = endDate < currentMonthStart ? currentKey : monthKey(endDate);
      if (key > lastKey) continue;
      buckets.get(key)?.rows.push(row);
    }
    return [...buckets.values()].map(bucket => ({
      ...bucket,
      total: bucket.rows.reduce((sum, row) => sum + (currencyAmount(row.contract.annual_cost) ?? 0), 0),
      urgent: bucket.rows.some(row => {
        const end = contractEndOf(row);
        return end && STRIP_URGENT_WINDOWS.has(renewalWindow(end));
      })
    }));
  }, [contracts.items]);
  const maxMonthTotal = Math.max(...months.map(m => m.total), 1);
  const monthsContractCount = months.reduce((sum, m) => sum + m.rows.length, 0);

  const nextRenewalRows = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return contracts.items
      .filter(row => {
        const end = contractEndOf(row);
        return end != null && end.slice(0, 10) >= todayStr;
      })
      .sort((a, b) => contractEndOf(a)!.localeCompare(contractEndOf(b)!))
      .slice(0, NEXT_RENEWALS_LIMIT);
  }, [contracts.items]);

  const spendRows = useMemo(
    () =>
      allVendors
        .map(entity => ({
          key: entity._uid,
          label: entity._name,
          vendorId: entity._publicId,
          amount: spend.byId.get(entity._uid)?.vmSpend ?? 0
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, SPEND_LIST_LIMIT),
    [allVendors, spend.byId]
  );
  const maxSpendAmount = Math.max(...spendRows.map(row => row.amount), 1);

  const openVendor = (id: string) =>
    navigate({
      to: `${VENDOR_RAIL_PATHS[VENDOR_SPEND_ID]}/$vendorId`,
      params: { workspaceSlug, vendorId: id },
      search: () => ({})
    });
  const openContract = (contractId: string) =>
    navigate({
      to: `${VENDOR_RAIL_PATHS[VENDOR_CONTRACTS_ID]}/$contractId`,
      params: { workspaceSlug, contractId },
      search: () => ({})
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
    <main className={styles.screen}>
      <Title
        title="Overview"
        description={`Renewals, committed spend and vendor risk across ${allVendors.length} suppliers. Figures roll up from Contract records.`}
        buttons={
          <Button
            variant="secondary"
            onClick={() =>
              navigate({
                to: VENDOR_RAIL_PATHS[VENDOR_CONTRACTS_ID],
                params: { workspaceSlug },
                search: () => ({ view: 'calendar' as const })
              })
            }
          >
            Renewal calendar
          </Button>
        }
      />

      <div className={tileStyles.tiles}>
        <div className={tileStyles.tile}>
          <div className={tileStyles.tileLabel}>Contracted spend</div>
          <div className={tileStyles.tileValue}>{fmtMoney(totalSpend, totalCurrency)}</div>
          <div className={tileStyles.tileSub}>annualised, all active contracts</div>
        </div>
        <div className={tileStyles.tile}>
          <div className={tileStyles.tileLabel}>Renewals in 90 days</div>
          <div
            className={tileStyles.tileValue}
            style={due90.length > 0 ? { color: VENDOR_RISK_BAND_COLOR.elevated } : undefined}
          >
            {due90.length}
          </div>
          <div className={tileStyles.tileSub}>{fmtMoney(due90Amount, totalCurrency)} at stake</div>
        </div>
        <div className={tileStyles.tile}>
          <div className={tileStyles.tileLabel}>Vendors above tolerance</div>
          <div className={tileStyles.tileValue} style={{ color: VENDOR_RISK_BAND_COLOR.high }}>
            {riskyVendors.length}
          </div>
          <div className={tileStyles.tileSub}>high or elevated composite risk</div>
        </div>
        <div className={tileStyles.tile}>
          <div className={tileStyles.tileLabel}>Auto-renewing</div>
          <div className={tileStyles.tileValue}>
            {autoRenewCount} of {contracts.items.length}
          </div>
          <div className={tileStyles.tileSub}>notice periods apply</div>
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Renewals — next 12 months</span>
          <span className="dim mono">{monthsContractCount} contracts</span>
        </div>
        <div className={styles.strip}>
          {months.map(month => (
            <div className={styles.stripCol} key={month.key}>
              <div className={styles.stripBarWrap}>
                <div
                  className={styles.stripBar}
                  style={{
                    height: `${Math.max(2, (100 * month.total) / maxMonthTotal)}%`,
                    background: month.urgent
                      ? RENEWAL_WINDOW_COLOR.overdue
                      : 'var(--accent-fg, #4b8bf5)'
                  }}
                />
              </div>
              <div className={`${styles.stripVal} dim mono tabular`}>
                {month.total > 0 ? fmtMoney(month.total, totalCurrency) : '—'}
              </div>
              <div className={`${styles.stripLabel} dim mono`}>
                {MONTH_LABEL.format(month.start)}
                {month.start.getMonth() === 0 ? ` ${String(month.start.getFullYear()).slice(2)}` : ''}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.two}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Next renewals</span>
            <button
              type="button"
              className={styles.panelLink}
              onClick={() =>
                navigate({ to: VENDOR_RAIL_PATHS[VENDOR_CONTRACTS_ID], params: { workspaceSlug } })
              }
            >
              All contracts
            </button>
          </div>
          <div className={styles.stack}>
            {nextRenewalRows.length === 0 ? (
              <div className={`${styles.empty} dim`}>
                {contracts.isLoading ? 'Loading contracts…' : 'No upcoming renewals.'}
              </div>
            ) : (
              nextRenewalRows.map(row => {
                const end = contractEndOf(row)!;
                const days = daysUntil(end);
                return (
                  <button
                    key={row.contract._uid}
                    type="button"
                    className={styles.row}
                    onClick={() => openContract(row.contract._publicId)}
                  >
                    <span className={styles.rowMain}>
                      <span className={styles.rowName}>{row.contract._name}</span>
                      <span className={`${styles.rowSub} dim`}>
                        {row.vendorName ?? '—'}
                        {row.contract.auto_renew === true ? ' · auto-renews' : ''}
                      </span>
                    </span>
                    <span className="dim mono tabular">
                      {fmtMoney(currencyAmount(row.contract.annual_cost) ?? 0, totalCurrency)}
                    </span>
                    <span
                      className="mono tabular"
                      style={{ color: RENEWAL_WINDOW_COLOR[renewalWindow(end)], minWidth: 72, textAlign: 'right' }}
                    >
                      {days < 0 ? `${Math.abs(days)}d ago` : `${days}d`}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Spend by vendor</span>
            <span className="dim mono">top {SPEND_LIST_LIMIT}</span>
          </div>
          <div className={styles.stack}>
            {spendRows.length === 0 ? (
              <div className={`${styles.empty} dim`}>
                {spend.isLoading ? 'Loading spend…' : 'No spend recorded yet.'}
              </div>
            ) : (
              spendRows.map(row => (
                <button
                  key={row.key}
                  type="button"
                  className={styles.rowBar}
                  onClick={() => openVendor(row.vendorId)}
                >
                  <span className={styles.rowName}>{row.label}</span>
                  <span style={{ flex: 1 }}>
                    <SpendShareBar value={row.amount} max={maxSpendAmount} />
                  </span>
                  <span className="mono tabular">{fmtMoney(row.amount, totalCurrency)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className={styles.two}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Vendors above tolerance</span>
            <button
              type="button"
              className={styles.panelLink}
              onClick={() =>
                navigate({ to: VENDOR_RAIL_PATHS[VENDOR_RISK_ID], params: { workspaceSlug } })
              }
            >
              Risk view
            </button>
          </div>
          <Table.Root bordered={false}>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Vendor</Table.HeaderCell>
                <Table.HeaderCell>Tier</Table.HeaderCell>
                <Table.HeaderCell numeric>Criticality</Table.HeaderCell>
                <Table.HeaderCell>Risk</Table.HeaderCell>
                <Table.HeaderCell numeric>Apps</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {riskyVendors.length === 0 ? (
                <Table.EmptyRow colSpan={5}>
                  {vendors.isLoading ? 'Loading vendors…' : 'No vendors above tolerance.'}
                </Table.EmptyRow>
              ) : (
                riskyVendors.map(entity => {
                  const risk = riskByUid.get(entity._uid);
                  return (
                    <Table.Row key={entity._uid} onClick={() => openVendor(entity._publicId)}>
                      <Table.NameCell title={entity._name} />
                      <Table.Cell>
                        <span className="dim">
                          {typeof entity.tier === 'string' ? entity.tier : '—'}
                        </span>
                      </Table.Cell>
                      <Table.Cell numeric>
                        {typeof entity.criticality === 'number' ? `${entity.criticality}/5` : '—'}
                      </Table.Cell>
                      <Table.Cell>
                        {risk?.vmRisk != null ? (
                          <Chip dot={VENDOR_RISK_BAND_COLOR[risk.vmRiskBand!]} tone="ghost">
                            {risk.vmRiskBand} · {risk.vmRisk.toFixed(1)}
                          </Chip>
                        ) : (
                          <span className="dim">—</span>
                        )}
                      </Table.Cell>
                      <Table.Cell numeric>{appCounts.byId.get(entity._uid) ?? '—'}</Table.Cell>
                    </Table.Row>
                  );
                })
              )}
            </Table.Body>
          </Table.Root>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Technology end-of-life exposure</span>
            <span className="dim mono">{eolGroups.length}</span>
          </div>
          <div className={styles.stack}>
            {!vendorConfig.technologyReleaseSchemaId || exposure.unavailable ? (
              <div className={`${styles.empty} dim`}>
                No Technology Release schema is linked — see the Risk section to configure it.
              </div>
            ) : eolGroups.length === 0 ? (
              <div className={`${styles.empty} dim`}>
                {exposure.isLoading ? 'Loading technology exposure…' : 'No exposure found.'}
              </div>
            ) : (
              eolGroups.slice(0, EOL_LIST_LIMIT).map(row => (
                <button
                  key={row.key}
                  type="button"
                  className={styles.row}
                  onClick={() => openVendor(row.vendor._publicId)}
                >
                  <span className={styles.rowMain}>
                    <span className={styles.rowName}>{row.technologyRelease._name}</span>
                    <span className={`${styles.rowSub} dim`}>
                      {row.vendor._name} · {row.systems.length} application
                      {row.systems.length === 1 ? '' : 's'} affected
                    </span>
                  </span>
                  <span
                    className="mono tabular"
                    style={{
                      color:
                        row.exposure.band === 'past' || row.exposure.band === 'within6Months'
                          ? RENEWAL_WINDOW_COLOR.overdue
                          : VENDOR_RISK_BAND_COLOR.elevated
                    }}
                  >
                    {row.exposure.effectiveDate ? formatDate(row.exposure.effectiveDate) : '—'}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className={`${styles.note} dim`}>
        Vendor and Contract records are bound to this workspace by the vendor-management
        capability. Spend, risk, and renewal figures are computed roll-ups — edit the underlying
        records in{' '}
        <button
          type="button"
          className={styles.noteLink}
          onClick={() => navigate({ to: '/$workspaceSlug/entities', params: { workspaceSlug } })}
        >
          Entities
        </button>
        .
      </div>
    </main>
  );
};
