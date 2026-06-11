import { seededProjects } from '@arch-register/server/db/seedFixtures';

export const portalRedesignProject = {
  id: seededProjects.portalRedesign.id,
  name: seededProjects.portalRedesign.name
} as const;

export const authMigrationProject = {
  id: seededProjects.authMigration.id,
  name: seededProjects.authMigration.name
} as const;

export const checkoutRevampProject = {
  id: seededProjects.checkoutRevamp.id,
  name: seededProjects.checkoutRevamp.name
} as const;
