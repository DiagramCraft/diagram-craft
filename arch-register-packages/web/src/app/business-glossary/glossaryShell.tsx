import { TbBook } from 'react-icons/tb';
import { buildHomeBreadcrumbs } from '../../shell/breadcrumbBuilders';
import type { WorkspaceShellContext } from '../../layouts/workspaceShellDescriptors';
import type { AppDefinition, BreadcrumbItem } from '../../shell/shellTypes';
import { AppDashboardPrimarySidebar } from '../../sections/dashboard/AppDashboardPrimarySidebar';

export const GLOSSARY_APP_KEY = 'business-glossary';

/**
 * Business Glossary's workspace-rail identity: the rail item id, its route, and its breadcrumb
 * builder. Registered into core via `../../shell/appShellRegistry.ts`, mirroring how
 * `governanceRegistryFactory.ts` composes case-kind registrations on the server.
 */
export const GLOSSARY_RAIL_ITEM_ID = 'glossary' as const;
export type GlossaryRailItemId = typeof GLOSSARY_RAIL_ITEM_ID;

export const GLOSSARY_RAIL_PATH = '/$workspaceSlug/glossary';

/** Business Glossary as a standalone workspace application (see `../../shell/appShellRegistry.ts`). */
export const glossaryAppDefinition: AppDefinition = {
  id: GLOSSARY_RAIL_ITEM_ID,
  applicationId: 'business-glossary',
  name: 'Business Glossary',
  shortCode: 'BG',
  tint: 'oklch(0.62 0.14 295)',
  description: 'Managed business terms, aliases, categories, and quality reports.',
  sections: [
    {
      // A self-contained dashboard (single `entity-browser-embed` widget) with its own `facets`
      // sidebar (categories/owner/lifecycle) routed through the standard dashboard sidebar slot,
      // mirroring `apiIntegrationCatalogAppDefinition`'s Impact section.
      id: GLOSSARY_RAIL_ITEM_ID,
      icon: TbBook,
      tooltip: 'Business glossary',
      route: GLOSSARY_RAIL_PATH,
      dashboard: { appKey: GLOSSARY_APP_KEY },
      primarySidebar: ctx => (
        <AppDashboardPrimarySidebar workspaceSlug={ctx.workspaceSlug} appKey={GLOSSARY_APP_KEY} />
      )
    }
  ]
};

export const buildGlossaryBreadcrumbs = (
  ctx: WorkspaceShellContext,
  detail = false
): BreadcrumbItem[] => [
  // The app switcher already stands in for "Business Glossary", and the app has a single section,
  // so the landing page carries no crumb; term detail shows just the term level.
  ...buildHomeBreadcrumbs(ctx),
  ...(detail
    ? [
        {
          label: 'Term',
          onClick: () =>
            ctx.navigate({
              to: GLOSSARY_RAIL_PATH,
              params: { workspaceSlug: ctx.workspaceSlug }
            })
        }
      ]
    : [])
];
