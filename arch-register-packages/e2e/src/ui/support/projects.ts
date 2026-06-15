import { seededProjects } from '@arch-register/server/db/seedFixtures';

export const portalRedesignProject = {
  id: seededProjects.portalRedesign.publicId,
  name: seededProjects.portalRedesign.name
} as const;

export const authMigrationProject = {
  id: seededProjects.authMigration.publicId,
  name: seededProjects.authMigration.name
} as const;

export const checkoutRevampProject = {
  id: seededProjects.checkoutRevamp.publicId,
  name: seededProjects.checkoutRevamp.name
} as const;
