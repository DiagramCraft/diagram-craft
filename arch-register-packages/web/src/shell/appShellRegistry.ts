import { GLOSSARY_RAIL_ITEM_ID, GLOSSARY_RAIL_PATH } from '../app/business-glossary/glossaryShell';

/**
 * Composes the workspace-rail routes owned by each app, so core shell files
 * (`shellTypes.ts`, `../layouts/workspaceShellDescriptors.tsx`) don't hardcode individual app ids.
 * Add a new app's rail item id/route here rather than inline in those files, following the same
 * composition-by-import pattern as the server's `domain/governance/governanceRegistryFactory.ts`.
 */
export type AppRailItemId = typeof GLOSSARY_RAIL_ITEM_ID;

export const APP_RAIL_ROUTES: Record<AppRailItemId, string> = {
  [GLOSSARY_RAIL_ITEM_ID]: GLOSSARY_RAIL_PATH
};
