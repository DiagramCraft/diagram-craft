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

test('typed artifacts and revisions preserve lifecycle state', async ({ orpc, server }) => {
  const entityId = '00000000-0000-0000-0000-e2e000000101';
  const workspaceId = seedIds.workspace.default;
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
  const revisionSummaries = await orpc.artifacts.listApiSpecificationRevisions({
    params: { workspace: 'default', entityId, artifactId: artifact.id }
  });
  expect(revisionSummaries).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        revision: expect.objectContaining({ id: unsupportedRevision.id }),
        status: 'unsupported',
        isCurrent: false,
        diagnostics: [expect.objectContaining({ category: 'unsupported_version' })]
      }),
      expect.objectContaining({
        revision: expect.objectContaining({ id: revision.id }),
        status: 'current',
        isCurrent: true
      })
    ])
  );
  expect(revisionSummaries[0]).not.toHaveProperty('content');

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

  const link = await orpc.artifacts.create({
    params: { workspace: 'default', entityId },
    body: {
      artifactType: 'api-specification',
      kind: 'link',
      location: 'https://example.com/api-docs'
    }
  });
  expect(link).toMatchObject({
    artifactType: 'api-specification',
    kind: 'link',
    status: 'link_only',
    currentRevisionId: null
  });

  const url = await orpc.artifacts.create({
    params: { workspace: 'default', entityId },
    body: {
      artifactType: 'api-specification',
      kind: 'url',
      location: 'https://example.com/openapi.yaml'
    }
  });
  expect(url).toMatchObject({
    artifactType: 'api-specification',
    kind: 'url',
    status: 'pending'
  });

  const queued = await server.db.jobs.listRuns(workspaceId, {
    jobType: 'artifact.api-specification.refresh',
    limit: 10,
    offset: 0
  });
  expect(queued).toMatchObject({
    total: 1,
    items: [
      {
        job_type: 'artifact.api-specification.refresh',
        system_identity: 'artifact-api-specification',
        payload: { artifactId: url.id },
        max_attempts: 3,
        status: 'queued'
      }
    ]
  });

  const repeatedRefresh = await orpc.artifacts.refresh({
    params: { workspace: 'default', entityId, artifactId: url.id }
  });
  expect(repeatedRefresh).toMatchObject({ id: url.id, status: 'pending' });
  const afterRepeatedRefresh = await server.db.jobs.listRuns(workspaceId, {
    jobType: 'artifact.api-specification.refresh',
    limit: 10,
    offset: 0
  });
  expect(afterRepeatedRefresh.total).toBe(1);
});

test('keeps multiple API sources and their revision histories separate', async ({ orpc }) => {
  const entityId = '00000000-0000-0000-0000-e2e000000101';
  const createSource = () =>
    orpc.artifacts.create({
      params: { workspace: 'default', entityId },
      body: {
        artifactType: 'api-specification',
        kind: 'document',
        mediaType: 'application/json'
      }
    });
  const content = (operationId: string, version: string) =>
    JSON.stringify({
      openapi: '3.1.0',
      info: { title: `Source ${operationId}`, version },
      paths: {
        '/pets': {
          get: {
            operationId,
            responses: { '200': { description: 'ok' } }
          }
        }
      }
    });

  const firstSource = await createSource();
  const firstRevision = await orpc.artifacts.createRevision({
    params: { workspace: 'default', entityId, artifactId: firstSource.id },
    body: {
      sourceRevision: 'source-a-v1',
      mediaType: 'application/json',
      content: content('sourceA_v1', '1.0.0')
    }
  });
  const currentRevision = await orpc.artifacts.createRevision({
    params: { workspace: 'default', entityId, artifactId: firstSource.id },
    body: {
      sourceRevision: 'source-a-v2',
      mediaType: 'application/json',
      content: content('sourceA_v2', '2.0.0')
    }
  });
  const secondSource = await createSource();
  const secondRevision = await orpc.artifacts.createRevision({
    params: { workspace: 'default', entityId, artifactId: secondSource.id },
    body: {
      sourceRevision: 'source-b-v1',
      mediaType: 'application/json',
      content: content('sourceB_v1', '1.0.0')
    }
  });

  const collection = await orpc.artifacts.list({
    params: { workspace: 'default', entityId }
  });
  expect(collection.artifacts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: firstSource.id, currentRevisionId: currentRevision.id }),
      expect.objectContaining({ id: secondSource.id, currentRevisionId: secondRevision.id })
    ])
  );

  const firstRevisions = await orpc.artifacts.listApiSpecificationRevisions({
    params: { workspace: 'default', entityId, artifactId: firstSource.id }
  });
  expect(firstRevisions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        revision: expect.objectContaining({
          id: firstRevision.id,
          sourceRevision: 'source-a-v1'
        }),
        isCurrent: false
      }),
      expect.objectContaining({
        revision: expect.objectContaining({
          id: currentRevision.id,
          sourceRevision: 'source-a-v2'
        }),
        isCurrent: true
      })
    ])
  );

  const secondRevisions = await orpc.artifacts.listApiSpecificationRevisions({
    params: { workspace: 'default', entityId, artifactId: secondSource.id }
  });
  expect(secondRevisions).toHaveLength(1);
  expect(secondRevisions[0]).toMatchObject({
    revision: expect.objectContaining({ id: secondRevision.id, sourceRevision: 'source-b-v1' }),
    isCurrent: true
  });

  const historicalProjection = await orpc.artifacts.listApiSpecification({
    params: {
      workspace: 'default',
      entityId,
      artifactId: firstSource.id,
      revisionId: firstRevision.id
    },
    query: { limit: 50, offset: 0 }
  });
  expect(historicalProjection).toMatchObject({
    revision: { isCurrent: false },
    items: [{ identifier: 'sourceA_v1' }]
  });
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

