import { useMemo, type ReactNode } from 'react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { TbAlertTriangle, TbShieldCheck, TbTag, TbUsers } from 'react-icons/tb';
import {
  SidebarGroupLabel,
  SidebarTitleHeader
} from '../../../components/sidebar/SidebarPrimitives';
import { TreeRow } from '../../../components/TreeRow';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { useSchemas } from '../../../hooks/useSchemas';
import { resolveRiskComplianceConfig, type RiskComplianceConfig } from '../riskComplianceQueries';
import { RESIDUAL_RISK_BAND_COLOR, residualRiskBand } from '../residualRiskBand';
import {
  RISK_RAIL_PATHS,
  RISK_RISKS_ID,
  RISK_SECTIONS,
  type RiskComplianceRailItemId
} from '../riskComplianceSections';
import type { RisksSearchParams } from '../../../routes/searchParams';
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
 * The Risks section's own primary-sidebar content: Category / Status / Owner facets plus an
 * "outside appetite" toggle over the risk register, replacing the plain "Sections" nav list for
 * this section only — mirrors `../../vendor-management/sections/VendorManagementSidebar.tsx`'s
 * `VendorsSidebarContent`.
 *
 * Category and Status are fixed `select` fields, so their facet options come straight off the
 * Risk schema's own field definitions; Owner (`risk_owner`) is free text, so its facet is the
 * distinct values actually present among fetched risks — same "derive facets from the fetched
 * page" approach `VendorsSidebarContent` uses. There is no schema "risk appetite" field, so
 * "outside appetite" is a derived toggle: risks whose `residual_risk_score` bands as high/critical
 * (`../residualRiskBand.ts`), not a stored attribute.
 *
 * Also lists every risk individually under a trailing "Risks" group, each opening the shared
 * `RiskDrawer` directly — a quick-jump list mirroring the design reference's `RCSidebar` (`rc.jsx`,
 * the overview/risks branch), which renders the full unfiltered register below the facets.
 */
