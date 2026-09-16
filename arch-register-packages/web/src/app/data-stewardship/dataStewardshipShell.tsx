import {
  TbClipboardCheck,
  TbUserShield,
  TbTags,
  TbGitPullRequest,
  TbChecklist
} from 'react-icons/tb';
import { buildHomeBreadcrumbs } from '../../shell/breadcrumbBuilders';
import type { WorkspaceShellContext } from '../../layouts/workspaceShellDescriptors';
import type { AppDefinition, BreadcrumbItem } from '../../shell/shellTypes';
import { DataStewardshipSidebar } from './sections/DataStewardshipSidebar';
import {
  DS_MY_WORK_ID,
  DS_STEWARDSHIP_ID,
  DS_CLASSIFICATION_ID,
  DS_CHANGE_CASES_ID,
  DS_ASSESSMENTS_ID,
  DS_RAIL_PATHS,
  DS_SECTION_LABELS,
  type DataStewardshipRailItemId
} from './dataStewardshipSections';

/**
 * Data Stewardship's workspace-rail identity: its rail-item ids (defined in
 * `./dataStewardshipSections.ts`, alongside `dataStewardshipAppDefinition` and its breadcrumb
 * builder). Registered into core via `../../shell/appShellRegistry.ts`, mirroring
 * `../risk-compliance/riskComplianceShell.tsx`.
 *
 * Unlike Risk & Compliance / Vendor Management, there is no separate Overview section — My work is
 * `sections[0]`, so it is where the app switcher lands (`appRootRoute`), and it is a self-contained
 * dashboard (review queue, assigned cases, six-week calendar) rather than a facet browser.
 */
export const dataStewardshipAppDefinition: AppDefinition = {
  id: DS_MY_WORK_ID,
  applicationId: 'data-stewardship',
  name: 'Data Stewardship',
  shortCode: 'DS',
  tint: 'oklch(0.6 0.14 145)',
  description: 'Stewardship coverage, data classification, and change cases & exceptions.',
  sections: [
    {
      // No `primarySidebar`: My work is a self-contained dashboard and the app's sections are
      // already switchable from the outer icon rail, so the shell renders it full-width (same as
      // `riskComplianceAppDefinition`'s Overview).
      id: DS_MY_WORK_ID,
      icon: TbClipboardCheck,
      tooltip: 'My work',
      route: DS_RAIL_PATHS[DS_MY_WORK_ID]
    },
    {
      id: DS_STEWARDSHIP_ID,
      icon: TbUserShield,
      tooltip: 'Stewardship',
      route: DS_RAIL_PATHS[DS_STEWARDSHIP_ID],
      primarySidebar: ctx => (
        <DataStewardshipSidebar
          workspaceSlug={ctx.workspaceSlug}
          activeSection={DS_STEWARDSHIP_ID}
        />
      )
    },
    {
      id: DS_CLASSIFICATION_ID,
      icon: TbTags,
      tooltip: 'Classification',
      route: DS_RAIL_PATHS[DS_CLASSIFICATION_ID],
      primarySidebar: ctx => (
        <DataStewardshipSidebar
          workspaceSlug={ctx.workspaceSlug}
          activeSection={DS_CLASSIFICATION_ID}
        />
      )
    },
    {
      id: DS_CHANGE_CASES_ID,
      icon: TbGitPullRequest,
      tooltip: 'Change cases & exceptions',
      route: DS_RAIL_PATHS[DS_CHANGE_CASES_ID],
      primarySidebar: ctx => (
        <DataStewardshipSidebar
          workspaceSlug={ctx.workspaceSlug}
          activeSection={DS_CHANGE_CASES_ID}
        />
      )
    },
    {
      // No `primarySidebar`: like My work, Assessments is a self-contained register with its own
      // due panels and in-page filters rather than a facet/nav sidebar, so the shell renders it
      // full-width (same as `riskComplianceAppDefinition`'s Assessments).
      id: DS_ASSESSMENTS_ID,
      icon: TbChecklist,
      tooltip: 'Assessments',
      route: DS_RAIL_PATHS[DS_ASSESSMENTS_ID]
    }
  ],
  enablement: { capabilityType: 'data-stewardship' }
};

export const buildDataStewardshipBreadcrumbs = (
  ctx: WorkspaceShellContext,
  section: DataStewardshipRailItemId
): BreadcrumbItem[] => [
  // The app switcher already stands in for "Data Stewardship"; each of its sections carries its
  // own crumb after the home crumbs — including the My work landing section.
  ...buildHomeBreadcrumbs(ctx),
  {
    label: DS_SECTION_LABELS[section],
    onClick: () =>
      ctx.navigate({
        to: DS_RAIL_PATHS[section],
        params: { workspaceSlug: ctx.workspaceSlug }
      })
  }
];