test('artifact registration resolves capability mappings instead of standard field IDs', async ({
  orpc,
  server
}) => {
  const schema = await orpc.schemas.create({
    params: { workspace: 'default' },
    body: {
      name: 'Mapped API Schema',
      fields: [
        { id: 'protocol_kind', name: 'Protocol kind', type: 'text' },
        { id: 'contract_version', name: 'Contract version', type: 'text' }
      ],
      entity_capabilities: [
        {
          type: 'api-specification',
          fieldMappings: {
            api_type: 'protocol_kind',
            api_version: 'contract_version'
          }
        }
      ]
    }
  });
  const entityId = '00000000-0000-0000-0000-e2e000000102';
  const now = new Date();
  await server.db.catalog.createEntity({
    id: entityId,
    workspace: seedIds.workspace.default,
    public_id: 'API-1000',
    slug: 'mapped-api',
    namespace: 'default',
    name: 'Mapped API',
    description: '',
    owner: null,
    lifecycle: null,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: [],
    links: [],
    schema_id: schema.id,
    data: { protocol_kind: 'openapi', contract_version: '3.1.0' },
    project_id: null,
    created_at: now,
    updated_at: now,
    completeness: 0
  });

  const artifact = await orpc.artifacts.create({
    params: { workspace: 'default', entityId },
    body: { artifactType: 'api-specification', kind: 'document', mediaType: 'application/json' }
  });
  const content = JSON.stringify({
    openapi: '3.1.0',
    info: { title: 'Mapped API', version: '3.1.0' },
    paths: {}
  });
  const revision = await orpc.artifacts.createRevision({
    params: { workspace: 'default', entityId, artifactId: artifact.id },
    body: { content, mediaType: 'application/json' }
  });
  expect(revision.artifactId).toBe(artifact.id);

  const invalidSchema = await orpc.schemas.create({
    params: { workspace: 'default' },
    body: {
      name: 'Invalid Mapped API Schema',
      fields: [{ id: 'contract_version', name: 'Contract version', type: 'text' }],
      entity_capabilities: [
        {
          type: 'api-specification',
          fieldMappings: { api_type: 'missing_protocol', api_version: 'contract_version' }
        }
      ]
    }
  });
  const invalidEntityId = '00000000-0000-0000-0000-e2e000000103';
  await server.db.catalog.createEntity({
    id: invalidEntityId,
    workspace: seedIds.workspace.default,
    public_id: 'API-1001',
    slug: 'invalid-mapped-api',
    namespace: 'default',
    name: 'Invalid Mapped API',
    description: '',
    owner: null,
    lifecycle: null,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: [],
    links: [],
    schema_id: invalidSchema.id,
    data: { contract_version: '3.1.0' },
    project_id: null,
    created_at: now,
    updated_at: now,
    completeness: 0
  });
  await expect(
    orpc.artifacts.create({
      params: { workspace: 'default', entityId: invalidEntityId },
      body: { artifactType: 'api-specification', kind: 'document' }
    })
  ).rejects.toMatchObject({
    code: 'CONFLICT',
    message: expect.stringContaining('missing_protocol')
  });
});
