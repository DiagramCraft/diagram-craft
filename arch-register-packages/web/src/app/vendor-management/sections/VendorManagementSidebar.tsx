import { useMemo, type ReactNode } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { TbBuildingStore, TbCalendarDue, TbFileCertificate, TbTag, TbUsers } from 'react-icons/tb';
import {
  SidebarGroupLabel,
  SidebarTitleHeader
} from '../../../components/sidebar/SidebarPrimitives';
import { TreeRow } from '../../../components/TreeRow';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { useSchemas } from '../../../hooks/useSchemas';
import { resolveVendorManagementConfig } from '../vendorManagementQueries';
import { useVendorContracts } from '../useVendorContracts';
import { renewalWindow, RENEWAL_WINDOWS } from '../contractRenewalWindow';
import {
  VENDOR_RAIL_PATHS,
  VENDOR_SECTIONS,
  VENDOR_CONTRACTS_ID,
  VENDOR_VENDORS_ID,
  type VendorManagementRailItemId
} from '../vendorManagementSections';
import type { ContractsSearchParams, VendorsSearchParams } from '../../../routes/searchParams';
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
 * Section-dependent primary sidebar for the Vendor Management app: navigation between the app's
 * five rail sections, gated on the `vendor-management` capability configuration (mirrors
 * `../../strategy-model/sections/StrategySidebar.tsx`'s `!enabled` empty state). The Vendors and
 * Contracts sections replace this nav list with their own facet content (see
 * `VendorsSidebarContent`/`ContractsSidebarContent` above).
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
      <SidebarTitleHeader title="Vendor Management" />
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
