import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import {
  createFixtureEntity,
  createFixtureSchema,
  createFixtureWorkspace
} from './projectFixtures';

runContractSuiteAgainstBothDrivers('ApiSpecificationDatabase', getDb => {
  it('stores, replaces, filters, and paginates normalized revision items', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const schema = await createFixtureSchema(db, workspace);
    const entity = await createFixtureEntity(db, workspace, schema);
    const artifact = await db.artifact.createArtifact({
      id: randomUUID(),
      workspace,
      entity_id: entity.id,
      artifact_type: 'api-specification',
      kind: 'document',
      location: null,
      media_type: 'application/json',
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    });
    const revision = await db.artifact.createRevision({
      id: randomUUID(),
      workspace,
      artifact_id: artifact.id,
      source_revision: null,
      checksum: randomUUID(),
      media_type: 'application/json',
      content: '{}',
      created_at: new Date()
    });
    const timestamp = new Date();
    const input = {
      workspace,
      artifact_revision_id: revision.id,
      protocol: 'openapi' as const,
      specification_version: '3.1.0',
      title: 'Test API',
      description: null,
      status: 'current' as const,
      item_count: 2,
      created_at: timestamp,
      updated_at: timestamp,
      items: [
        {
          id: 'item-get-pets',
          item_key: '#/paths/~1pets/get',
          protocol: 'openapi' as const,
          item_kind: 'operation' as const,
          path: '/pets',
          channel: null,
          action: 'get',
          identifier: 'listPets',
          declared_identifier: 'listPets',
          summary: 'List pets',
          description: null,
          tags: ['pets'],
          deprecated: false,
          parameters: [],
          input_summary: null,
          output_summary: { responses: [{ status: '200' }] },
          metadata: {},
          source_pointer: '#/paths/~1pets/get',
          source_line: null,
          source_column: null,
          sort_order: 0
        },
        {
          id: 'item-delete-pets',
          item_key: '#/paths/~1pets/delete',
          protocol: 'openapi' as const,
          item_kind: 'operation' as const,
          path: '/pets',
          channel: null,
          action: 'delete',
          identifier: 'deletePets',
          declared_identifier: 'deletePets',
          summary: 'Delete pets',
          description: null,
          tags: ['admin'],
          deprecated: true,
          parameters: [],
          input_summary: null,
          output_summary: null,
          metadata: {},
          source_pointer: '#/paths/~1pets/delete',
          source_line: null,
          source_column: null,
          sort_order: 1
        }
      ],
      diagnostics: [
        {
          id: 'diagnostic-one',
          severity: 'warning' as const,
          category: 'missing_identifier' as const,
          code: 'identifier_missing',
          message: 'Generated identifier',
          source_pointer: '#/paths/~1pets/delete',
          source_line: null,
          source_column: null,
          sort_order: 0
        }
      ]
    };

    await db.artifactProjections.apiSpecification.replaceRevision(input);
    const stored = await db.artifactProjections.apiSpecification.getRevision(
      workspace,
      revision.id
    );
    expect(stored).toMatchObject({
      artifact_revision_id: revision.id,
      protocol: 'openapi',
      item_count: 2,
      diagnostics: [{ code: 'identifier_missing' }]
    });

    const filtered = await db.artifactProjections.apiSpecification.listItems(
      workspace,
      revision.id,
      { tag: 'pets' },
      { limit: 1, offset: 0 }
    );
    expect(filtered.total).toBe(1);
    expect(filtered.items[0]?.identifier).toBe('listPets');

    await db.artifactProjections.apiSpecification.replaceRevision(input);
    const repeated = await db.artifactProjections.apiSpecification.listItems(
      workspace,
      revision.id,
      {},
      { limit: 10, offset: 0 }
    );
    expect(repeated.total).toBe(2);
  });
});
