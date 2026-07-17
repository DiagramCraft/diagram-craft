import { seedEntities } from '@arch-register/server/db/seedData';
import {
  seededEntities,
  seededSchemas,
  seededWorkspaces
} from '@arch-register/server/db/seedFixtures';

export const seededApiEntityCount = seedEntities.filter(
  entity =>
    entity.workspace === seededWorkspaces.default.id &&
    entity.schema_id === seededSchemas.default.api.id
).length;

export const seededApiSearchResultCount = seedEntities.filter(
  entity =>
    entity.workspace === seededWorkspaces.default.id && entity.name.toLowerCase().includes('api')
).length;

export const customerApiEntity = {
  id: seededEntities.default.customerApi.id,
  publicId: seededEntities.default.customerApi.publicId,
  name: seededEntities.default.customerApi.name
} as const;

export const authApiEntity = {
  id: seededEntities.default.authApi.id,
  publicId: seededEntities.default.authApi.publicId,
  name: seededEntities.default.authApi.name
} as const;

export const frontendAppEntity = {
  id: seededEntities.default.frontendApp.id,
  publicId: seededEntities.default.frontendApp.publicId,
  name: seededEntities.default.frontendApp.name
} as const;

export const authServiceEntity = {
  id: seededEntities.default.authService.id,
  publicId: seededEntities.default.authService.publicId,
  name: seededEntities.default.authService.name
} as const;
