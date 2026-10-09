import {
  TbLayoutDashboard,
  TbAlertTriangle,
  TbShieldCheck,
  TbArchive,
  TbListCheck
} from 'react-icons/tb';
import { buildHomeBreadcrumbs } from '../../shell/breadcrumbBuilders';
import type { WorkspaceShellContext } from '../../layouts/workspaceShellDescriptors';
import type { AppDefinition, BreadcrumbItem } from '../../shell/shellTypes';
import { AppDashboardPrimarySidebar } from '../../sections/dashboard/AppDashboardPrimarySidebar';
import {
  RISK_OVERVIEW_ID,
  RISK_RISKS_ID,
  RISK_CONTROLS_ID,
  RISK_RETENTION_ID,
  RISK_ASSESSMENTS_ID,
  RISK_RAIL_PATHS,
  RISK_SECTION_LABELS,
  type RiskComplianceRailItemId
} from './riskComplianceSections';

/**
 * Risk & Compliance's workspace-rail identity: its rail-item ids (defined in
 * `./riskComplianceSections.ts`, alongside `riskComplianceAppDefinition` and its breadcrumb
 * builder). Registered into core via `../../shell/appShellRegistry.ts`, mirroring
 * `../vendor-management/vendorManagementShell.tsx`. The Overview section is `sections[0]`, so it
 * is where the app switcher lands (`appRootRoute`).
 */
export const riskComplianceAppDefinition: AppDefinition = {
  id: RISK_OVERVIEW_ID,
  applicationId: 'risk-compliance',
  name: 'Risk & Compliance',
  shortCode: 'RC',
  tint: 'oklch(0.6 0.16 25)',
  description: 'Risk register, control library, retention, and compliance assessments.',
  sections: [
    {
      // No `primarySidebar`: the Overview is a self-contained dashboard and the app's sections are
      // already switchable from the outer icon rail, so the shell renders it full-width (same as
      // `vendorManagementAppDefinition`'s Overview).
      id: RISK_OVERVIEW_ID,
      icon: TbLayoutDashboard,
      tooltip: 'Overview',
      route: RISK_RAIL_PATHS[RISK_OVERVIEW_ID],
      dashboard: { appKey: 'risk-compliance-overview' }
    },
    {
      id: RISK_RISKS_ID,
      icon: TbAlertTriangle,
      tooltip: 'Risks',
      route: RISK_RAIL_PATHS[RISK_RISKS_ID],
      // A self-contained dashboard (Register/Matrix tabs) with a `facets` sidebar for narrowing by
      // category, status and owner.
      dashboard: { appKey: 'risk-compliance-risks' },
      primarySidebar: ctx => (
        <AppDashboardPrimarySidebar
          workspaceSlug={ctx.workspaceSlug}
          appKey="risk-compliance-risks"
        />
      )
    },
    {
      id: RISK_CONTROLS_ID,
      icon: TbShieldCheck,
      tooltip: 'Controls',
      route: RISK_RAIL_PATHS[RISK_CONTROLS_ID],
      // A self-contained dashboard (Library, Coverage and Controls × Risks / Data Entities tabs) with a `facets` sidebar for
      // narrowing by control type and effectiveness.
      dashboard: { appKey: 'risk-compliance-controls' },
      primarySidebar: ctx => (
        <AppDashboardPrimarySidebar
          workspaceSlug={ctx.workspaceSlug}
          appKey="risk-compliance-controls"
        />
      )
    },
    {
      id: RISK_RETENTION_ID,
      icon: TbArchive,
      tooltip: 'Retention',
      route: RISK_RAIL_PATHS[RISK_RETENTION_ID],
      // A self-contained dashboard (one retention-assignments table widget) with an
      // `entity-picker` sidebar for narrowing to a single Retention Policy.
      dashboard: { appKey: 'risk-compliance-retention' },
      primarySidebar: ctx => (
        <AppDashboardPrimarySidebar
          workspaceSlug={ctx.workspaceSlug}
          appKey="risk-compliance-retention"
        />
      )
    },
    {
      // No `primarySidebar`: like Overview, Assessments is a self-contained dashboard, so the
      // shell renders it full-width.
      id: RISK_ASSESSMENTS_ID,
      dashboard: { appKey: 'risk-compliance-assessments' },
      icon: TbListCheck,
      tooltip: 'Assessments',
      route: RISK_RAIL_PATHS[RISK_ASSESSMENTS_ID]
    }
  ]
};

export const buildRiskComplianceBreadcrumbs = (
  ctx: WorkspaceShellContext,
  section: RiskComplianceRailItemId
): BreadcrumbItem[] => [
  // The app switcher already stands in for "Risk & Compliance"; each of its sections carries its
  // own crumb after the home crumbs — including the Overview landing section.
  ...buildHomeBreadcrumbs(ctx),
  {
    label: RISK_SECTION_LABELS[section],
    onClick: () =>
      ctx.navigate({
        to: RISK_RAIL_PATHS[section],
        params: { workspaceSlug: ctx.workspaceSlug }
      })
  }
];
