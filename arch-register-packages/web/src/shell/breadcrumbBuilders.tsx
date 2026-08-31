import { TbHome } from 'react-icons/tb';
import type { BreadcrumbItem } from './shellTypes';
import type { WorkspaceShellContext } from '../layouts/workspaceShellDescriptors';

/**
 * `buildHomeBreadcrumbs` is shared by every other breadcrumb builder, core and app-owned alike
 * (see `../app/business-glossary/glossaryShell.tsx`). Kept in its own leaf module — rather than in
 * `../layouts/workspaceShellDescriptors.tsx` alongside the rest — so an app can depend on it without
 * creating a circular import back through `../shell/appShellRegistry.ts`.
 */
export const buildHomeBreadcrumbs = (ctx: WorkspaceShellContext): BreadcrumbItem[] => [
  {
    label: 'Home',
    icon: <TbHome size={12} />,
    onClick: () =>
      ctx.navigate({ to: '/$workspaceSlug', params: { workspaceSlug: ctx.workspaceSlug } })
  }
];
