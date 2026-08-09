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
    });
  });
});
