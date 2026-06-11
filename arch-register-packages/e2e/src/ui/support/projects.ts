import { seededProjects } from '@arch-register/server/db/seedFixtures';

export const authMigrationProject = {
  id: seededProjects.authMigration.id,
  name: seededProjects.authMigration.name
} as const;