const RisksSidebarContent = ({
  workspaceSlug,
  riskConfig
}: {
  workspaceSlug: string;
  riskConfig: RiskComplianceConfig;
}) => {
  const navigate = useNavigate();
  const { riskId } = useParams({ strict: false }) as { riskId?: string };
  const search = useSearch({ strict: false }) as RisksSearchParams;
  const { data: schemas } = useSchemas(workspaceSlug);
  const riskSchema = schemas?.find(schema => schema.id === riskConfig.riskSchemaId);

  const { data: risksData } = useQuery(
    entitiesQuery(workspaceSlug, { schemaId: riskConfig.riskSchemaId, view: 'full', limit: 500 })
  );
  const risks = risksData?.items ?? [];

  const fieldOptions = (fieldId: string) => {
    const field = riskSchema?.fields.find(candidate => candidate.id === fieldId);
    return field && field.type === 'select' ? (field.options ?? []) : [];
  };

  const countByValue = useMemo(() => {
    const build = (fieldId: string) => {
      const counts = new Map<string, number>();
      for (const risk of risks) {
        const value = risk[fieldId];
        if (typeof value === 'string' && value) counts.set(value, (counts.get(value) ?? 0) + 1);
      }
      return counts;
    };
    return { category: build('category'), status: build('status') };
  }, [risks]);
  const categoryCounts = countByValue.category;
  const statusCounts = countByValue.status;
  const ownerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const risk of risks) {
      const owner = risk.risk_owner;
      if (typeof owner === 'string' && owner) counts.set(owner, (counts.get(owner) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [risks]);
  const outsideAppetiteCount = useMemo(
    () =>
      risks.filter(risk => {
        const band = residualRiskBand(
          typeof risk.residual_risk_score === 'number' ? risk.residual_risk_score : null
        );
        return band === 'high' || band === 'critical';
      }).length,
    [risks]
  );

  const patchSearch = (patch: Partial<RisksSearchParams>) =>
    navigate({
      to: RISK_RAIL_PATHS[RISK_RISKS_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });
  const openRisk = (id: string) =>
    navigate({
      to: `${RISK_RAIL_PATHS[RISK_RISKS_ID]}/$riskId`,
      params: { workspaceSlug, riskId: id },
      search: (previous: Record<string, unknown>) => previous
    });

  const hasAnySelection =
    !!search.category || !!search.status || !!search.owner || !!search.outsideAppetite;
  const clearAll = () =>
    patchSearch({
      category: undefined,
      status: undefined,
      owner: undefined,
      outsideAppetite: undefined
    });

  return (
    <>
      <TreeRow
        icon={<TbShieldCheck size={12} />}
        label="All risks"
        testId="risk-facet-all"
        active={!hasAnySelection}
        onClick={clearAll}
        trailing={<span className="dim mono">{risks.length}</span>}
      />
      <FacetRow
        icon={<TbAlertTriangle size={12} />}
        label="Outside appetite"
        testId="risk-facet-outside-appetite"
        active={!!search.outsideAppetite}
        onClick={() => patchSearch({ outsideAppetite: search.outsideAppetite ? undefined : '1' })}
        trailing={<span className="dim mono">{outsideAppetiteCount}</span>}
      />
      <SidebarGroupLabel>Category</SidebarGroupLabel>
      {fieldOptions('category').map(option => (
        <FacetRow
          key={option.value}
          icon={<TbTag size={12} />}
          label={option.label}
          testId={`risk-facet-category-${option.value}`}
          active={search.category === option.value}
          onClick={() =>
            patchSearch({ category: search.category === option.value ? undefined : option.value })
          }
          trailing={<span className="dim mono">{categoryCounts.get(option.value) ?? 0}</span>}
        />
      ))}
      <SidebarGroupLabel>Status</SidebarGroupLabel>
      {fieldOptions('status').map(option => (
        <FacetRow
          key={option.value}
          icon={<TbTag size={12} />}
          label={option.label}
          testId={`risk-facet-status-${option.value}`}
          active={search.status === option.value}
          onClick={() =>
            patchSearch({ status: search.status === option.value ? undefined : option.value })
          }
          trailing={<span className="dim mono">{statusCounts.get(option.value) ?? 0}</span>}
        />
      ))}
      <SidebarGroupLabel>Owner</SidebarGroupLabel>
      {ownerCounts.length === 0 && (
        <div className={`${styles.emptyState} dim`}>No risk owners assigned.</div>
      )}
      {ownerCounts.map(([owner, count]) => (
        <FacetRow
          key={owner}
          icon={<TbUsers size={12} />}
          label={owner}
          testId={`risk-facet-owner-${owner}`}
          active={search.owner === owner}
          onClick={() => patchSearch({ owner: search.owner === owner ? undefined : owner })}
          trailing={<span className="dim mono">{count}</span>}
        />
      ))}
      <SidebarGroupLabel>Risks</SidebarGroupLabel>
      {risks.map(risk => {
        const band = residualRiskBand(
          typeof risk.residual_risk_score === 'number' ? risk.residual_risk_score : null
        );
        return (
          <FacetRow
            key={risk._uid}
            icon={
              <span
                className="dim"
                style={{ color: band ? RESIDUAL_RISK_BAND_COLOR[band] : 'var(--panel-border)' }}
              >
                ●
              </span>
            }
            label={`${risk._publicId} ${risk._name}`}
            testId={`risk-facet-risk-${risk._uid}`}
            active={riskId === risk._publicId}
            onClick={() => openRisk(risk._publicId)}
          />
        );
      })}
    </>
  );
};

/**
 * Section-dependent primary sidebar for the Risk & Compliance app: navigation between the app's
 * five rail sections, gated on the `risk-compliance` capability configuration — mirrors
 * `../../vendor-management/sections/VendorManagementSidebar.tsx`. The Risks section replaces this
 * nav list with its own facet content (`RisksSidebarContent`); the remaining sections still fall
 * through to the plain nav list until their own sub-issues of #3151 land.
 */
export const RiskComplianceSidebar = ({
  workspaceSlug,
  activeSection
}: {
  workspaceSlug: string;
  activeSection: RiskComplianceRailItemId;
}) => {
  const navigate = useNavigate();
  const { data: configurations } = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const riskConfig = resolveRiskComplianceConfig(configurations);
  const enabled = riskConfig !== null;

  return (
    <>
      <SidebarTitleHeader title="Risk & Compliance" />
      <div className={styles.scroll}>
        {!enabled ? (
          <div className={`${styles.emptyState} dim`}>Risk & Compliance is not enabled.</div>
        ) : activeSection === RISK_RISKS_ID ? (
          <RisksSidebarContent workspaceSlug={workspaceSlug} riskConfig={riskConfig} />
        ) : (
          <>
            <SidebarGroupLabel>Sections</SidebarGroupLabel>
            {RISK_SECTIONS.map(section => (
              <TreeRow
                key={section.id}
                label={section.label}
                testId={`risk-compliance-nav-${section.id}`}
                active={section.id === activeSection}
                onClick={() =>
                  navigate({
                    to: RISK_RAIL_PATHS[section.id],
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
