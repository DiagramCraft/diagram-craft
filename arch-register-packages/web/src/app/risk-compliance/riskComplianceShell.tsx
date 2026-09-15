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
import { RiskComplianceSidebar } from './sections/RiskComplianceSidebar';
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
      route: RISK_RAIL_PATHS[RISK_OVERVIEW_ID]
    },
    {
      id: RISK_RISKS_ID,
      icon: TbAlertTriangle,
      tooltip: 'Risks',
      route: RISK_RAIL_PATHS[RISK_RISKS_ID],
      primarySidebar: ctx => (
        <RiskComplianceSidebar workspaceSlug={ctx.workspaceSlug} activeSection={RISK_RISKS_ID} />
      )
    },
    {
      id: RISK_CONTROLS_ID,
      icon: TbShieldCheck,
      tooltip: 'Controls',
      route: RISK_RAIL_PATHS[RISK_CONTROLS_ID],
      primarySidebar: ctx => (
        <RiskComplianceSidebar workspaceSlug={ctx.workspaceSlug} activeSection={RISK_CONTROLS_ID} />
      )
    },
    {
      id: RISK_RETENTION_ID,
      icon: TbArchive,
      tooltip: 'Retention',
      route: RISK_RAIL_PATHS[RISK_RETENTION_ID],
      primarySidebar: ctx => (
        <RiskComplianceSidebar workspaceSlug={ctx.workspaceSlug} activeSection={RISK_RETENTION_ID} />
      )
    },
    {
      id: RISK_ASSESSMENTS_ID,
      icon: TbListCheck,
      tooltip: 'Assessments',
      route: RISK_RAIL_PATHS[RISK_ASSESSMENTS_ID],
      primarySidebar: ctx => (
        <RiskComplianceSidebar
          workspaceSlug={ctx.workspaceSlug}
          activeSection={RISK_ASSESSMENTS_ID}
        />
      )
    }
  ],
  enablement: { capabilityType: 'risk-compliance' }
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
