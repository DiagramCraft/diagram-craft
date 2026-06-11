import { seededEntities } from '@arch-register/server/db/seedFixtures';

export const customerApiEntity = {
  id: seededEntities.default.customerApi.id,
  name: seededEntities.default.customerApi.name
} as const;

export const authApiEntity = {
  id: seededEntities.default.authApi.id,
  name: seededEntities.default.authApi.name
} as const;

export const frontendAppEntity = {
  id: seededEntities.default.frontendApp.id,
  name: seededEntities.default.frontendApp.name
} as const;

export const authServiceEntity = {
  id: seededEntities.default.authService.id,
  name: seededEntities.default.authService.name
} as const;
