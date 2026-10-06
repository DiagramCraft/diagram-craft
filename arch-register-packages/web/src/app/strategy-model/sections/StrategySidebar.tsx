import { useMemo, type ReactNode } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  TbGridDots,
  TbLayoutDashboard,
  TbListDetails,
  TbRoute,
  TbTargetArrow,
  TbTemperature
} from 'react-icons/tb';
import {
  SidebarGroupLabel,
  SidebarTitleHeader
} from '../../../components/sidebar/SidebarPrimitives';
import { TreeRow } from '../../../components/TreeRow';
import { TypeBadge } from '../../../components/TypeBadge';
import { useSchemas } from '../../../hooks/useSchemas';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { resolveStrategyModelConfig } from '../strategyQueries';
import {
  STRATEGY_OVERVIEW_ID,
  STRATEGY_CAPABILITIES_ID,
  STRATEGY_CAPABILITY_MAP_ID,
  STRATEGY_HEATMAPS_ID,
  STRATEGY_STRATEGY_ID,
  STRATEGY_TRACEABILITY_ID,
  STRATEGY_RAIL_PATHS,
  STRATEGY_SECTIONS,
  STRATEGY_SECTION_LABELS,
  type StrategyRailItemId
} from '../strategySections';
import type { StrategySearchParams } from '../../../routes/searchParams';
import styles from '../../../shell/SidePanel.module.css';

// Rail-section icons, matching `strategyShell.tsx`'s `AppDefinition.sections` — so the "Sections"
// nav list carries the same glyphs as the outer icon rail.
const SECTION_ICONS: Record<StrategyRailItemId, typeof TbGridDots> = {
  [STRATEGY_OVERVIEW_ID]: TbLayoutDashboard,
  [STRATEGY_CAPABILITY_MAP_ID]: TbGridDots,
  [STRATEGY_CAPABILITIES_ID]: TbListDetails,
  [STRATEGY_HEATMAPS_ID]: TbTemperature,
  [STRATEGY_STRATEGY_ID]: TbTargetArrow,
  [STRATEGY_TRACEABILITY_ID]: TbRoute
};

/**
 * Returns a `(schemaId) => ReactNode` that renders the entity schema's configured icon glyph
 * (via `TypeBadge`, the same icon set the main app's entity sidebar uses) as a plain monochrome
 * icon — `color: currentColor` so it inherits the tree row's dim / active colour like the app's
 * other sidebar icons, rather than the schema's accent. Falls back to a box glyph for an unknown
 * or unmapped schema icon id (`TypeBadge`'s own default).
 */
const useSchemaBadge = (
  workspaceSlug: string
): ((schemaId: string | null | undefined) => ReactNode) => {
  const { data: schemas } = useSchemas(workspaceSlug);
  return useMemo(() => {
    const list = schemas ?? [];
    return (schemaId: string | null | undefined) => {
      if (!schemaId) return null;
      const schema = list.find(candidate => candidate.id === schemaId);
      if (!schema) return null;
      return (
        <TypeBadge
          color="currentColor"
          name={schema.name}
          icon={schema.icon}
          size={14}
          hideBorder
        />
      );
    };
  }, [schemas]);
};

/**
 * The Strategy section's own primary-sidebar content: the list of objectives that scopes the
 * screen. Clicking one sets the `objective` search param (the same selection the screen's header
 * reflects). A section-specific sidebar replacing the
 * plain "Sections" nav list. Initiatives are not listed: they relate to objectives many-to-many
 * and belong to the selected objective's Initiatives panel, not a flat top-level nav.
 */
const StrategySidebarContent = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as StrategySearchParams;
  const { data: configurations } = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const strategyConfig = resolveStrategyModelConfig(configurations);
  const objectiveIcon = useSchemaBadge(workspaceSlug)(strategyConfig?.objectiveSchemaId);

  const { data: objectivesData } = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: strategyConfig?.objectiveSchemaId ?? null, view: 'summary', limit: 1000 },
      strategyConfig?.objectiveSchemaId != null
    )
  );

  const objectives = objectivesData?.items ?? [];
  const selectedObjectiveId = search.objective ?? objectives[0]?._uid ?? null;

  return (
    <>
      <SidebarGroupLabel>Objectives</SidebarGroupLabel>
      {objectives.length === 0 ? (
        <div className={`${styles.emptyState} dim`}>No objectives yet.</div>
      ) : (
        objectives.map(objective => (
          <TreeRow
            key={objective._uid}
            label={objective._name}
            icon={objectiveIcon}
            testId={`strategy-objective-${objective._uid}`}
            active={objective._uid === selectedObjectiveId}
            onClick={() =>
              navigate({
                to: STRATEGY_RAIL_PATHS[STRATEGY_STRATEGY_ID],
                params: { workspaceSlug },
                search: (previous: Record<string, unknown>) => ({
                  ...previous,
                  objective: objective._uid
                })
              })
            }
          />
        ))
      )}
    </>
  );
};

/**
 * Section-dependent primary sidebar for the Strategy & Capability Modelling app: navigation
 * between the app's five rail sections, gated on the `strategy-model` capability configuration
 * (mirrors `../../business-glossary/sections/GlossarySidebar.tsx`'s `!enabled` empty state). The
 * Capabilities section replaces this nav list with its own tree+facet content (see
 * `CapabilitiesSidebarContent` above).
 */
export const StrategySidebar = ({
  workspaceSlug,
  activeSection
}: {
  workspaceSlug: string;
  activeSection: StrategyRailItemId;
}) => {
  const navigate = useNavigate();
  const { data: configurations } = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const enabled = resolveStrategyModelConfig(configurations) !== null;

  return (
    <>
      <SidebarTitleHeader title={STRATEGY_SECTION_LABELS[activeSection]} />
      <div className={styles.scroll}>
        {!enabled ? (
          <div className={`${styles.emptyState} dim`}>Strategy model is not enabled.</div>
        ) : activeSection === STRATEGY_STRATEGY_ID ? (
          <StrategySidebarContent workspaceSlug={workspaceSlug} />
        ) : (
          <>
            <SidebarGroupLabel>Sections</SidebarGroupLabel>
            {STRATEGY_SECTIONS.map(section => {
              const SectionIcon = SECTION_ICONS[section.id];
              return (
                <TreeRow
                  key={section.id}
                  label={section.label}
                  icon={<SectionIcon size={14} />}
                  testId={`strategy-nav-${section.id}`}
                  active={section.id === activeSection}
                  onClick={() =>
                    navigate({
                      to: STRATEGY_RAIL_PATHS[section.id],
                      params: { workspaceSlug }
                    })
                  }
                />
              );
            })}
          </>
        )}
      </div>
    </>
  );
};
