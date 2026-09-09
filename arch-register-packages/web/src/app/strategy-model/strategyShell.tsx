import { TbGridDots, TbListDetails, TbTemperature, TbTargetArrow, TbRoute } from 'react-icons/tb';
import { buildHomeBreadcrumbs } from '../../shell/breadcrumbBuilders';
import type { WorkspaceShellContext } from '../../layouts/workspaceShellDescriptors';
import type { AppDefinition, BreadcrumbItem } from '../../shell/shellTypes';
import { StrategySidebar } from './sections/StrategySidebar';
import {
  STRATEGY_CAPABILITY_MAP_ID,
  STRATEGY_CAPABILITIES_ID,
  STRATEGY_HEATMAPS_ID,
  STRATEGY_STRATEGY_ID,
  STRATEGY_TRACEABILITY_ID,
  STRATEGY_RAIL_PATHS,
  STRATEGY_SECTION_LABELS,
  type StrategyRailItemId
} from './strategySections';

/**
 * Strategy & Capability Modelling's workspace-rail identity: its five rail-item ids (defined in
 * `./strategySections.ts`, alongside `strategyAppDefinition` and its breadcrumb builder).
 * Registered into core via `../../shell/appShellRegistry.ts`, mirroring
 * `../business-glossary/glossaryShell.tsx`.
 */
export const strategyAppDefinition: AppDefinition = {
  id: STRATEGY_CAPABILITY_MAP_ID,
  applicationId: 'strategy-model',
  name: 'Strategy & Capability Modelling',
  shortCode: 'SC',
  tint: 'oklch(0.64 0.13 200)',
  description: 'Capability maps, heatmaps, strategy roll-ups, and traceability.',
  sections: [
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
      id: STRATEGY_HEATMAPS_ID,
      icon: TbTemperature,
      tooltip: 'Heatmaps',
      route: STRATEGY_RAIL_PATHS[STRATEGY_HEATMAPS_ID],
      primarySidebar: ctx => (
        <StrategySidebar workspaceSlug={ctx.workspaceSlug} activeSection={STRATEGY_HEATMAPS_ID} />
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
  // The app switcher already stands in for "Strategy & Capability Modelling"; each of its five
  // sections carries its own crumb since (unlike Business Glossary) there is no single landing
  // page for the app.
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
