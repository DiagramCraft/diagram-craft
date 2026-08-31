import { TbBook } from 'react-icons/tb';
import { buildHomeBreadcrumbs } from '../../shell/breadcrumbBuilders';
import type { WorkspaceShellContext } from '../../layouts/workspaceShellDescriptors';
import type { BreadcrumbItem } from '../../shell/shellTypes';

/**
 * Business Glossary's workspace-rail identity: the rail item id, its route, and its breadcrumb
 * builder. Registered into core via `../../shell/appShellRegistry.ts`, mirroring how
 * `governanceRegistryFactory.ts` composes case-kind registrations on the server.
 */
export const GLOSSARY_RAIL_ITEM_ID = 'glossary' as const;

export const GLOSSARY_RAIL_PATH = '/$workspaceSlug/glossary';

export const buildGlossaryBreadcrumbs = (
  ctx: WorkspaceShellContext,
  detail = false
): BreadcrumbItem[] => [
  ...buildHomeBreadcrumbs(ctx),
  {
    label: 'Glossary',
    icon: <TbBook size={12} />,
    onClick: () =>
      ctx.navigate({
        to: GLOSSARY_RAIL_PATH,
        params: { workspaceSlug: ctx.workspaceSlug }
      })
  },
  ...(detail ? [{ label: 'Term', onClick: () => {} }] : [])
];
