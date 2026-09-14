import { useMemo, type ReactNode } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { TbBuildingStore, TbTag, TbUsers } from 'react-icons/tb';
import {
  SidebarGroupLabel,
  SidebarTitleHeader
} from '../../../components/sidebar/SidebarPrimitives';
import { TreeRow } from '../../../components/TreeRow';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { useSchemas } from '../../../hooks/useSchemas';
import { resolveVendorManagementConfig } from '../vendorManagementQueries';
import {
  VENDOR_RAIL_PATHS,
  VENDOR_SECTIONS,
  VENDOR_VENDORS_ID,
  type VendorManagementRailItemId
} from '../vendorManagementSections';
import type { VendorsSearchParams } from '../../../routes/searchParams';
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
 * Section-dependent primary sidebar for the Vendor Management app: navigation between the app's
 * five rail sections, gated on the `vendor-management` capability configuration (mirrors
 * `../../strategy-model/sections/StrategySidebar.tsx`'s `!enabled` empty state). The Vendors
 * section replaces this nav list with its own facet content (see `VendorsSidebarContent` above).
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
