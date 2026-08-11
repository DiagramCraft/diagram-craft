import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import {
  provisionSqliteDatabase,
  type ProvisionedDatabase
} from '../../db/testSupport/provisionDatabase';
import {
  createFixtureSchema,
  createFixtureWorkspace
} from '../../db/contract-tests/projectFixtures';
import { createFixtureUser } from '../../db/contract-tests/authFixtures';
import { syncApiSpecificationByExternalKey } from './apiSpecificationSyncOperations';

const document = (version: string) => `openapi: 3.0.0
info:
  title: Example API
  version: ${version}
paths:
  /health:
    get:
      operationId: health
      responses:
        '200':
          description: OK
`;

describe('syncApiSpecificationByExternalKey', () => {
  let provisioned: ProvisionedDatabase;
  let actor: { id: string; displayName: string | null };

  beforeEach(async () => {
    provisioned = await provisionSqliteDatabase();
    const user = await createFixtureUser(provisioned.db);
    actor = { id: user.id, displayName: user.display_name };
  });

  afterEach(async () => {
    await provisioned.teardown();
  });

  const createApiSchema = async (db: DatabaseAdapter, workspace: string) => {
    const schemaId = await createFixtureSchema(db, workspace);
    const schema = await db.catalog.getSchema(workspace, schemaId);
    await db.catalog.updateSchema(workspace, schemaId, {
      ...schema!,
      fields: [
        { id: 'api_type', name: 'API type', type: 'text' },
        { id: 'api_version', name: 'API version', type: 'text' }
      ],
      entity_capabilities: [{ type: 'api-specification' }]
    });
    await db.workspace.registerPublicIdPrefix(schema!.key_prefix, 'schema', schemaId, new Date());
    return schemaId;
  };

  it('creates one entity/source pair and deduplicates repeated documents', async () => {
    const db = provisioned.db;
    const workspace = await createFixtureWorkspace(db);
    const schema = await createApiSchema(db, workspace);
    const body = {
      entity: { _schemaId: schema, _name: 'Example API' },
      source: {
        state: 'present' as const,
        source: {
          kind: 'document' as const,
          sourceKey: 'github:example/api/catalog-info.yaml:default/api/example:spec.definition',
          location: 'https://github.com/example/api/blob/main/openapi.yaml',
          mediaType: 'application/yaml',
          sourceRevision: 'sha-1',
          content: document('1.0.0')
        }
      }
    };

    const first = await syncApiSpecificationByExternalKey(
      db,
      workspace,
      'backstage-github-example',
      'default/api/example',
      body,
      null,
      actor
    );
    const second = await syncApiSpecificationByExternalKey(
      db,
      workspace,
      'backstage-github-example',
      'default/api/example',
      body,
      null,
      actor
    );

    expect(first.status).toBe('created');
    expect(first.sourceStatus).toBe('created');
    expect(first.artifact?.sourceKey).toBe(body.source.source.sourceKey);
    expect(first.revision?.id).toBeTruthy();
    expect(second.status).toBe('unchanged');
    expect(second.sourceStatus).toBe('unchanged');
    expect(second.revision?.id).toBe(first.revision?.id);
    expect(await db.artifact.listArtifacts(workspace, first.entity._uid as string)).toHaveLength(1);
    expect(
      await db.artifact.listRevisionSummaries(workspace, first.artifact!.id)
    ).toHaveLength(1);
  });

  it('creates a new immutable revision when the document changes and marks missing sources stale', async () => {
    const db = provisioned.db;
    const workspace = await createFixtureWorkspace(db);
    const schema = await createApiSchema(db, workspace);
    const sourceKey = 'github:example/api/catalog-info.yaml:default/api/example:spec.definition';
    const sync = (content: string, sourceState: 'present' | 'missing' = 'present') =>
      syncApiSpecificationByExternalKey(
        db,
        workspace,
        'backstage-github-example',
        'default/api/example',
        {
          entity: { _schemaId: schema, _name: 'Example API' },
          source:
            sourceState === 'present'
              ? {
                  state: 'present' as const,
                  source: {
                    kind: 'document' as const,
                    sourceKey,
                    content,
                    mediaType: 'application/yaml'
                  }
                }
              : { state: 'missing' as const, sourceKey }
        },
        null,
        actor
      );

    const first = await sync(document('1.0.0'));
    const second = await sync(document('2.0.0'));
    const missing = await sync('', 'missing');

    expect(second.sourceStatus).toBe('updated');
    expect(second.revision?.id).not.toBe(first.revision?.id);
    expect(
      await db.artifact.listRevisionSummaries(workspace, second.artifact!.id)
    ).toHaveLength(2);
    expect(missing.sourceStatus).toBe('missing');
    expect(missing.artifact).toMatchObject({ status: 'stale', currentRevisionId: second.revision?.id });
  });

  it('queues URL sources and configures their recurring refresh schedule', async () => {
    const db = provisioned.db;
    const workspace = await createFixtureWorkspace(db);
    const schema = await createApiSchema(db, workspace);
    const result = await syncApiSpecificationByExternalKey(
      db,
      workspace,
      'external-catalog',
      'default/api/url',
      {
        entity: { _schemaId: schema, _name: 'URL API' },
        source: {
          state: 'present',
          source: {
            kind: 'url',
            sourceKey: 'external:url-api',
            location: 'https://example.test/openapi.yaml',
            refreshPolicy: { mode: 'scheduled', intervalHours: 24 }
          }
        }
      },
      null,
      actor
    );

    expect(result.sourceStatus).toBe('queued');
    expect(result.jobRunId).toBeTruthy();
    expect(result.artifact).toMatchObject({ status: 'pending' });
    expect(result.artifact?.refreshScheduleId).toBeTruthy();
    expect(
      (await db.jobs.listRuns(workspace, { limit: 10, offset: 0 })).items
    ).toHaveLength(2);
    expect(await db.jobs.listSchedules(workspace)).toHaveLength(1);
  });
});
