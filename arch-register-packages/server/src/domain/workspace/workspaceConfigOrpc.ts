import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
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
  replaceProjectEntityTypes,
  listAssessmentTypes,
  replaceAssessmentTypes,
  listSupportedCurrencies,
  replaceSupportedCurrencies
} from './workspaceConfigOperations';
import { workspaceConfigContract } from '@arch-register/api-types/workspaceConfigContract';
import { createApiToken, listApiTokens, revokeApiToken } from '../auth/apiTokenOperations';

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
        return await listLifecycleStates(context.db, input.params.workspace, context.event);
      }),
      replace: configRouter.config.lifecycleStates.replace.handler(async ({ input, context }) => {
        return await replaceLifecycleStates(
          context.db,
          input.params.workspace,
          input.body.states,
          context.event
        );
      })
    },
    teams: {
      list: configRouter.config.teams.list.handler(async ({ input, context }) => {
        return await listTeams(
          context.db,
          input.params.workspace,
          context.event,
          input.query ?? undefined
        );
      }),
      replace: configRouter.config.teams.replace.handler(async ({ input, context }) => {
        return await replaceTeams(
          context.db,
          input.params.workspace,
          input.body.teams,
          context.event
        );
      })
    },
    teamAssignments: {
      list: configRouter.config.teamAssignments.list.handler(async ({ input, context }) => {
        return await listTeamAssignments(context.db, input.params.workspace, context.event);
      }),
      replace: configRouter.config.teamAssignments.replace.handler(async ({ input, context }) => {
        return await replaceTeamAssignments(
          context.db,
          input.params.workspace,
          input.body.assignments,
          context.event
        );
      })
    },
    roles: {
      list: configRouter.config.roles.list.handler(async ({ input, context }) => {
        return await listRoles(context.db, input.params.workspace, context.event);
      }),
      create: configRouter.config.roles.create.handler(async ({ input, context }) => {
        return await createRole(context.db, input.params.workspace, input.body, context.event);
      }),
      update: configRouter.config.roles.update.handler(async ({ input, context }) => {
        return await updateRole(
          context.db,
          input.params.workspace,
          input.params.id,
          input.body,
          context.event
        );
      }),
      remove: configRouter.config.roles.remove.handler(async ({ input, context }) => {
        return await deleteRole(context.db, input.params.workspace, input.params.id, context.event);
      })
    },
    members: {
      list: configRouter.config.members.list.handler(async ({ input, context }) => {
        return await listMembers(context.db, input.params.workspace, context.event);
      }),
      updateRole: configRouter.config.members.updateRole.handler(async ({ input, context }) => {
        return await updateMemberRole(
          context.db,
          input.params.workspace,
          input.params.id,
          input.body.roleId,
          context.event
        );
      }),
      remove: configRouter.config.members.remove.handler(async ({ input, context }) => {
        return await removeMember(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event
        );
      })
    },
    users: {
      list: configRouter.config.users.list.handler(async ({ input, context }) => {
        return await listUsers(
          context.db,
          input.params.workspace,
          context.event,
          input.query ?? undefined
        );
      })
    },
    tokens: {
      list: configRouter.config.tokens.list.handler(async ({ input, context }) => {
        return await listApiTokens(context.db, input.params.workspace, context.event);
      }),
      create: configRouter.config.tokens.create.handler(async ({ input, context }) => {
        return await createApiToken(context.db, input.params.workspace, input.body, context.event);
      }),
      revoke: configRouter.config.tokens.revoke.handler(async ({ input, context }) => {
        return await revokeApiToken(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event
        );
      })
    },
    projectEntityTypes: {
      list: configRouter.config.projectEntityTypes.list.handler(async ({ input, context }) => {
        return await listProjectEntityTypes(context.db, input.params.workspace, context.event);
      }),
      replace: configRouter.config.projectEntityTypes.replace.handler(
        async ({ input, context }) => {
          return await replaceProjectEntityTypes(
            context.db,
            input.params.workspace,
            input.body.types,
            context.event
          );
        }
      )
    },
    assessmentTypes: {
      list: configRouter.config.assessmentTypes.list.handler(async ({ input, context }) => {
        return await listAssessmentTypes(context.db, input.params.workspace, context.event);
      }),
      replace: configRouter.config.assessmentTypes.replace.handler(async ({ input, context }) => {
        return await replaceAssessmentTypes(
          context.db,
          input.params.workspace,
          input.body.types,
          context.event
        );
      })
    },
    currencies: {
      list: configRouter.config.currencies.list.handler(async ({ input, context }) => {
        return await listSupportedCurrencies(context.db, input.params.workspace, context.event);
      }),
      replace: configRouter.config.currencies.replace.handler(async ({ input, context }) => {
        return await replaceSupportedCurrencies(
          context.db,
          input.params.workspace,
          input.body.currencies,
          input.body.default_currency,
          context.event
        );
      })
    }
  }
});

export const workspaceConfigOpenAPIHandler = new OpenAPIHandler(workspaceConfigORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createWorkspaceConfigORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await workspaceConfigOpenAPIHandler.handle(event.req, {
      prefix: '/api/application/v1',
      context: {
        db,
        event: event as AuthenticatedEvent
      }
    });

    if (result.matched) {
      return result.response;
    }
  });
