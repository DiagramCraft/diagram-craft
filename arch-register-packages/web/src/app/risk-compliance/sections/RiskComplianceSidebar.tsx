import { useMemo, type ReactNode } from 'react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  TbAlertTriangle,
  TbArchive,
  TbBook,
  TbCheckbox,
  TbShieldCheck,
  TbTag,
  TbUsers
} from 'react-icons/tb';
import {
  SidebarGroupLabel,
  SidebarTitleHeader
} from '../../../components/sidebar/SidebarPrimitives';
import { TreeRow } from '../../../components/TreeRow';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { useSchemas } from '../../../hooks/useSchemas';
import {
  resolveRiskComplianceConfig,
  resolveRetentionConfig,
  resolveRetentionFieldIds,
  type RiskComplianceConfig,
  type RetentionConfig
} from '../riskComplianceQueries';
import { RESIDUAL_RISK_BAND_COLOR, residualRiskBand } from '../residualRiskBand';
import { useControlFrameworks } from '../useControlFrameworks';
import { useRetentionAssignments } from '../useRetentionAssignments';
import {
  RISK_RAIL_PATHS,
  RISK_RISKS_ID,
  RISK_CONTROLS_ID,
  RISK_RETENTION_ID,
  RISK_SECTIONS,
  type RiskComplianceRailItemId
} from '../riskComplianceSections';
import type {
  ControlsSearchParams,
  RetentionSearchParams,
  RisksSearchParams
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
 * The Controls section's own primary-sidebar content: Type / Effectiveness / Framework facets
 * over the control library, mirroring `RisksSidebarContent` above (same "closest existing field"
 * approach — `control_type` stands in for the design's "family" as well as "type", see
 * `RiskComplianceControlsScreen.tsx`'s field-mapping comment). Framework counts come from
 * `useControlFrameworks.ts`'s two-hop join rather than a schema field.
 *
 * Unlike `RisksSidebarContent`, this doesn't also list every Control individually — the library
 * table is the place to browse controls one by one; the sidebar stays a pure facet/count panel.
 */
const ControlsSidebarContent = ({
  workspaceSlug,
  riskConfig
}: {
  workspaceSlug: string;
  riskConfig: RiskComplianceConfig;
}) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as ControlsSearchParams;
  const { data: schemas } = useSchemas(workspaceSlug);
  const controlSchema = schemas?.find(schema => schema.id === riskConfig.controlSchemaId);

  const { data: controlsData } = useQuery(
    entitiesQuery(workspaceSlug, {
      schemaId: riskConfig.controlSchemaId ?? undefined,
      view: 'full',
      limit: 500
    })
  );
  const controls = controlsData?.items ?? [];

  const satisfiedRequirementsField = controlSchema?.fields.find(
    field => field.id === 'satisfied_requirements'
  );
  const controlRequirementRelationSchemaId =
    satisfiedRequirementsField?.type === 'typedRelation'
      ? satisfiedRequirementsField.relationSchemaId
      : null;

  const frameworks = useControlFrameworks(
    workspaceSlug,
    controlRequirementRelationSchemaId,
    riskConfig.complianceRequirementSchemaId
  );

  const fieldOptions = (fieldId: string) => {
    const field = controlSchema?.fields.find(candidate => candidate.id === fieldId);
    return field && field.type === 'select' ? (field.options ?? []) : [];
  };

  const countByValue = useMemo(() => {
    const build = (fieldId: string) => {
      const counts = new Map<string, number>();
      for (const control of controls) {
        const value = control[fieldId];
        if (typeof value === 'string' && value) counts.set(value, (counts.get(value) ?? 0) + 1);
      }
      return counts;
    };
    return {
      control_type: build('control_type'),
      operating_effectiveness: build('operating_effectiveness')
    };
  }, [controls]);

  const patchSearch = (patch: Partial<ControlsSearchParams>) =>
    navigate({
      to: RISK_RAIL_PATHS[RISK_CONTROLS_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  const hasAnySelection = !!search.type || !!search.effectiveness || !!search.framework;
  const clearAll = () =>
    patchSearch({ type: undefined, effectiveness: undefined, framework: undefined });

  return (
    <>
      <TreeRow
        icon={<TbShieldCheck size={12} />}
        label="All controls"
        testId="control-facet-all"
        active={!hasAnySelection}
        onClick={clearAll}
        trailing={<span className="dim mono">{controls.length}</span>}
      />
      <SidebarGroupLabel>Type</SidebarGroupLabel>
      {fieldOptions('control_type').map(option => (
        <FacetRow
          key={option.value}
          icon={<TbTag size={12} />}
          label={option.label}
          testId={`control-facet-type-${option.value}`}
          active={search.type === option.value}
          onClick={() =>
            patchSearch({ type: search.type === option.value ? undefined : option.value })
          }
          trailing={
            <span className="dim mono">{countByValue.control_type.get(option.value) ?? 0}</span>
          }
        />
      ))}
      <SidebarGroupLabel>Effectiveness</SidebarGroupLabel>
      {fieldOptions('operating_effectiveness').map(option => (
        <FacetRow
          key={option.value}
          icon={<TbCheckbox size={12} />}
          label={option.label}
          testId={`control-facet-effectiveness-${option.value}`}
          active={search.effectiveness === option.value}
          onClick={() =>
            patchSearch({
              effectiveness: search.effectiveness === option.value ? undefined : option.value
            })
          }
          trailing={
            <span className="dim mono">
              {countByValue.operating_effectiveness.get(option.value) ?? 0}
            </span>
          }
        />
      ))}
      <SidebarGroupLabel>Framework</SidebarGroupLabel>
      {frameworks.frameworkOptions.length === 0 && (
        <div className={`${styles.emptyState} dim`}>No frameworks linked.</div>
      )}
      {frameworks.frameworkOptions.map(option => (
        <FacetRow
          key={option.id}
          icon={<TbBook size={12} />}
          label={option.name}
          testId={`control-facet-framework-${option.id}`}
          active={search.framework === option.name}
          onClick={() =>
            patchSearch({ framework: search.framework === option.name ? undefined : option.name })
          }
          trailing={<span className="dim mono">{option.controlCount}</span>}
        />
      ))}
    </>
  );
};

/**
 * The Retention section's own primary-sidebar content — the section's only navigation, since the
 * screen itself is a single Assignments register with no view toggle (see
 * `RiskComplianceRetentionScreen.tsx`'s doc comment for why the earlier expiry-dashboard/
 * Policies-library/Assignments-list split was removed): "All" (clears both facets), an
 * "Incomplete" data-quality toggle (assignments missing a policy, duration, time unit, or
 * activation date — not a disposal-urgency facet), and a "Policies" group listing every policy
 * with its assignment count, each narrowing the register to that policy. Gated independently on
 * the `retention` capability (`resolveRetentionConfig`), not `risk-compliance` — see
 * `riskComplianceQueries.ts`'s doc comment on `resolveRetentionConfig`: Retention is enabled
 * independently of the rest of the Risk & Compliance app.
 */
const RetentionSidebarContent = ({
  workspaceSlug,
  retentionConfig
}: {
  workspaceSlug: string;
  retentionConfig: RetentionConfig;
}) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as RetentionSearchParams;
  const { data: configurations } = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const fieldIds = resolveRetentionFieldIds(configurations);
  const { rows, policyRows } = useRetentionAssignments(workspaceSlug, retentionConfig, fieldIds);

  const incompleteCount = useMemo(() => rows.filter(row => row.missing.length > 0).length, [rows]);

  const patchSearch = (patch: Partial<RetentionSearchParams>) =>
    navigate({
      to: RISK_RAIL_PATHS[RISK_RETENTION_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  const hasAnySelection = !!search.policy || !!search.incomplete;

  return (
    <>
      <TreeRow
        icon={<TbArchive size={12} />}
        label="All"
        testId="retention-facet-all"
        active={!hasAnySelection}
        onClick={() => patchSearch({ policy: undefined, incomplete: undefined })}
        trailing={<span className="dim mono">{rows.length}</span>}
      />
      <FacetRow
        icon={<TbAlertTriangle size={12} />}
        label="Incomplete"
        testId="retention-facet-incomplete"
        active={!!search.incomplete}
        onClick={() =>
          patchSearch({
            incomplete: search.incomplete ? undefined : '1',
            policy: undefined
          })
        }
        trailing={<span className="dim mono">{incompleteCount}</span>}
      />
      <SidebarGroupLabel>Policies</SidebarGroupLabel>
      {policyRows.length === 0 && (
        <div className={`${styles.emptyState} dim`}>No retention policies yet.</div>
      )}
      {policyRows.map(policy => (
        <FacetRow
          key={policy._uid}
          icon={<TbTag size={12} />}
          label={policy._name}
          testId={`retention-facet-policy-${policy._uid}`}
          active={search.policy === policy._uid}
          onClick={() =>
            patchSearch({
              policy: search.policy === policy._uid ? undefined : policy._uid,
              incomplete: undefined
            })
          }
          trailing={<span className="dim mono">{policy.governedCount}</span>}
        />
      ))}
    </>
  );
};

/**
 * Section-dependent primary sidebar for the Risk & Compliance app: navigation between the app's
 * five rail sections, gated on the `risk-compliance` capability configuration — mirrors
 * `../../vendor-management/sections/VendorManagementSidebar.tsx`. The Risks and Controls sections
 * replace this nav list with their own facet content (`RisksSidebarContent`,
 * `ControlsSidebarContent`); Retention replaces it with `RetentionSidebarContent`, gated on the
 * separate `retention` capability rather than the `enabled` (risk-compliance) check below;
 * Assessments still falls through to the plain nav list until its own sub-issue of #3151 lands.
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
  const retentionConfig = resolveRetentionConfig(configurations);
  const enabled = riskConfig !== null;

  if (activeSection === RISK_RETENTION_ID) {
    return (
      <>
        <SidebarTitleHeader title="Risk & Compliance" />
        <div className={styles.scroll}>
          {!retentionConfig ? (
            <div className={`${styles.emptyState} dim`}>Retention is not configured.</div>
          ) : (
            <RetentionSidebarContent
              workspaceSlug={workspaceSlug}
              retentionConfig={retentionConfig}
            />
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <SidebarTitleHeader title="Risk & Compliance" />
      <div className={styles.scroll}>
        {!enabled ? (
          <div className={`${styles.emptyState} dim`}>Risk & Compliance is not enabled.</div>
        ) : activeSection === RISK_RISKS_ID ? (
          <RisksSidebarContent workspaceSlug={workspaceSlug} riskConfig={riskConfig} />
        ) : activeSection === RISK_CONTROLS_ID ? (
          <ControlsSidebarContent workspaceSlug={workspaceSlug} riskConfig={riskConfig} />
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
