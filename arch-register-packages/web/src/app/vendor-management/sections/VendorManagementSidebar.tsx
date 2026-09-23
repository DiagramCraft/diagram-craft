import { useMemo, type ReactNode } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  TbBuildingStore,
  TbCalendarDue,
  TbFileCertificate,
  TbShieldExclamation,
  TbTag,
  TbUsers,
  TbWallet
} from 'react-icons/tb';
import {
  SidebarGroupLabel,
  SidebarTitleHeader
} from '../../../components/sidebar/SidebarPrimitives';
import { TreeRow } from '../../../components/TreeRow';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { useSchemas } from '../../../hooks/useSchemas';
import { formatCurrencyValue } from '../../../utils/currencyFormat';
import {
  resolveVendorManagementConfig,
  type VendorManagementConfig
} from '../vendorManagementQueries';
import { useVendorContracts } from '../useVendorContracts';
import { useVendorSpendRollups } from '../useVendorSpendRollups';
import { computeVmGroupSpend, computeVmTotalSpend } from '../vendorSpendAggregates';
import { renewalWindow, RENEWAL_WINDOWS } from '../contractRenewalWindow';
import {
  vendorRiskBandFor,
  VENDOR_RISK_BAND_COLOR,
  VENDOR_RISK_BAND_LABEL,
  type VendorRiskBand
} from '../vendorRisk';
import {
  useVendorTechnologyExposure,
  groupVendorTechnologyExposure
} from '../useVendorTechnologyExposure';
import {
  VENDOR_RAIL_PATHS,
  VENDOR_SECTIONS,
  VENDOR_SECTION_LABELS,
  VENDOR_CONTRACTS_ID,
  VENDOR_SPEND_ID,
  VENDOR_VENDORS_ID,
  VENDOR_RISK_ID,
  type VendorManagementRailItemId
} from '../vendorManagementSections';
import type {
  ContractsSearchParams,
  RiskSearchParams,
  SpendSearchParams,
  VendorsSearchParams
} from '../../../routes/searchParams';
import styles from '../../../shell/SidePanel.module.css';

const FacetRow = ({
  icon,
  label,
  testId,
  active,
  onClick,
  trailing
}: {
  icon: ReactNode;
  label: string;
  testId: string;
  active: boolean;
  onClick: () => void;
  trailing?: ReactNode;
}) => (
  <TreeRow
    icon={icon}
    label={label}
    testId={testId}
    active={active}
    onClick={onClick}
    trailing={trailing}
  />
);

/**
 * The Vendors section's own primary-sidebar content: Tier / Category / Owner facets over the
 * vendor register, replacing the plain "Sections" nav list for this section only — mirrors
 * `../../strategy-model/sections/StrategySidebar.tsx`'s `CapabilitiesSidebarContent`.
 *
 * Tier and Category are fixed `select` fields, so their facet options come straight off the
 * Vendor schema's own field definitions (`optionLabel`'s approach in `../vendorFieldDisplay.ts`),
 * not an enum-lookup hook. Owner (`relationship_owner`) is free text, not a team relation, so its
 * facet is the distinct values actually present among fetched vendors — same "derive facets from
 * the fetched page" approach `GlossarySidebar`/`CapabilitiesSidebarContent` already use, with the
 * same undercount caveat beyond the 500-vendor page cap.
 */
