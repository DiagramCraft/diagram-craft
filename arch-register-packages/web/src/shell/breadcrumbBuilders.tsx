import type { BreadcrumbItem } from './shellTypes';
import type { WorkspaceShellContext } from '../layouts/workspaceShellDescriptors';

/**
 * Breadcrumb root, shared by every other breadcrumb builder, core and app-owned alike (see
 * `../app/business-glossary/glossaryShell.tsx`). Now that the top bar has an application switcher
 * that stands in for the workspace/app root, the trail is app-relative and this contributes no
 * crumb — a builder that spreads it simply starts at its own first level. Kept as a function (and
 * in its own leaf module) so callers stay unchanged and an app can depend on it without a circular
 * import back through `../shell/appShellRegistry.ts`.
 */
export const buildHomeBreadcrumbs = (_ctx: WorkspaceShellContext): BreadcrumbItem[] => [];
