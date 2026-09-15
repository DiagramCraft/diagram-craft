import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { Title } from '../../../components/Title';
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
import { useVendorContracts } from '../useVendorContracts';
import {
  renewalWindow,
  RENEWAL_WINDOWS,
  RENEWAL_WINDOW_COLOR,
  type RenewalWindow
} from '../contractRenewalWindow';
import { useVendorSpendRollups } from '../useVendorSpendRollups';
import { computeVmTotalSpend } from '../vendorSpendAggregates';
import { computeVendorRisk, VENDOR_RISK_BAND_COLOR } from '../vendorRisk';
import { useVendorTechnologyExposure, groupVendorTechnologyExposure } from '../useVendorTechnologyExposure';
import { SpendShareStrip } from './SpendShareBar';
import { StackedBar, Section, type BarBucket } from '../../../sections/workspace-settings/sub-sections/analytics/analyticsPrimitives';
import styles from './VendorOverviewScreen.module.css';

const NEXT_RENEWALS_LIMIT = 8;
const SPEND_STRIP_LIMIT = 8;

const fmtMoney = (amount: number, currency: string | null): string =>
  currency != null ? formatCurrencyValue({ amount, currency }) : '—';

/**
 * The Vendor Management app's landing screen (`sections[0]`, so the app switcher opens here). A
 * read-only dashboard of summary tiles — renewals due in the next 12 months, spend by vendor,
 * vendors above risk tolerance, and technology end-of-life exposure — plus a "Next renewals" list,
 * each linking into the rail section that owns the full view. Mirrors the Strategy app's landing
 * screen (`StrategyOverviewScreen.tsx`, #3196): everything is derived client-side from the same
 * entity/relation/metric queries and hooks the other four sections already use, with no bespoke
 * server endpoint and no new logic — this screen only summarizes it. Unlike the Strategy Overview,
 * the tiles are a fixed set (matching #3264's scope) rather than config-driven widgets, since
 * vendor-management has no per-view configurability to drive one.
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
    () => groupVendorTechnologyExposure(exposure.items),
    [exposure.items]
  );

  // Renewals-due strip: every Contract bucketed by `renewalWindow`, counting toward the 12-month
  // rollup (the calendar's own default window) rather than every `RenewalWindow` id — "later" and
  // "none" contracts aren't due, so they're excluded from the strip's total but still reachable via
  // the Contracts section itself.
  const renewalBuckets = useMemo<BarBucket[]>(() => {
    const counts = new Map<RenewalWindow, number>();
    for (const row of contracts.items) {
      const window = renewalWindow(
        typeof row.contract.contract_end === 'string' ? row.contract.contract_end : null
      );
      counts.set(window, (counts.get(window) ?? 0) + 1);
    }
    const dueWindows = RENEWAL_WINDOWS.filter(w => w.id !== 'later' && w.id !== 'none');
    const total = dueWindows.reduce((sum, w) => sum + (counts.get(w.id) ?? 0), 0) || 1;
    return dueWindows
      .filter(w => (counts.get(w.id) ?? 0) > 0)
      .map(w => ({
        label: w.label,
        count: counts.get(w.id) ?? 0,
        percent: ((counts.get(w.id) ?? 0) / total) * 100,
        color: RENEWAL_WINDOW_COLOR[w.id],
        onClick: () =>
          navigate({
            to: VENDOR_RAIL_PATHS[VENDOR_CONTRACTS_ID],
            params: { workspaceSlug },
            search: () => ({ renewalWindow: w.id })
          })
      }));
  }, [contracts.items, navigate, workspaceSlug]);
  const renewalsDueCount = renewalBuckets.reduce((sum, bucket) => sum + bucket.count, 0);

  const nextRenewalRows = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return contracts.items
      .filter(
        row =>
          typeof row.contract.contract_end === 'string' &&
          row.contract.contract_end.slice(0, 10) >= todayStr
      )
      .sort((a, b) => (a.contract.contract_end as string).localeCompare(b.contract.contract_end as string))
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
        .filter(row => row.amount > 0)
        .sort((a, b) => b.amount - a.amount),
    [allVendors, spend.byId]
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
  const aboveToleranceCount = allVendors.filter(entity => {
    const band = riskByUid.get(entity._uid)?.vmRiskBand;
    return band === 'elevated' || band === 'high';
  }).length;

  const eolAtRiskCount = eolGroups.filter(
    row => row.exposure.band && row.exposure.band !== 'ok'
  ).length;

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
        description="Renewals, spend, and risk across the vendor portfolio — each tile links to the section behind it."
      />

      <div className={styles.tiles}>
        <div className={styles.tile} key="renewals">
          <div className={styles.tileLabel}>Renewals due</div>
          <div className={styles.tileValue}>{renewalsDueCount}</div>
          <StackedBar buckets={renewalBuckets} />
          <div className={styles.legend}>
            {renewalBuckets.map(bucket => (
              <button
                key={bucket.label}
                type="button"
                className={styles.legendItem}
                onClick={bucket.onClick}
                disabled={!bucket.onClick}
              >
                <span className={styles.swatch} style={{ background: bucket.color ?? undefined }} />
                {bucket.label} {bucket.count}
              </button>
            ))}
            {renewalBuckets.length === 0 && (
              <span className={styles.tileSub}>No contracts due in the next 12 months.</span>
            )}
          </div>
        </div>

        <button
          type="button"
          className={styles.tile}
          onClick={() =>
            navigate({ to: VENDOR_RAIL_PATHS[VENDOR_SPEND_ID], params: { workspaceSlug } })
          }
        >
          <div className={styles.tileLabel}>Spend</div>
          <div className={styles.tileValue}>{fmtMoney(totalSpend, totalCurrency)}</div>
          <div className={styles.tileSub}>annualised, {spendRows.length} vendors</div>
        </button>

        <button
          type="button"
          className={styles.tile}
          onClick={() =>
            navigate({
              to: VENDOR_RAIL_PATHS[VENDOR_RISK_ID],
              params: { workspaceSlug },
              search: () => ({})
            })
          }
        >
          <div className={styles.tileLabel}>Above risk tolerance</div>
          <div className={styles.tileValue} style={{ color: VENDOR_RISK_BAND_COLOR.elevated }}>
            {aboveToleranceCount}
          </div>
          <div className={styles.tileSub}>elevated or high composite risk</div>
        </button>

        {vendorConfig.technologyReleaseSchemaId && !exposure.unavailable && (
          <button
            type="button"
            className={styles.tile}
            onClick={() =>
              navigate({
                to: VENDOR_RAIL_PATHS[VENDOR_RISK_ID],
                params: { workspaceSlug },
                search: () => ({})
              })
            }
          >
            <div className={styles.tileLabel}>Technology EOL exposure</div>
            <div className={styles.tileValue}>{eolAtRiskCount}</div>
            <div className={styles.tileSub}>technologies within 12 months of end-of-life</div>
          </button>
        )}
      </div>

      {spendRows.length > 0 && (
        <SpendShareStrip
          segments={spendRows.slice(0, SPEND_STRIP_LIMIT).map(row => ({
            key: row.key,
            label: row.label,
            amount: row.amount,
            onClick: () =>
              navigate({
                to: `${VENDOR_RAIL_PATHS[VENDOR_SPEND_ID]}/$vendorId`,
                params: { workspaceSlug, vendorId: row.vendorId },
                search: () => ({})
              })
          }))}
          total={spendRows.reduce((sum, row) => sum + row.amount, 0)}
        />
      )}

      <Section
        title="Next renewals"
        sub="soonest contract end dates across every vendor"
      >
        <Table.Root bordered={false}>
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>Contract</Table.HeaderCell>
              <Table.HeaderCell>Vendor</Table.HeaderCell>
              <Table.HeaderCell>Renewal</Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {nextRenewalRows.length === 0 ? (
              <Table.EmptyRow colSpan={3}>
                {contracts.isLoading ? 'Loading contracts…' : 'No upcoming renewals.'}
              </Table.EmptyRow>
            ) : (
              nextRenewalRows.map(row => (
                <Table.Row
                  key={row.contract._uid}
                  onClick={() => openContract(row.contract._publicId)}
                >
                  <Table.NameCell title={row.contract._name} />
                  <Table.Cell>{row.vendorName ?? <span className="dim">—</span>}</Table.Cell>
                  <Table.Cell>{formatDate(row.contract.contract_end)}</Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table.Root>
      </Section>
    </main>
  );
};
