import { TbLayoutDashboard, TbApi, TbPlugConnected, TbRefresh, TbAffiliate } from 'react-icons/tb';
import { buildHomeBreadcrumbs } from '../../shell/breadcrumbBuilders';
import type { WorkspaceShellContext } from '../../layouts/workspaceShellDescriptors';
import type { AppDefinition, BreadcrumbItem } from '../../shell/shellTypes';
import { ApiIntegrationCatalogSidebar } from './sections/ApiIntegrationCatalogSidebar';
import {
  IC_OVERVIEW_ID,
  IC_APIS_ID,
  IC_INTEGRATIONS_ID,
  IC_SYNC_ID,
  IC_IMPACT_ID,
  IC_RAIL_PATHS,
  IC_SECTION_LABELS,
  type ApiIntegrationCatalogRailItemId
} from './apiIntegrationCatalogSections';

/**
 * API & Integration Catalog's workspace-rail identity: its rail-item ids (defined in
 * `./apiIntegrationCatalogSections.ts`, alongside `apiIntegrationCatalogAppDefinition` and its
 * breadcrumb builder). Registered into core via `../../shell/appShellRegistry.ts`, mirroring
 * `../risk-compliance/riskComplianceShell.tsx`. The Overview section is `sections[0]`, so it is
 * where the app switcher lands (`appRootRoute`).
 *
 * Promotes the existing `api-specification` capability (#2826) — previously configurable only as a
 * capability-only binding — to this app's enablement gate; see
 * `../../sections/workspace-settings/applicationsCapabilities.ts`.
 */
export const apiIntegrationCatalogAppDefinition: AppDefinition = {
  id: IC_OVERVIEW_ID,
  applicationId: 'api-integration-catalog',
  name: 'API & Integration Catalog',
  shortCode: 'IC',
  tint: 'oklch(0.6 0.15 250)',
  description: 'API specifications, operations, integration relations, and sync status.',
  sections: [
    {
      // No `primarySidebar`: the Overview is a self-contained dashboard and the app's sections are
      // already switchable from the outer icon rail, so the shell renders it full-width (same as
      // `riskComplianceAppDefinition`'s Overview).
      id: IC_OVERVIEW_ID,
      icon: TbLayoutDashboard,
      tooltip: 'Overview',
      route: IC_RAIL_PATHS[IC_OVERVIEW_ID]
    },
    {
      id: IC_APIS_ID,
      icon: TbApi,
      tooltip: 'APIs',
      route: IC_RAIL_PATHS[IC_APIS_ID],
      primarySidebar: ctx => (
        <ApiIntegrationCatalogSidebar workspaceSlug={ctx.workspaceSlug} activeSection={IC_APIS_ID} />
      )
    },
    {
      id: IC_INTEGRATIONS_ID,
      icon: TbPlugConnected,
      tooltip: 'Integrations',
      route: IC_RAIL_PATHS[IC_INTEGRATIONS_ID],
      primarySidebar: ctx => (
        <ApiIntegrationCatalogSidebar
          workspaceSlug={ctx.workspaceSlug}
          activeSection={IC_INTEGRATIONS_ID}
        />
      )
    },
    {
      id: IC_SYNC_ID,
      icon: TbRefresh,
      tooltip: 'Sync',
      route: IC_RAIL_PATHS[IC_SYNC_ID],
      primarySidebar: ctx => (
        <ApiIntegrationCatalogSidebar workspaceSlug={ctx.workspaceSlug} activeSection={IC_SYNC_ID} />
      )
    },
    {
      id: IC_IMPACT_ID,
      icon: TbAffiliate,
      tooltip: 'Impact',
      route: IC_RAIL_PATHS[IC_IMPACT_ID],
      primarySidebar: ctx => (
        <ApiIntegrationCatalogSidebar
          workspaceSlug={ctx.workspaceSlug}
          activeSection={IC_IMPACT_ID}
        />
      )
    }
  ],
  enablement: { capabilityType: 'api-specification' }
};

export const buildApiIntegrationCatalogBreadcrumbs = (
  ctx: WorkspaceShellContext,
  section: ApiIntegrationCatalogRailItemId
): BreadcrumbItem[] => [
  // The app switcher already stands in for "API & Integration Catalog"; each of its sections
  // carries its own crumb after the home crumbs — including the Overview landing section.
  ...buildHomeBreadcrumbs(ctx),
  {
    label: IC_SECTION_LABELS[section],
    onClick: () =>
      ctx.navigate({
        to: IC_RAIL_PATHS[section],
        params: { workspaceSlug: ctx.workspaceSlug }
      })
  }
];
