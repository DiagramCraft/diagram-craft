import {
  TbLayoutDashboard,
  TbGridDots,
  TbListDetails,
  TbTargetArrow,
  TbRoute
} from 'react-icons/tb';
import { buildHomeBreadcrumbs } from '../../shell/breadcrumbBuilders';
import type { WorkspaceShellContext } from '../../layouts/workspaceShellDescriptors';
import type { AppDefinition, BreadcrumbItem } from '../../shell/shellTypes';
import { StrategySidebar } from './sections/StrategySidebar';
import {
  STRATEGY_OVERVIEW_ID,
  STRATEGY_CAPABILITY_MAP_ID,
  STRATEGY_CAPABILITIES_ID,
  STRATEGY_STRATEGY_ID,
  STRATEGY_TRACEABILITY_ID,
  STRATEGY_RAIL_PATHS,
  STRATEGY_SECTION_LABELS,
  type StrategyRailItemId
} from './strategySections';

/**
 * Strategy & Capability Modelling's workspace-rail identity: its rail-item ids (defined in
 * `./strategySections.ts`, alongside `strategyAppDefinition` and its breadcrumb builder).
 * The Heatmaps section (#3193) is deprioritized — its id, route, and screen are retained but
 * it is not surfaced in the rail or the section nav list.
 * Registered into core via `../../shell/appShellRegistry.ts`, mirroring
 * `../business-glossary/glossaryShell.tsx`. The Overview section is `sections[0]`, so it is where
 * the app switcher lands (`appRootRoute`).
 */
export const strategyAppDefinition: AppDefinition = {
  id: STRATEGY_CAPABILITY_MAP_ID,
  applicationId: 'strategy-model',
  name: 'Strategy & Capability Modelling',
  shortCode: 'SC',
  tint: 'oklch(0.64 0.13 200)',
  description: 'Capability maps, strategy roll-ups, and traceability.',
  sections: [
    {
      // No `primarySidebar`: the Overview is a self-contained dashboard and the app's sections are
      // already switchable from the outer icon rail, so the shell renders it full-width (same as
      // the Traceability section below).
      id: STRATEGY_OVERVIEW_ID,
      icon: TbLayoutDashboard,
      tooltip: 'Overview',
      route: STRATEGY_RAIL_PATHS[STRATEGY_OVERVIEW_ID]
    },
    {
      id: STRATEGY_CAPABILITY_MAP_ID,
      icon: TbGridDots,
      tooltip: 'Capability map',
      route: STRATEGY_RAIL_PATHS[STRATEGY_CAPABILITY_MAP_ID],
      primarySidebar: ctx => (
        <StrategySidebar
          workspaceSlug={ctx.workspaceSlug}
          activeSection={STRATEGY_CAPABILITY_MAP_ID}
        />
      )
    },
    {
      id: STRATEGY_CAPABILITIES_ID,
      icon: TbListDetails,
      tooltip: 'Capabilities',
      route: STRATEGY_RAIL_PATHS[STRATEGY_CAPABILITIES_ID],
      primarySidebar: ctx => (
        <StrategySidebar
          workspaceSlug={ctx.workspaceSlug}
          activeSection={STRATEGY_CAPABILITIES_ID}
        />
      )
    },
    {
      id: STRATEGY_STRATEGY_ID,
      icon: TbTargetArrow,
      tooltip: 'Strategy',
      route: STRATEGY_RAIL_PATHS[STRATEGY_STRATEGY_ID],
      primarySidebar: ctx => (
        <StrategySidebar workspaceSlug={ctx.workspaceSlug} activeSection={STRATEGY_STRATEGY_ID} />
      )
    },
    {
      // No `primarySidebar`: the Traceability screen is self-contained (objective/capability
      // selection lives in its own columns), so the shell renders it full-width.
      id: STRATEGY_TRACEABILITY_ID,
      icon: TbRoute,
      tooltip: 'Traceability',
      route: STRATEGY_RAIL_PATHS[STRATEGY_TRACEABILITY_ID]
    }
  ],
  enablement: { capabilityType: 'strategy-model' }
};

export const buildStrategyBreadcrumbs = (
  ctx: WorkspaceShellContext,
  section: StrategyRailItemId
): BreadcrumbItem[] => [
  // The app switcher already stands in for "Strategy & Capability Modelling"; each of its
  // sections carries its own crumb after the home crumbs — including the Overview landing section.
  ...buildHomeBreadcrumbs(ctx),
  {
    label: STRATEGY_SECTION_LABELS[section],
    onClick: () =>
      ctx.navigate({
        to: STRATEGY_RAIL_PATHS[section],
        params: { workspaceSlug: ctx.workspaceSlug }
      })
  }
];
