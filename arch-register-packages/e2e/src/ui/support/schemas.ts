import { seededSchemas } from '@arch-register/server/db/seedFixtures';

export const componentSchema = {
  id: seededSchemas.default.component.id,
  name: seededSchemas.default.component.name
} as const;

export const apiSchema = {
  id: seededSchemas.default.api.id,
  name: seededSchemas.default.api.name
} as const;
