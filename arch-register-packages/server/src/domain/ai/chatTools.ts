import {
  DOCUMENT_AI_READ_ONLY_TOOLS,
  type DocumentAiToolId
} from '@arch-register/api-types/documentContract';
import type { AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityMutationActor } from '../catalog/entityMutations';
import { createEntityChatTools } from './entityChatTools';
import { createRelationChatTools } from './relationChatTools';
import { createTraversalChatTools } from './traversalChatTools';

export const createAiChatTools = (
  db: DatabaseAdapter,
  workspaceId: string,
  authCtx: AuthorizationContext | null,
  actor: EntityMutationActor,
  options: { readOnly?: boolean; toolIds?: readonly DocumentAiToolId[] } = {}
) => {
  const context = { db, workspaceId, authCtx, actor };
  const allTools = [
    ...createEntityChatTools(context),
    ...createTraversalChatTools(context),
    ...createRelationChatTools(context)
  ];

  if (!options.readOnly) return allTools;

  const readOnlyToolIds = new Set<string>(DOCUMENT_AI_READ_ONLY_TOOLS.map(tool => tool.id));
  const allowedToolIds =
    options.toolIds === undefined ? undefined : new Set<string>(options.toolIds);

  return allTools.filter(
    tool =>
      readOnlyToolIds.has(tool.name) &&
      (allowedToolIds === undefined || allowedToolIds.has(tool.name))
  );
};
