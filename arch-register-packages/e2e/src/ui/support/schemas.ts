import { seededSchemas } from '@arch-register/server/db/seedFixtures';

export const domainSchema = {
  id: seededSchemas.default.domain.id,
  name: seededSchemas.default.domain.name
} as const;

export const systemSchema = {
  id: seededSchemas.default.system.id,
  name: seededSchemas.default.system.name
} as const;

export const componentSchema = {
  id: seededSchemas.default.component.id,
  name: seededSchemas.default.component.name
} as const;

export const apiSchema = {
  id: seededSchemas.default.api.id,
  name: seededSchemas.default.api.name
} as const;
