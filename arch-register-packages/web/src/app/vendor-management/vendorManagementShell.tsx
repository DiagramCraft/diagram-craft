import {
  TbLayoutDashboard,
  TbBuilding,
  TbFileCertificate,
  TbCoin,
  TbAlertTriangle
} from 'react-icons/tb';
import { buildHomeBreadcrumbs } from '../../shell/breadcrumbBuilders';
import type { WorkspaceShellContext } from '../../layouts/workspaceShellDescriptors';
import type { AppDefinition, BreadcrumbItem } from '../../shell/shellTypes';
import { VendorManagementSidebar } from './sections/VendorManagementSidebar';
import {
  VENDOR_OVERVIEW_ID,
  VENDOR_VENDORS_ID,
  VENDOR_CONTRACTS_ID,
  VENDOR_SPEND_ID,
  VENDOR_RISK_ID,
  VENDOR_RAIL_PATHS,
  VENDOR_SECTION_LABELS,
  type VendorManagementRailItemId
} from './vendorManagementSections';

/**
 * Vendor Management's workspace-rail identity: its rail-item ids (defined in
 * `./vendorManagementSections.ts`, alongside `vendorManagementAppDefinition` and its breadcrumb
 * builder). Registered into core via `../../shell/appShellRegistry.ts`, mirroring
 * `../strategy-model/strategyShell.tsx`. The Overview section is `sections[0]`, so it is where the
 * app switcher lands (`appRootRoute`).
 */
export const vendorManagementAppDefinition: AppDefinition = {
  id: VENDOR_OVERVIEW_ID,
  applicationId: 'vendor-management',
  name: 'Vendor Management',
  shortCode: 'VM',
  tint: 'oklch(0.62 0.15 55)',
  description: 'Vendor register, contracts and renewals, spend, and vendor risk.',
  sections: [
    {
      // No `primarySidebar`: the Overview is a self-contained dashboard and the app's sections are
      // already switchable from the outer icon rail, so the shell renders it full-width (same as
      // `strategyAppDefinition`'s Overview).
      id: VENDOR_OVERVIEW_ID,
      icon: TbLayoutDashboard,
      tooltip: 'Overview',
      route: VENDOR_RAIL_PATHS[VENDOR_OVERVIEW_ID]
    },
    {
      id: VENDOR_VENDORS_ID,
      icon: TbBuilding,
      tooltip: 'Vendors',
      route: VENDOR_RAIL_PATHS[VENDOR_VENDORS_ID],
      primarySidebar: ctx => (
        <VendorManagementSidebar workspaceSlug={ctx.workspaceSlug} activeSection={VENDOR_VENDORS_ID} />
      )
    },
    {
      id: VENDOR_CONTRACTS_ID,
      icon: TbFileCertificate,
      tooltip: 'Contracts',
      route: VENDOR_RAIL_PATHS[VENDOR_CONTRACTS_ID],
      primarySidebar: ctx => (
        <VendorManagementSidebar
          workspaceSlug={ctx.workspaceSlug}
          activeSection={VENDOR_CONTRACTS_ID}
        />
      )
    },
    {
      id: VENDOR_SPEND_ID,
      icon: TbCoin,
      tooltip: 'Spend',
      route: VENDOR_RAIL_PATHS[VENDOR_SPEND_ID],
      primarySidebar: ctx => (
        <VendorManagementSidebar workspaceSlug={ctx.workspaceSlug} activeSection={VENDOR_SPEND_ID} />
      )
    },
    {
      id: VENDOR_RISK_ID,
      icon: TbAlertTriangle,
      tooltip: 'Risk',
      route: VENDOR_RAIL_PATHS[VENDOR_RISK_ID],
      primarySidebar: ctx => (
        <VendorManagementSidebar workspaceSlug={ctx.workspaceSlug} activeSection={VENDOR_RISK_ID} />
      )
    }
  ],
  enablement: { capabilityType: 'vendor-management' }
};

export const buildVendorManagementBreadcrumbs = (
  ctx: WorkspaceShellContext,
  section: VendorManagementRailItemId
): BreadcrumbItem[] => [
  // The app switcher already stands in for "Vendor Management"; each of its sections carries its
  // own crumb after the home crumbs — including the Overview landing section.
  ...buildHomeBreadcrumbs(ctx),
  {
    label: VENDOR_SECTION_LABELS[section],
    onClick: () =>
      ctx.navigate({
        to: VENDOR_RAIL_PATHS[section],
        params: { workspaceSlug: ctx.workspaceSlug }
      })
  }
];
