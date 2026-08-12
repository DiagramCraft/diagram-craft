import { implement } from '@orpc/server';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { orpcErrorMiddleware } from '../../utils/orpcErrors';
import { projectContract } from '@arch-register/api-types/projectContract';

export type ORPCContext = {
  db: DatabaseAdapter;
  storage: StorageAdapter | undefined;
  event: AuthenticatedEvent;
};

export const projectRouter = implement(projectContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);
