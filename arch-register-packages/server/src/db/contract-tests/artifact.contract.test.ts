import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import {
  createFixtureEntity,
  createFixtureSchema,
  createFixtureWorkspace
} from './projectFixtures';

runContractSuiteAgainstBothDrivers('ArtifactDatabase', getDb => {
  describe('typed artifacts and revisions', () => {
    it('creates and lists typed artifacts for an entity', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureEntity(db, workspace, schema);
      const now = new Date();

      const source = await db.artifact.createArtifact({
        id: randomUUID(),
        workspace,
        entity_id: entity.id,
        artifact_type: 'api-specification',
        kind: 'url',
        location: 'https://example.com/openapi.yaml',
        media_type: 'application/yaml',
        status: 'pending',
        created_at: now,
        updated_at: now
      });

      expect(await db.artifact.listArtifacts(workspace, entity.id)).toEqual([source]);
      expect(source.current_revision_id).toBeNull();
      expect(source.diagnostic).toBeNull();
      expect(await db.artifact.listRevisionSummaries(workspace, source.id)).toEqual([]);
    });

    it('finds a provider-scoped source and enforces source identity uniqueness', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureEntity(db, workspace, schema);
      const now = new Date();
      const sourceKey =
        'github:example/catalog:catalog-info.yaml:default/api/example:spec.definition';
      const source = await db.artifact.createArtifact({
        id: randomUUID(),
        workspace,
        entity_id: entity.id,
        artifact_type: 'api-specification',
        source_key: sourceKey,
        kind: 'document',
        location: null,
        media_type: 'application/yaml',
        status: 'pending',
        created_at: now,
        updated_at: now
      });

      expect(
        await db.artifact.getArtifactBySourceKey(
          workspace,
          entity.id,
          'api-specification',
          sourceKey
        )
      ).toEqual(source);
      await expect(
        db.artifact.createArtifact({
          ...source,
          id: randomUUID(),
          created_at: now,
          updated_at: now
        })
      ).rejects.toThrow();
    });

    it('deduplicates revisions by source and checksum and retains failure diagnostics', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureEntity(db, workspace, schema);
      const now = new Date();
      const source = await db.artifact.createArtifact({
        id: randomUUID(),
        workspace,
        entity_id: entity.id,
        artifact_type: 'api-specification',
        kind: 'document',
        location: null,
        media_type: 'application/json',
        status: 'pending',
        created_at: now,
        updated_at: now
      });
      const revision = await db.artifact.createRevision({
        id: randomUUID(),
        workspace,
        artifact_id: source.id,
        source_revision: 'main:1',
        checksum: 'sha256-1',
        media_type: 'application/json',
        content: '{"openapi":"3.1.0"}',
        created_at: now
      });
      await db.artifact.updateArtifact(workspace, source.id, {
        status: 'current',
        current_revision_id: revision.id,
        last_attempt_at: now,
        last_success_at: now,
        updated_at: now
      });

      const current = await db.artifact.getArtifact(workspace, source.id);
      expect(current?.current_revision_id).toBe(revision.id);
      expect(current?.status).toBe('current');

      const failedAt = new Date(now.getTime() + 1000);
      const failed = await db.artifact.updateArtifact(workspace, source.id, {
        status: 'stale',
        last_attempt_at: failedAt,
        diagnostic: {
          category: 'source_timeout',
          message: 'Remote source timed out',
          timestamp: failedAt
        },
        updated_at: failedAt
      });

      expect(failed).toMatchObject({
        status: 'stale',
        current_revision_id: revision.id,
        last_success_at: now,
        diagnostic: { category: 'source_timeout' }
      });
      expect(await db.artifact.getRevisionByChecksum(workspace, source.id, 'sha256-1')).toEqual(
        revision
      );

      const later = new Date(now.getTime() + 1000);
      const secondRevision = await db.artifact.createRevision({
        id: randomUUID(),
        workspace,
        artifact_id: source.id,
        source_revision: 'main:2',
        checksum: 'sha256-2',
        media_type: 'application/json',
        content: '{"openapi":"3.1.0","info":{"version":"2"}}',
        created_at: later
      });
      const summaries = await db.artifact.listRevisionSummaries(workspace, source.id);
      expect(summaries.map(summary => summary.id)).toEqual([secondRevision.id, revision.id]);
      expect(summaries[0]).toMatchObject({
        source_revision: 'main:2',
        content_size: Buffer.byteLength(secondRevision.content, 'utf8')
      });
    });

    it('starts one refresh attempt at a time and clears the previous diagnostic', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureEntity(db, workspace, schema);
      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      const source = await db.artifact.createArtifact({
        id: randomUUID(),
        workspace,
        entity_id: entity.id,
        artifact_type: 'api-specification',
        kind: 'url',
        location: 'https://example.com/openapi.yaml',
        media_type: null,
        status: 'stale',
        created_at: createdAt,
        updated_at: createdAt
      });
      await db.artifact.updateArtifact(workspace, source.id, {
        diagnostic: {
          category: 'source_timeout',
          message: 'The previous attempt timed out',
          timestamp: createdAt
        },
        last_attempt_at: createdAt,
        updated_at: createdAt
      });

      const startedAt = new Date('2026-01-01T00:01:00.000Z');
      const first = await db.artifact.beginAttempt(workspace, source.id, startedAt);
      expect(first).toMatchObject({
        started: true,
        artifact: {
          status: 'pending',
          diagnostic: null,
          last_attempt_at: startedAt
        }
      });

      const second = await db.artifact.beginAttempt(
        workspace,
        source.id,
        new Date('2026-01-01T00:02:00.000Z')
      );
      expect(second).toMatchObject({
        started: false,
        artifact: { status: 'pending', last_attempt_at: startedAt }
      });
    });
  });
});
