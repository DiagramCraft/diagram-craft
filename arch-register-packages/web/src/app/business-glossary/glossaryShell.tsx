import { buildHomeBreadcrumbs } from '../../shell/breadcrumbBuilders';
import type { WorkspaceShellContext } from '../../layouts/workspaceShellDescriptors';
import type { AppDefinition, BreadcrumbItem } from '../../shell/shellTypes';

/**
 * Business Glossary's workspace-rail identity: the rail item id, its route, and its breadcrumb
 * builder. Registered into core via `../../shell/appShellRegistry.ts`, mirroring how
 * `governanceRegistryFactory.ts` composes case-kind registrations on the server.
 */
export const GLOSSARY_RAIL_ITEM_ID = 'glossary' as const;

export const GLOSSARY_RAIL_PATH = '/$workspaceSlug/glossary';

/** Business Glossary as a standalone workspace application (see `../../shell/appShellRegistry.ts`). */
export const glossaryAppDefinition: AppDefinition = {
  id: GLOSSARY_RAIL_ITEM_ID,
  name: 'Business Glossary',
  shortCode: 'BG',
  tint: 'oklch(0.62 0.14 295)',
  description: 'Managed business terms, aliases, categories, and quality reports.',
  railItems: [GLOSSARY_RAIL_ITEM_ID],
  rootRoute: GLOSSARY_RAIL_PATH,
  enablement: { capabilityType: 'business-glossary' }
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
