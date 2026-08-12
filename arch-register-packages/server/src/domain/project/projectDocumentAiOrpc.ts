import { runDocumentAiAction, testDocumentAiAction } from './markdownAiOperations';
import { projectRouter } from './projectRouter';

export const projectDocumentAiHandlers = {
  runDocumentAiAction: projectRouter.projects.runDocumentAiAction.handler(
    async ({ input, context }) => {
      if (!context.storage) throw new Error('Storage adapter not available');
      return await runDocumentAiAction(
        context.db,
        context.storage,
        input.params.workspace,
        input.params.nodeId,
        input.params.actionId,
        context.event
      );
    }
  ),
  testDocumentAiAction: projectRouter.projects.testDocumentAiAction.handler(
    async ({ input, context }) => {
      if (!context.storage) throw new Error('Storage adapter not available');
      return await testDocumentAiAction(
        context.db,
        context.storage,
        input.params.workspace,
        input.params.nodeId,
        input.body.documentTypeId,
        input.body.action,
        context.event
      );
    }
  )
};
