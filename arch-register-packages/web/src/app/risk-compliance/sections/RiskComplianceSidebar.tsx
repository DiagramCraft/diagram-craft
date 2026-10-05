import { useMemo, type ReactNode } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { TbBook, TbCheckbox, TbShieldCheck, TbTag } from 'react-icons/tb';
import {
  SidebarGroupLabel,
  SidebarTitleHeader
} from '../../../components/sidebar/SidebarPrimitives';
import { TreeRow } from '../../../components/TreeRow';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { useSchemas } from '../../../hooks/useSchemas';
import { resolveRiskComplianceConfig, type RiskComplianceConfig } from '../riskComplianceQueries';
import { useControlFrameworks } from '../useControlFrameworks';
import {
  RISK_RAIL_PATHS,
  RISK_CONTROLS_ID,
  RISK_SECTIONS,
  RISK_SECTION_LABELS,
  type RiskComplianceRailItemId
} from '../riskComplianceSections';
import type { ControlsSearchParams } from '../../../routes/searchParams';
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
 * The Controls section's own primary-sidebar content: Type / Effectiveness / Framework facets
 * over the control library, modelled on the Vendors facet sidebar (same "closest existing field"
 * approach — `control_type` stands in for the design's "family" as well as "type", see
 * `RiskComplianceControlsScreen.tsx`'s field-mapping comment). Framework counts come from
 * `useControlFrameworks.ts`'s two-hop join rather than a schema field.
 *
 * This doesn't list every Control individually — the library
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
 * Section-dependent primary sidebar for the Risk & Compliance app: navigation between the app's
 * five rail sections, gated on the `risk-compliance` capability configuration — mirrors
 * `../../vendor-management/sections/VendorManagementSidebar.tsx`. The Controls section
 * replaces this nav list with its own facet content (`ControlsSidebarContent`); Risks and
 * Retention are dashboards with their own `AppDashboardPrimarySidebar`, so they never reach this
 * component;
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
  const enabled = riskConfig !== null;

  return (
    <>
      <SidebarTitleHeader title={RISK_SECTION_LABELS[activeSection]} />
      <div className={styles.scroll}>
        {!enabled ? (
          <div className={`${styles.emptyState} dim`}>Risk & Compliance is not enabled.</div>
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
