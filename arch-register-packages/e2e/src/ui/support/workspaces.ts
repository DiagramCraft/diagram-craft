import { seededWorkspaces } from '@arch-register/server/db/seedFixtures';

export const defaultWorkspace = {
  slug: seededWorkspaces.default.slug,
  name: seededWorkspaces.default.name
} as const;

export const secondWorkspace = {
  slug: seededWorkspaces.second.slug,
  name: seededWorkspaces.second.name
} as const;