const VendorsSidebarContent = ({
  workspaceSlug,
  vendorSchemaId
}: {
  workspaceSlug: string;
  vendorSchemaId: string;
}) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as VendorsSearchParams;
  const { data: schemas } = useSchemas(workspaceSlug);
  const vendorSchema = schemas?.find(schema => schema.id === vendorSchemaId);

  const { data: vendorsData } = useQuery(
    entitiesQuery(workspaceSlug, { schemaId: vendorSchemaId, view: 'full', limit: 500 })
  );
  const vendors = vendorsData?.items ?? [];

  const fieldOptions = (fieldId: string) => {
    const field = vendorSchema?.fields.find(candidate => candidate.id === fieldId);
    return field && field.type === 'select' ? (field.options ?? []) : [];
  };

  const countByValue = useMemo(() => {
    const build = (fieldId: string) => {
      const counts = new Map<string, number>();
      for (const vendor of vendors) {
        const value = vendor[fieldId];
        if (typeof value === 'string' && value) counts.set(value, (counts.get(value) ?? 0) + 1);
      }
      return counts;
    };
    return { tier: build('tier'), category: build('category') };
  }, [vendors]);
  const tierCounts = countByValue.tier;
  const categoryCounts = countByValue.category;
  const ownerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const vendor of vendors) {
      const owner = vendor.relationship_owner;
      if (typeof owner === 'string' && owner) counts.set(owner, (counts.get(owner) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [vendors]);

  const patchSearch = (patch: Partial<VendorsSearchParams>) =>
    navigate({
      to: VENDOR_RAIL_PATHS[VENDOR_VENDORS_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  const hasAnySelection = !!search.tier || !!search.category || !!search.owner;
  const clearAll = () => patchSearch({ tier: undefined, category: undefined, owner: undefined });

  return (
    <>
      <TreeRow
        icon={<TbBuildingStore size={12} />}
        label="All vendors"
        testId="vendor-facet-all"
        active={!hasAnySelection}
        onClick={clearAll}
        trailing={<span className="dim mono">{vendors.length}</span>}
      />
      <SidebarGroupLabel>Tier</SidebarGroupLabel>
      {fieldOptions('tier').map(option => (
        <FacetRow
          key={option.value}
          icon={<TbTag size={12} />}
          label={option.label}
          testId={`vendor-facet-tier-${option.value}`}
          active={search.tier === option.value}
          onClick={() =>
            patchSearch({ tier: search.tier === option.value ? undefined : option.value })
          }
          trailing={<span className="dim mono">{tierCounts.get(option.value) ?? 0}</span>}
        />
      ))}
      <SidebarGroupLabel>Category</SidebarGroupLabel>
      {fieldOptions('category').map(option => (
        <FacetRow
          key={option.value}
          icon={<TbTag size={12} />}
          label={option.label}
          testId={`vendor-facet-category-${option.value}`}
          active={search.category === option.value}
          onClick={() =>
            patchSearch({ category: search.category === option.value ? undefined : option.value })
          }
          trailing={<span className="dim mono">{categoryCounts.get(option.value) ?? 0}</span>}
        />
      ))}
      <SidebarGroupLabel>Owner</SidebarGroupLabel>
      {ownerCounts.length === 0 && (
        <div className={`${styles.emptyState} dim`}>No relationship owners assigned.</div>
      )}
      {ownerCounts.map(([owner, count]) => (
        <FacetRow
          key={owner}
          icon={<TbUsers size={12} />}
          label={owner}
          testId={`vendor-facet-owner-${owner}`}
          active={search.owner === owner}
          onClick={() => patchSearch({ owner: search.owner === owner ? undefined : owner })}
          trailing={<span className="dim mono">{count}</span>}
        />
      ))}
    </>
  );
};

/**
 * The Contracts section's own primary-sidebar content: Renewal window / Type / Vendor facets over
 * the Contract register, mirroring `VendorsSidebarContent` above. Renewal window isn't a schema
 * `select` field (it's a computed bucket, see `../contractRenewalWindow.ts`), so its facet options
 * come from the fixed `RENEWAL_WINDOWS` list rather than `fieldOptions`; Type does come from
 * Contract's own `contract_type` select field; Vendor is derived from the distinct vendors present
 * among fetched contracts (via `useVendorContracts`'s tree join, since a flat fetch can't resolve
 * vendor names — see that hook's own comment), same "derive facets from the fetched page" approach
 * the Owner facet above uses, patched by vendor **uid** but displayed by vendor **name**.
 */
const ContractsSidebarContent = ({
  workspaceSlug,
  contractSchemaId
}: {
  workspaceSlug: string;
  contractSchemaId: string;
}) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as ContractsSearchParams;
  const { data: schemas } = useSchemas(workspaceSlug);
  const contractSchema = schemas?.find(schema => schema.id === contractSchemaId);

  const contracts = useVendorContracts(workspaceSlug, contractSchemaId);
  const items = contracts.items;

  const fieldOptions = (fieldId: string) => {
    const field = contractSchema?.fields.find(candidate => candidate.id === fieldId);
    return field && field.type === 'select' ? (field.options ?? []) : [];
  };

  const renewalWindowCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { contract } of items) {
      const key = renewalWindow(
        typeof contract.contract_end === 'string' ? contract.contract_end : null
      );
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [items]);

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { contract } of items) {
      const value = contract.contract_type;
      if (typeof value === 'string' && value) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return counts;
  }, [items]);

  const vendorCounts = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const { vendorId, vendorName } of items) {
      if (!vendorId || !vendorName) continue;
      const existing = counts.get(vendorId);
      counts.set(vendorId, { name: vendorName, count: (existing?.count ?? 0) + 1 });
    }
    return [...counts.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [items]);

  const patchSearch = (patch: Partial<ContractsSearchParams>) =>
    navigate({
      to: VENDOR_RAIL_PATHS[VENDOR_CONTRACTS_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  const hasAnySelection = !!search.type || !!search.vendor || !!search.renewalWindow;
  const clearAll = () =>
    patchSearch({ type: undefined, vendor: undefined, renewalWindow: undefined });

  return (
    <>
      <TreeRow
        icon={<TbFileCertificate size={12} />}
        label="All contracts"
        testId="contract-facet-all"
        active={!hasAnySelection}
        onClick={clearAll}
        trailing={<span className="dim mono">{items.length}</span>}
      />
      <SidebarGroupLabel>Renewal window</SidebarGroupLabel>
      {RENEWAL_WINDOWS.map(bucket => (
        <FacetRow
          key={bucket.id}
          icon={<TbCalendarDue size={12} />}
          label={bucket.label}
          testId={`contract-facet-renewal-${bucket.id}`}
          active={search.renewalWindow === bucket.id}
          onClick={() =>
            patchSearch({
              renewalWindow: search.renewalWindow === bucket.id ? undefined : bucket.id
            })
          }
          trailing={<span className="dim mono">{renewalWindowCounts.get(bucket.id) ?? 0}</span>}
        />
      ))}
      <SidebarGroupLabel>Type</SidebarGroupLabel>
      {fieldOptions('contract_type').map(option => (
        <FacetRow
          key={option.value}
          icon={<TbTag size={12} />}
          label={option.label}
          testId={`contract-facet-type-${option.value}`}
          active={search.type === option.value}
          onClick={() =>
            patchSearch({ type: search.type === option.value ? undefined : option.value })
          }
          trailing={<span className="dim mono">{typeCounts.get(option.value) ?? 0}</span>}
        />
      ))}
      <SidebarGroupLabel>Vendor</SidebarGroupLabel>
      {vendorCounts.length === 0 && (
        <div className={`${styles.emptyState} dim`}>No vendors linked to any contract.</div>
      )}
      {vendorCounts.map(([vendorId, { name, count }]) => (
        <FacetRow
          key={vendorId}
          icon={<TbBuildingStore size={12} />}
          label={name}
          testId={`contract-facet-vendor-${vendorId}`}
          active={search.vendor === vendorId}
          onClick={() => patchSearch({ vendor: search.vendor === vendorId ? undefined : vendorId })}
          trailing={<span className="dim mono">{count}</span>}
        />
      ))}
    </>
  );
};

/**
 * The Spend section's own primary-sidebar content: Cost Centre and Owner facets over the vendor
 * register, mirroring `VendorsSidebarContent`/`ContractsSidebarContent` above. Each Cost Centre
 * row's trailing figure is that centre's own annualised spend (`vmGroupSpend` over `cost_centre`),
 * not a plain count — the whole point of this facet is to jump straight to the biggest spend
 * pools. Selecting a facet sets `VendorSpendScreen.tsx`'s `cc`/`owner` search params, which narrow
 * its roll-up rows (its header stats stay portfolio-wide, matching the design reference).
 */
const SpendSidebarContent = ({
  workspaceSlug,
  vendorSchemaId,
  contractSchemaId
}: {
  workspaceSlug: string;
  vendorSchemaId: string;
  contractSchemaId: string | null;
}) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as SpendSearchParams;
  const { data: schemas } = useSchemas(workspaceSlug);
  const vendorSchema = schemas?.find(schema => schema.id === vendorSchemaId);

  const { data: vendorsData } = useQuery(
    entitiesQuery(workspaceSlug, { schemaId: vendorSchemaId, view: 'full', limit: 500 })
  );
  const vendors = vendorsData?.items ?? [];
  const vendorIds = useMemo(() => vendors.map(vendor => vendor._uid), [vendors]);
  const spend = useVendorSpendRollups(workspaceSlug, contractSchemaId, vendorIds);

  const totalSpend = useMemo(() => computeVmTotalSpend(spend.byId), [spend.byId]);
  const totalCurrency = useMemo(
    () => [...spend.byId.values()].find(value => value.currency != null)?.currency ?? null,
    [spend.byId]
  );
  const ccSpend = useMemo(
    () => computeVmGroupSpend(vendors, spend.byId, 'cost_centre'),
    [vendors, spend.byId]
  );
  // `formatCurrencyValue` falls back to `String(value)` (rendering `[object Object]`) without a
  // real currency code, which happens whenever there's no spend data yet — see the identical guard
  // in `VendorSpendScreen.tsx`.
  const fmtMoney = (amount: number, currency: string | null): string =>
    currency != null ? formatCurrencyValue({ amount, currency }) : '—';

  const ownerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const vendor of vendors) {
      const owner = vendor.relationship_owner;
      if (typeof owner === 'string' && owner) counts.set(owner, (counts.get(owner) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [vendors]);

  const patchSearch = (patch: Partial<SpendSearchParams>) =>
    navigate({
      to: VENDOR_RAIL_PATHS[VENDOR_SPEND_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  const hasAnySelection = !!search.cc || !!search.owner;
  const clearAll = () => patchSearch({ cc: undefined, owner: undefined });

  const costCentreField = vendorSchema?.fields.find(field => field.id === 'cost_centre');
  const costCentreOptions =
    costCentreField &&
    (costCentreField.type === 'select' || costCentreField.type === 'derived') &&
    'options' in costCentreField
      ? (costCentreField.options ?? [])
      : [];

  return (
    <>
      <TreeRow
        icon={<TbWallet size={12} />}
        label="All cost centres"
        testId="spend-facet-cc-all"
        active={!hasAnySelection}
        onClick={clearAll}
        trailing={<span className="dim mono">{fmtMoney(totalSpend, totalCurrency)}</span>}
      />
      <SidebarGroupLabel>Cost centre</SidebarGroupLabel>
      {costCentreOptions.map(option => (
        <FacetRow
          key={option.value}
          icon={<TbTag size={12} />}
          label={option.label}
          testId={`spend-facet-cc-${option.value}`}
          active={search.cc === option.value}
          onClick={() => patchSearch({ cc: search.cc === option.value ? undefined : option.value })}
          trailing={
            <span className="dim mono">
              {fmtMoney(ccSpend.get(option.value) ?? 0, totalCurrency)}
            </span>
          }
        />
      ))}
      <SidebarGroupLabel>Owner</SidebarGroupLabel>
      {ownerCounts.length === 0 && (
        <div className={`${styles.emptyState} dim`}>No relationship owners assigned.</div>
      )}
      {ownerCounts.map(([owner, count]) => (
        <FacetRow
          key={owner}
          icon={<TbUsers size={12} />}
          label={owner}
          testId={`spend-facet-owner-${owner}`}
          active={search.owner === owner}
          onClick={() => patchSearch({ owner: search.owner === owner ? undefined : owner })}
          trailing={<span className="dim mono">{count}</span>}
        />
      ))}
    </>
  );
};

// Design reference's sidebar lists the Band facet High-to-Low (the reverse of the matrix's own
// low-to-high column order) — kept as its own constant rather than reversing
// `VENDOR_RISK_BANDS` inline at every use.
const RISK_BAND_FACET_ORDER: readonly VendorRiskBand[] = ['high', 'elevated', 'moderate', 'low'];

/**
 * The Risk section's own primary-sidebar content: a risk-band facet over the vendor register,
 * plus a "Technology EOL" list of every exposed technology (each opening its vendor directly) —
 * mirrors the design reference's `vendor.jsx` `VMSidebar` `section === "risk"` branch exactly.
 * There is no Criticality facet here (criticality is read straight off the `RiskMatrix` rows
 * instead) and no free-text search, matching the design reference.
 */
const RiskSidebarContent = ({
  workspaceSlug,
  vendorConfig
}: {
  workspaceSlug: string;
  vendorConfig: VendorManagementConfig;
}) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as RiskSearchParams;
  const { data: schemas = [] } = useSchemas(workspaceSlug);
  const contractSchema = schemas.find(schema => schema.id === vendorConfig.contractSchemaId);
  const systemField = contractSchema?.fields.find(field => field.id === 'system');
  const systemContractRelationSchemaId =
    systemField?.type === 'typedRelation' ? systemField.relationSchemaId : null;

  const { data: vendorsData } = useQuery(
    entitiesQuery(workspaceSlug, {
      schemaId: vendorConfig.vendorSchemaId,
      view: 'full',
      limit: 500
    })
  );
  const vendors = vendorsData?.items ?? [];
  const vendorIds = useMemo(() => vendors.map(vendor => vendor._uid), [vendors]);

  const risks = useMemo(
    () => vendors.map(vendor => (typeof vendor.risk === 'number' ? vendor.risk : null)),
    [vendors]
  );

  const bandCounts = useMemo(() => {
    const counts = new Map<VendorRiskBand, number>();
    for (const risk of risks) {
      const band = vendorRiskBandFor(risk);
      if (band) counts.set(band, (counts.get(band) ?? 0) + 1);
    }
    return counts;
  }, [risks]);

  const exposure = useVendorTechnologyExposure(
    workspaceSlug,
    vendorConfig.vendorSchemaId,
    vendorIds,
    vendorConfig.contractSchemaId,
    systemContractRelationSchemaId,
    vendorConfig.technologyReleaseSchemaId,
    schemas
  );
  // One row per distinct Technology Release, not per (vendor, Technology Release) pair — the same
  // technology can be exposed via more than one vendor, and the sidebar only needs to name it
  // once. Sorted soonest-EOL-first (nulls last); the representative kept for a duplicate is
  // arbitrary (whichever vendor's row groupVendorTechnologyExposure produced first) since its
  // name/date are identical across vendors — only the filter's `vendorIds` set (computed in
  // `VendorRiskScreen.tsx`) needs every vendor, not this list.
  const eolByTechnology = useMemo(() => {
    const groups = groupVendorTechnologyExposure(exposure.items);
    const byTechnologyId = new Map<string, (typeof groups)[number]>();
    for (const group of groups) {
      if (!byTechnologyId.has(group.technologyRelease._uid)) {
        byTechnologyId.set(group.technologyRelease._uid, group);
      }
    }
    return [...byTechnologyId.values()].sort(
      (a, b) => (a.exposure.daysUntilEol ?? Infinity) - (b.exposure.daysUntilEol ?? Infinity)
    );
  }, [exposure.items]);

  const patchSearch = (patch: Partial<RiskSearchParams>) =>
    navigate({
      to: VENDOR_RAIL_PATHS[VENDOR_RISK_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  const setBand = (band: VendorRiskBand) =>
    patchSearch({ band: search.band === band ? undefined : band });

  const setTechnology = (key: string) =>
    patchSearch({ technology: search.technology === key ? undefined : key });

  return (
    <>
      <SidebarGroupLabel>Band</SidebarGroupLabel>
      {RISK_BAND_FACET_ORDER.map(band => (
        <FacetRow
          key={band}
          icon={
            <span className="dim" style={{ color: VENDOR_RISK_BAND_COLOR[band] }}>
              ●
            </span>
          }
          label={VENDOR_RISK_BAND_LABEL[band]}
          testId={`risk-facet-band-${band}`}
          active={search.band === band}
          onClick={() => setBand(band)}
          trailing={<span className="dim mono">{bandCounts.get(band) ?? 0}</span>}
        />
      ))}
      {/* Always renders this group label, even with no exposure data yet, so the facet's
          presence doesn't depend on there being data — its own row below explains why it's
          empty instead of disappearing. Selecting an item filters the main area's matrix,
          register, and EOL table down to that technology's vendor(s)
          (`RiskSearchParams.technology`, a Technology Release uid), same as the Band facet above
          — it doesn't navigate away, so the two facets combine. */}
      <SidebarGroupLabel>Technology EOL</SidebarGroupLabel>
      {eolByTechnology.length === 0 ? (
        <div className={`${styles.emptyState} dim`}>No technology end-of-life exposure found.</div>
      ) : (
        eolByTechnology.map(group => (
          <FacetRow
            key={group.technologyRelease._uid}
            icon={<TbShieldExclamation size={12} />}
            label={group.technologyRelease._name}
            testId={`risk-facet-eol-${group.technologyRelease._uid}`}
            active={search.technology === group.technologyRelease._uid}
            onClick={() => setTechnology(group.technologyRelease._uid)}
            trailing={
              <span className="dim mono">
                {group.exposure.effectiveDate
                  ? new Date(group.exposure.effectiveDate).getFullYear()
                  : '—'}
              </span>
            }
          />
        ))
      )}
    </>
  );
};

/**
 * Section-dependent primary sidebar for the Vendor Management app: navigation between the app's
 * five rail sections, gated on the `vendor-management` capability configuration (mirrors
 * `../../strategy-model/sections/StrategySidebar.tsx`'s `!enabled` empty state). The Vendors,
 * Contracts, Spend, and Risk sections replace this nav list with their own facet content (see
 * `VendorsSidebarContent`/`ContractsSidebarContent`/`SpendSidebarContent`/`RiskSidebarContent`
 * above).
 */
export const VendorManagementSidebar = ({
  workspaceSlug,
  activeSection
}: {
  workspaceSlug: string;
  activeSection: VendorManagementRailItemId;
}) => {
  const navigate = useNavigate();
  const { data: configurations } = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const vendorConfig = resolveVendorManagementConfig(configurations);
  const enabled = vendorConfig !== null;

  return (
    <>
      <SidebarTitleHeader title={VENDOR_SECTION_LABELS[activeSection]} />
      <div className={styles.scroll}>
        {!enabled ? (
          <div className={`${styles.emptyState} dim`}>Vendor management is not enabled.</div>
        ) : activeSection === VENDOR_VENDORS_ID ? (
          <VendorsSidebarContent
            workspaceSlug={workspaceSlug}
            vendorSchemaId={vendorConfig.vendorSchemaId}
          />
        ) : activeSection === VENDOR_CONTRACTS_ID && vendorConfig.contractSchemaId ? (
          <ContractsSidebarContent
            workspaceSlug={workspaceSlug}
            contractSchemaId={vendorConfig.contractSchemaId}
          />
        ) : activeSection === VENDOR_SPEND_ID ? (
          <SpendSidebarContent
            workspaceSlug={workspaceSlug}
            vendorSchemaId={vendorConfig.vendorSchemaId}
            contractSchemaId={vendorConfig.contractSchemaId}
          />
        ) : activeSection === VENDOR_RISK_ID ? (
          <RiskSidebarContent workspaceSlug={workspaceSlug} vendorConfig={vendorConfig} />
        ) : (
          <>
            <SidebarGroupLabel>Sections</SidebarGroupLabel>
            {VENDOR_SECTIONS.map(section => (
              <TreeRow
                key={section.id}
                label={section.label}
                testId={`vendor-nav-${section.id}`}
                active={section.id === activeSection}
                onClick={() =>
                  navigate({
                    to: VENDOR_RAIL_PATHS[section.id],
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
