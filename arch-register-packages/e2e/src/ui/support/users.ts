import { seededTestPassword, seededUsers } from '@arch-register/server/db/seedFixtures';

export const seededUser = {
  email: seededUsers.globalAdmin.email,
  password: seededTestPassword,
  displayName: seededUsers.globalAdmin.displayName,
  color: seededUsers.globalAdmin.color
} as const;
