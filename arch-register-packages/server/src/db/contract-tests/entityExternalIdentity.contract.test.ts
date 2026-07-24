import { describe, expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFullFixtureSet, createFixtureWorkspace } from './projectFixtures';
import { DatabaseError } from '../database';

runContractSuiteAgainstBothDrivers('EntityExternalIdentityDatabase', getDb => {
  describe('entity external identity', () => {
    it('returns null when no identity exists', async () => {
      const db = getDb();
      const { workspace } = await createFullFixtureSet(db);

      expect(
        await db.externalIdentity.find(workspace, 'backstage', 'component:default/foo')
      ).toBeNull();
    });

    it('creates and finds an identity by workspace, source and external key', async () => {
      const db = getDb();
      const { workspace, entity } = await createFullFixtureSet(db);

      const created = await db.externalIdentity.create({
        workspace,
        source: 'backstage',
        external_key: 'component:default/foo',
        entity_id: entity
      });
      expect(created).toMatchObject({
        workspace,
        source: 'backstage',
        external_key: 'component:default/foo',
        entity_id: entity
      });

      const found = await db.externalIdentity.find(workspace, 'backstage', 'component:default/foo');
      expect(found).toMatchObject({ workspace, source: 'backstage', entity_id: entity });
    });

    it('rejects a duplicate (workspace, source, external key)', async () => {
      const db = getDb();
      const { workspace, entity } = await createFullFixtureSet(db);

      await db.externalIdentity.create({
        workspace,
        source: 'backstage',
        external_key: 'component:default/foo',
        entity_id: entity
      });

      await expect(
        db.externalIdentity.create({
          workspace,
          source: 'backstage',
          external_key: 'component:default/foo',
          entity_id: entity
        })
      ).rejects.toThrow(DatabaseError);
    });

    it('keeps identities independent across workspaces', async () => {
      const db = getDb();
      const { workspace, entity } = await createFullFixtureSet(db);
      const otherWorkspace = await createFixtureWorkspace(db);

      await db.externalIdentity.create({
        workspace,
        source: 'backstage',
        external_key: 'component:default/foo',
        entity_id: entity
      });

      expect(
        await db.externalIdentity.find(otherWorkspace, 'backstage', 'component:default/foo')
      ).toBeNull();
    });
  });
});
