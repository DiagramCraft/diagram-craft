import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { orpcErrorInterceptors, orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  listChangeCasesByProject,
  getChangeCase,
  createChangeCase,
  addEntityToChangeCase,
  removeEntityFromChangeCase,
  updateChangeCaseMemberProposedState,
  updateChangeCaseFields,
  checkChangeCaseApplyConflicts,
  applyChangeCase,
  withdrawChangeCase
} from '../catalog/changeCaseOperations';
import { changeCaseContract } from '@arch-register/api-types/changeCaseContract';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const changeCaseRouter = implement(changeCaseContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

export const changeCaseORPCRouter = changeCaseRouter.router({
  changeCases: {
    listByProject: changeCaseRouter.changeCases.listByProject.handler(
      async ({ input, context }) => {
        return await listChangeCasesByProject(
          context.db,
          input.params.workspace,
          input.params.id,
          context.event
        );
      }
    ),
    get: changeCaseRouter.changeCases.get.handler(async ({ input, context }) => {
      return await getChangeCase(
        context.db,
        input.params.workspace,
        input.params.id,
        input.params.caseId,
        context.event
      );
    }),
    create: changeCaseRouter.changeCases.create.handler(async ({ input, context }) => {
      return await createChangeCase(
        context.db,
        input.params.workspace,
        input.params.id,
        context.event,
        input.body
      );
    }),
    addMember: changeCaseRouter.changeCases.addMember.handler(async ({ input, context }) => {
      return await addEntityToChangeCase(
        context.db,
        input.params.workspace,
        input.params.id,
        input.params.caseId,
        context.event,
        input.body
      );
    }),
    removeMember: changeCaseRouter.changeCases.removeMember.handler(async ({ input, context }) => {
      return await removeEntityFromChangeCase(
        context.db,
        input.params.workspace,
        input.params.id,
        input.params.caseId,
        input.params.memberId,
        context.event
      );
    }),
    updateMember: changeCaseRouter.changeCases.updateMember.handler(async ({ input, context }) => {
      return await updateChangeCaseMemberProposedState(
        context.db,
        input.params.workspace,
        input.params.id,
        input.params.caseId,
        input.params.memberId,
        context.event,
        input.body
      );
    }),
    update: changeCaseRouter.changeCases.update.handler(async ({ input, context }) => {
      return await updateChangeCaseFields(
        context.db,
        input.params.workspace,
        input.params.id,
        input.params.caseId,
        context.event,
        input.body
      );
    }),
    checkApplyConflicts: changeCaseRouter.changeCases.checkApplyConflicts.handler(
      async ({ input, context }) => {
        return await checkChangeCaseApplyConflicts(
          context.db,
          input.params.workspace,
          input.params.id,
          input.params.caseId,
          context.event
        );
      }
    ),
    apply: changeCaseRouter.changeCases.apply.handler(async ({ input, context }) => {
      return await applyChangeCase(
        context.db,
        input.params.workspace,
        input.params.id,
        input.params.caseId,
        context.event,
        input.body
      );
    }),
    withdraw: changeCaseRouter.changeCases.withdraw.handler(async ({ input, context }) => {
      return await withdrawChangeCase(
        context.db,
        input.params.workspace,
        input.params.id,
        input.params.caseId,
        context.event
      );
    })
  }
});

export const changeCaseOpenAPIHandler = new OpenAPIHandler(changeCaseORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createChangeCaseORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await changeCaseOpenAPIHandler.handle(event.req, {
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
