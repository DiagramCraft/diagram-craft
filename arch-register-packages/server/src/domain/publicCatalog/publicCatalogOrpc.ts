import { implement } from '@orpc/server';
import { createHash } from 'node:crypto';
import { defineHandler, getRequestPath } from 'h3';
import {
  publicCatalogConfigContract,
  publicCatalogContract
} from '@arch-register/api-types/publicCatalogContract';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { API_PREFIXES } from '../../constants';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  getPublicCatalogManifest,
  getPublicCatalogEntity,
  getPublicCatalogWikiPage,
  listPublicApiSpecification,
  listPublicApiSpecificationRevisions,
  getPublicApiSpecificationRaw,
  listPublicCatalogEntities,
  readPublicCatalogConfig,
  replacePublicCatalogConfig
} from './publicCatalogOperations';

type PublicCatalogContext = {
  db: DatabaseAdapter;
  storage: StorageAdapter;
};

type PublicCatalogConfigContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const publicRouter = implement(publicCatalogContract)
  .$context<PublicCatalogContext>()
  .use(orpcErrorMiddleware);

const configRouter = implement(publicCatalogConfigContract)
  .$context<PublicCatalogConfigContext>()
  .use(orpcErrorMiddleware);

export const publicCatalogORPCRouter = publicRouter.router({
  manifest: {
    get: publicRouter.manifest.get.handler(({ input, context }) =>
      getPublicCatalogManifest(context.db, input.params.workspace)
    )
  },
  entities: {
    list: publicRouter.entities.list.handler(({ input, context }) =>
      listPublicCatalogEntities(context.db, input.params.workspace, input.query)
    ),
    get: publicRouter.entities.get.handler(({ input, context }) =>
      getPublicCatalogEntity(context.db, input.params.workspace, input.params.entityPublicId)
    )
  },
  wiki: {
    get: publicRouter.wiki.get.handler(({ input, context }) =>
      getPublicCatalogWikiPage(
        context.db,
        context.storage,
        input.params.workspace,
        input.query.path
      )
    )
  },
  apiSpecifications: {
    revisions: publicRouter.apiSpecifications.revisions.handler(({ input, context }) =>
      listPublicApiSpecificationRevisions(
        context.db,
        input.params.workspace,
        input.params.entityPublicId,
        input.params.artifactId
      )
    ),
    items: publicRouter.apiSpecifications.items.handler(({ input, context }) =>
      listPublicApiSpecification(
        context.db,
        input.params.workspace,
        input.params.entityPublicId,
        input.params.artifactId,
        input.params.revisionId,
        input.query
      )
    ),
    raw: publicRouter.apiSpecifications.raw.handler(({ input, context }) =>
      getPublicApiSpecificationRaw(
        context.db,
        input.params.workspace,
        input.params.entityPublicId,
        input.params.artifactId,
        input.params.revisionId
      )
    )
  }
});

export const publicCatalogConfigORPCRouter = configRouter.router({
  publicCatalogConfig: {
    get: configRouter.publicCatalogConfig.get.handler(({ input, context }) =>
      readPublicCatalogConfig(context.db, input.params.workspace, context.event)
    ),
    replace: configRouter.publicCatalogConfig.replace.handler(({ input, context }) =>
      replacePublicCatalogConfig(context.db, input.params.workspace, input.body, context.event)
    )
  }
});

export const createPublicCatalogORPCHandler = (db: DatabaseAdapter, storage: StorageAdapter) => {
  const handler = createOrpcHandler(publicCatalogORPCRouter, {
    prefix: API_PREFIXES.publicCatalog,
    context: () => ({ db, storage })
  });
  return defineHandler(async event => {
    const response = await handler(event);
    if (!(response instanceof Response)) return response;

    const headers = new Headers(response.headers);
    headers.set('cache-control', 'public, max-age=60, stale-while-revalidate=300');
    if (getRequestPath(event).endsWith('/manifest') && response.ok) {
      const body = await response.clone().arrayBuffer();
      const etag = `"${createHash('sha256').update(new Uint8Array(body)).digest('hex')}"`;
      headers.set('etag', etag);
      if (event.req.headers.get('if-none-match') === etag) {
        return new Response(null, { status: 304, headers });
      }
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  });
};

export const createPublicCatalogConfigORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(publicCatalogConfigORPCRouter, {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
