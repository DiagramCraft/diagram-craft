import type { AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityMutationActor } from '../catalog/entityMutations';

export type AiChatToolContext = {
  db: DatabaseAdapter;
  workspaceId: string;
  authCtx: AuthorizationContext | null;
  actor: EntityMutationActor;
};
