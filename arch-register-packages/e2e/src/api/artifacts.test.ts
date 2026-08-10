import { createApiTest, expect } from '../helpers/fixtures';
import { seedIds } from '../helpers/seedHelper';

const test = createApiTest({
  afterSeed: async server => {
    const now = new Date();
    await server.db.catalog.createEntity({
      id: '00000000-0000-0000-0000-e2e000000101',
      workspace: seedIds.workspace.default,
      public_id: 'API-999',
      slug: 'test-api-v1',
      namespace: 'default',
      name: 'Test API',
      description: 'Artifact test entity',
      owner: null,
      lifecycle: null,
      target_lifecycle: null,
      target_lifecycle_date: null,
      tags: [],
      links: [],
      schema_id: '00000000-0000-0000-0000-000000000004',
      data: { api_type: 'openapi', api_version: '1.0.0' },
      project_id: null,
      created_at: now,
      updated_at: now,
      completeness: 0
    });
  }
});

test('typed artifacts and revisions preserve lifecycle state', async ({ orpc }) => {
  const entityId = '00000000-0000-0000-0000-e2e000000101';
  const initial = await orpc.artifacts.list({ params: { workspace: 'default', entityId } });
  expect(initial).toMatchObject({ status: 'not_configured', artifacts: [] });

  const artifact = await orpc.artifacts.create({
    params: { workspace: 'default', entityId },
    body: {
      artifactType: 'api-specification',
      kind: 'document',
      mediaType: 'application/json'
    }
  });
  expect(artifact).toMatchObject({
    artifactType: 'api-specification',
    kind: 'document',
    status: 'pending'
  });

  const content = JSON.stringify({
    openapi: '3.1.0',
    info: { title: 'Test', version: '1.0.0' },
    paths: {
      '/pets': {
        get: {
          operationId: 'listPets',
          responses: { '200': { description: 'ok' } }
        }
      }
    }
  });
  const revision = await orpc.artifacts.createRevision({
    params: { workspace: 'default', entityId, artifactId: artifact.id },
    body: { mediaType: 'application/json', sourceRevision: 'fixture-1', content }
  });
  expect(revision).toMatchObject({
    artifactId: artifact.id,
    checksum: expect.any(String),
    contentSize: Buffer.byteLength(content)
  });

  const collection = await orpc.artifacts.list({ params: { workspace: 'default', entityId } });
  expect(collection).toMatchObject({
    status: 'current',
    artifacts: [{ currentRevisionId: revision.id }]
  });

  const raw = await orpc.artifacts.getRevisionContent({
    params: { workspace: 'default', entityId, artifactId: artifact.id, revisionId: revision.id }
  });
  expect(raw.content).toBe(content);

  const projection = await orpc.artifacts.listApiSpecification({
    params: { workspace: 'default', entityId, artifactId: artifact.id, revisionId: revision.id },
    query: { limit: 50, offset: 0 }
  });
  expect(projection).toMatchObject({
    revision: {
      revision: { id: revision.id },
      protocol: 'openapi',
      status: 'current',
      itemCount: 1
    },
    total: 1,
    items: [{ action: 'get', path: '/pets', identifier: 'listPets' }]
  });

  const repeated = await orpc.artifacts.createRevision({
    params: { workspace: 'default', entityId, artifactId: artifact.id },
    body: { mediaType: 'application/json', sourceRevision: 'fixture-1', content }
  });
  expect(repeated.id).toBe(revision.id);
  const repeatedProjection = await orpc.artifacts.listApiSpecification({
    params: { workspace: 'default', entityId, artifactId: artifact.id, revisionId: revision.id },
    query: { limit: 50, offset: 0 }
  });
  expect(repeatedProjection.total).toBe(1);

  const unsupportedRevision = await orpc.artifacts.createRevision({
    params: { workspace: 'default', entityId, artifactId: artifact.id },
    body: {
      mediaType: 'application/json',
      sourceRevision: 'fixture-unsupported',
      content: JSON.stringify({ openapi: '2.0', info: { title: 'Legacy', version: '1.0.0' } })
    }
  });
  const afterUnsupported = await orpc.artifacts.list({
    params: { workspace: 'default', entityId }
  });
  expect(afterUnsupported).toMatchObject({
    status: 'unsupported',
    artifacts: [{ status: 'unsupported', currentRevisionId: revision.id }]
  });
  const unsupportedProjection = await orpc.artifacts.listApiSpecification({
    params: {
      workspace: 'default',
      entityId,
      artifactId: artifact.id,
      revisionId: unsupportedRevision.id
    },
    query: { limit: 50, offset: 0 }
  });
  expect(unsupportedProjection.revision).toMatchObject({
    status: 'unsupported',
    diagnostics: [expect.objectContaining({ category: 'unsupported_version' })]
  });

  await expect(
    orpc.artifacts.create({
      params: { workspace: 'default', entityId },
      body: {
        artifactType: 'api-specification',
        kind: 'url',
        location: 'http://127.0.0.1/private.yaml'
      }
    })
  ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

  const failed = await orpc.artifacts.update({
    params: { workspace: 'default', entityId, artifactId: artifact.id },
    body: {
      status: 'stale',
      diagnostic: {
        category: 'source_timeout',
        message: 'Remote source timed out',
        timestamp: new Date().toISOString()
      }
    }
  });
  expect(failed).toMatchObject({ status: 'stale', currentRevisionId: revision.id });
});

test('artifacts require entity and content authorization', async ({ server }) => {
  const entityId = '00000000-0000-0000-0000-e2e000000101';
  const unauthenticated = (await import('../helpers/orpcTestClient')).createTestORPCClient(
    server.baseUrl
  );
  await expect(
    unauthenticated.artifacts.list({ params: { workspace: 'default', entityId } })
  ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
});
