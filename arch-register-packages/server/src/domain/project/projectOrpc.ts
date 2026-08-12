import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { projectContentHandlers } from './projectContentOrpc';
import { projectCrudHandlers } from './projectCrudOrpc';
import { projectDocumentAiHandlers } from './projectDocumentAiOrpc';
import { projectDocumentDiscoveryHandlers } from './projectDocumentDiscoveryOrpc';
import { projectEntityHandlers } from './projectEntityOrpc';
import { projectMarkdownHandlers } from './projectMarkdownOrpc';
import { projectRouter } from './projectRouter';

export const projectORPCRouter = projectRouter.router({
  projects: {
    ...projectCrudHandlers,
    ...projectContentHandlers,
    ...projectEntityHandlers,
    ...projectDocumentDiscoveryHandlers,
    ...projectDocumentAiHandlers,
    ...projectMarkdownHandlers
  }
});

export const createProjectORPCHandler = (db: DatabaseAdapter, storage?: StorageAdapter) =>
  createOrpcHandler(projectORPCRouter, {
    context: event => ({ db, storage, event: event as AuthenticatedEvent })
  });
