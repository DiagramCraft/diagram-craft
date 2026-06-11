import { seededTestPassword, seededUsers } from '@arch-register/server/db/seedFixtures';

export const seededUser = {
  email: seededUsers.globalAdmin.email,
  password: seededTestPassword,
  displayName: seededUsers.globalAdmin.displayName
} as const;
