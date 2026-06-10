import { defineHandler } from 'h3';
import { implement, onError } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { workspaceConfigContract } from '@arch-register/api-types';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { resolveWorkspace } from './resolveWorkspace';
import { toORPCError } from '../../utils/orpcErrors';
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
  listUsers
} from './workspaceConfigOperations';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const configRouter = implement(workspaceConfigContract).$context<ORPCContext>();

export const workspaceConfigORPCRouter = configRouter.router({
  config: {
    lifecycleStates: {
      list: configRouter.config.lifecycleStates.list.handler(async ({ input, context }) => {
        try {
          const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
          return await listLifecycleStates(context.db, workspace, context.event);
        } catch (error) {
          return toORPCError(error);
        }
      }),
      replace: configRouter.config.lifecycleStates.replace.handler(async ({ input, context }) => {
        try {
          const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
          return await replaceLifecycleStates(context.db, workspace, input.states, context.event);
        } catch (error) {
          return toORPCError(error);
        }
      })
    },
    teams: {
      list: configRouter.config.teams.list.handler(async ({ input, context }) => {
        try {
          const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
          return await listTeams(context.db, workspace, context.event);
        } catch (error) {
          return toORPCError(error);
        }
      }),
      replace: configRouter.config.teams.replace.handler(async ({ input, context }) => {
        try {
          const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
          return await replaceTeams(context.db, workspace, input.teams, context.event);
        } catch (error) {
          return toORPCError(error);
        }
      })
    },
    teamAssignments: {
      list: configRouter.config.teamAssignments.list.handler(async ({ input, context }) => {
        try {
          const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
          return await listTeamAssignments(context.db, workspace, context.event);
        } catch (error) {
          return toORPCError(error);
        }
      }),
      replace: configRouter.config.teamAssignments.replace.handler(async ({ input, context }) => {
        try {
          const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
          return await replaceTeamAssignments(
            context.db,
            workspace,
            input.assignments,
            context.event
          );
        } catch (error) {
          return toORPCError(error);
        }
      })
    },
    roles: {
      list: configRouter.config.roles.list.handler(async ({ input, context }) => {
        try {
          const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
          return await listRoles(context.db, workspace, context.event);
        } catch (error) {
          return toORPCError(error);
        }
      }),
      create: configRouter.config.roles.create.handler(async ({ input, context }) => {
        try {
          const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
          return await createRole(context.db, workspace, input, context.event);
        } catch (error) {
          return toORPCError(error);
        }
      }),
      update: configRouter.config.roles.update.handler(async ({ input, context }) => {
        try {
          const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
          return await updateRole(context.db, workspace, input.roleId, input, context.event);
        } catch (error) {
          return toORPCError(error);
        }
      }),
      remove: configRouter.config.roles.remove.handler(async ({ input, context }) => {
        try {
          const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
          return await deleteRole(context.db, workspace, input.roleId, context.event);
        } catch (error) {
          return toORPCError(error);
        }
      })
    },
    members: {
      list: configRouter.config.members.list.handler(async ({ input, context }) => {
        try {
          const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
          return await listMembers(context.db, workspace, context.event);
        } catch (error) {
          return toORPCError(error);
        }
      }),
      updateRole: configRouter.config.members.updateRole.handler(async ({ input, context }) => {
        try {
          const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
          return await updateMemberRole(
            context.db,
            workspace,
            input.userId,
            input.role,
            context.event
          );
        } catch (error) {
          return toORPCError(error);
        }
      }),
      remove: configRouter.config.members.remove.handler(async ({ input, context }) => {
        try {
          const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
          return await removeMember(context.db, workspace, input.userId, context.event);
        } catch (error) {
          return toORPCError(error);
        }
      })
    },
    users: {
      list: configRouter.config.users.list.handler(async ({ input, context }) => {
        try {
          const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
          return await listUsers(context.db, workspace, context.event);
        } catch (error) {
          return toORPCError(error);
        }
      })
    }
  }
});

export const workspaceConfigOpenAPIHandler = new OpenAPIHandler(workspaceConfigORPCRouter, {
  clientInterceptors: [
    onError(error => {
      console.error('Output validation failed');
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      console.dir((error as any).cause, { depth: 10 });
    })
  ]
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
