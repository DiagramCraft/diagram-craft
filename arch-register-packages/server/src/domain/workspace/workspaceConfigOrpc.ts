import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { resolveWorkspace } from './resolveWorkspace';
import { orpcErrorInterceptors, orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  listLifecycleStates,
  replaceLifecycleStates,
  listTeams,
  replaceTeams,
  listTeamAssignments,
  replaceTeamAssignments,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  listMembers,
  updateMemberRole,
  removeMember,
  listUsers,
  listProjectEntityTypes,
  replaceProjectEntityTypes
} from './workspaceConfigOperations';
import { workspaceConfigContract } from '@arch-register/api-types/workspaceConfigContract';
import {
  createApiToken,
  listApiTokens,
  revokeApiToken
} from '../auth/apiTokenOperations';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const configRouter = implement(workspaceConfigContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

export const workspaceConfigORPCRouter = configRouter.router({
  config: {
    lifecycleStates: {
      list: configRouter.config.lifecycleStates.list.handler(async ({ input, context }) => {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        return await listLifecycleStates(context.db, workspace, context.event);
      }),
      replace: configRouter.config.lifecycleStates.replace.handler(async ({ input, context }) => {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        return await replaceLifecycleStates(
          context.db,
          workspace,
          input.body.states,
          context.event
        );
      })
    },
    teams: {
      list: configRouter.config.teams.list.handler(async ({ input, context }) => {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        return await listTeams(context.db, workspace, context.event);
      }),
      replace: configRouter.config.teams.replace.handler(async ({ input, context }) => {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        return await replaceTeams(context.db, workspace, input.body.teams, context.event);
      })
    },
    teamAssignments: {
      list: configRouter.config.teamAssignments.list.handler(async ({ input, context }) => {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        return await listTeamAssignments(context.db, workspace, context.event);
      }),
      replace: configRouter.config.teamAssignments.replace.handler(async ({ input, context }) => {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        return await replaceTeamAssignments(
          context.db,
          workspace,
          input.body.assignments,
          context.event
        );
      })
    },
    roles: {
      list: configRouter.config.roles.list.handler(async ({ input, context }) => {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        return await listRoles(context.db, workspace, context.event);
      }),
      create: configRouter.config.roles.create.handler(async ({ input, context }) => {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        return await createRole(context.db, workspace, input.body, context.event);
      }),
      update: configRouter.config.roles.update.handler(async ({ input, context }) => {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        return await updateRole(context.db, workspace, input.params.id, input.body, context.event);
      }),
      remove: configRouter.config.roles.remove.handler(async ({ input, context }) => {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        return await deleteRole(context.db, workspace, input.params.id, context.event);
      })
    },
    members: {
      list: configRouter.config.members.list.handler(async ({ input, context }) => {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        return await listMembers(context.db, workspace, context.event);
      }),
      updateRole: configRouter.config.members.updateRole.handler(async ({ input, context }) => {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        return await updateMemberRole(
          context.db,
          workspace,
          input.params.id,
          input.body.roleId,
          context.event
        );
      }),
      remove: configRouter.config.members.remove.handler(async ({ input, context }) => {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        return await removeMember(context.db, workspace, input.params.id, context.event);
      })
    },
    users: {
      list: configRouter.config.users.list.handler(async ({ input, context }) => {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        return await listUsers(context.db, workspace, context.event);
      })
    },
    tokens: {
      list: configRouter.config.tokens.list.handler(async ({ input, context }) => {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        return await listApiTokens(context.db, workspace, context.event);
      }),
      create: configRouter.config.tokens.create.handler(async ({ input, context }) => {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        return await createApiToken(context.db, workspace, input.body, context.event);
      }),
      revoke: configRouter.config.tokens.revoke.handler(async ({ input, context }) => {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        return await revokeApiToken(context.db, workspace, input.params.id, context.event);
      })
    },
    projectEntityTypes: {
      list: configRouter.config.projectEntityTypes.list.handler(async ({ input, context }) => {
        const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
        return await listProjectEntityTypes(context.db, workspace, context.event);
      }),
      replace: configRouter.config.projectEntityTypes.replace.handler(
        async ({ input, context }) => {
          const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
          return await replaceProjectEntityTypes(
            context.db,
            workspace,
            input.body.types,
            context.event
          );
        }
      )
    }
  }
});

export const workspaceConfigOpenAPIHandler = new OpenAPIHandler(workspaceConfigORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createWorkspaceConfigORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await workspaceConfigOpenAPIHandler.handle(event.req, {
      prefix: '/api',
      context: {
        db,
        event: event as AuthenticatedEvent
      }
    });

    if (result.matched) {
      return result.response;
    }
  });
