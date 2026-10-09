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
import { AppDashboardPrimarySidebar } from '../../sections/dashboard/AppDashboardPrimarySidebar';
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
 * configurable dashboard (stat tiles, six-week calendar, review queue) rather than a facet browser.
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
      // `riskComplianceAppDefinition`'s Overview). Renders the seeded `data-stewardship` app
      // dashboard (#3501).
      id: DS_MY_WORK_ID,
      dashboard: { appKey: 'data-stewardship' },
      icon: TbClipboardCheck,
      tooltip: 'My work',
      route: DS_RAIL_PATHS[DS_MY_WORK_ID]
    },
    {
      // No `primarySidebar`: renders the seeded `data-stewardship-stewardship` app dashboard
      // full-width (#3502).
      id: DS_STEWARDSHIP_ID,
      dashboard: { appKey: 'data-stewardship-stewardship' },
      icon: TbUserShield,
      tooltip: 'Stewardship',
      route: DS_RAIL_PATHS[DS_STEWARDSHIP_ID]
    },
    {
      // The seeded `data-stewardship-classification` app dashboard, with its Classification facet
      // sidebar rendered through the shell's primary sidebar slot (#3503).
      id: DS_CLASSIFICATION_ID,
      dashboard: { appKey: 'data-stewardship-classification' },
      icon: TbTags,
      tooltip: 'Classification',
      route: DS_RAIL_PATHS[DS_CLASSIFICATION_ID],
      primarySidebar: ctx => (
        <AppDashboardPrimarySidebar
          workspaceSlug={ctx.workspaceSlug}
          appKey="data-stewardship-classification"
        />
      )
    },
    {
      // The seeded `data-stewardship-change-cases` app dashboard, with its `options` status
      // sidebar rendered through the shell's primary sidebar slot (#3504).
      id: DS_CHANGE_CASES_ID,
      dashboard: { appKey: 'data-stewardship-change-cases' },
      icon: TbGitPullRequest,
      tooltip: 'Change cases & exceptions',
      route: DS_RAIL_PATHS[DS_CHANGE_CASES_ID],
      primarySidebar: ctx => (
        <AppDashboardPrimarySidebar
          workspaceSlug={ctx.workspaceSlug}
          appKey="data-stewardship-change-cases"
        />
      )
    },
    {
      // No `primarySidebar`: renders the seeded `data-stewardship-assessments` app dashboard
      // full-width (#3505).
      id: DS_ASSESSMENTS_ID,
      dashboard: { appKey: 'data-stewardship-assessments' },
      icon: TbChecklist,
      tooltip: 'Assessments',
      route: DS_RAIL_PATHS[DS_ASSESSMENTS_ID]
    }
  ]
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
