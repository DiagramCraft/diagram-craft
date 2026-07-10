import { describe, expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFixtureEntity, createFixtureSchema, createFixtureWorkspace } from './projectFixtures';
import { createFixtureUser } from './authFixtures';

runContractSuiteAgainstBothDrivers('WatchDatabase', getDb => {
  describe('watches', () => {
    it('creates, reads and deletes a watch', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureEntity(db, workspace, schema);
      const user = await createFixtureUser(db);

      const created = await db.watch.createWatch({
        user_id: user.id,
        workspace,
        entity_id: entity.id,
        created_at: new Date()
      });
      expect(created.created_at).toBeInstanceOf(Date);

      const fetched = await db.watch.getWatch(user.id, workspace, entity.id);
      expect(fetched).not.toBeNull();

      expect(await db.watch.listWatcherUserIds(workspace, entity.id)).toEqual([user.id]);

      const deleted = await db.watch.deleteWatch(user.id, workspace, entity.id);
      expect(deleted).not.toBeNull();
      expect(await db.watch.getWatch(user.id, workspace, entity.id)).toBeNull();
    });

    it('creating the same watch twice is idempotent and does not error', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureEntity(db, workspace, schema);
      const user = await createFixtureUser(db);

      const input = {
        user_id: user.id,
        workspace,
        entity_id: entity.id,
        created_at: new Date()
      };
      await db.watch.createWatch(input);
      await db.watch.createWatch(input);

      const watches = await db.watch.listWatches(user.id, workspace);
      expect(watches.filter(w => w.entity_id === entity.id)).toHaveLength(1);
    });
  });

  describe('notifications from audit events', () => {
    it('fans out a notification to every watcher except the actor', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureEntity(db, workspace, schema);
      const actor = await createFixtureUser(db);
      const watcherA = await createFixtureUser(db);
      const watcherB = await createFixtureUser(db);

      for (const user of [actor, watcherA, watcherB]) {
        await db.watch.createWatch({
          user_id: user.id,
          workspace,
          entity_id: entity.id,
          created_at: new Date()
        });
      }

      const auditLog = await db.audit.createAuditLog({
        workspace,
        timestamp: new Date(),
        user_id: actor.id,
        operation: 'update',
        entity_type: 'entity',
        entity_id: entity.id,
        entity_name: entity.name,
        entity_slug: entity.slug,
        schema_id: schema,
        changes: {},
        metadata: {}
      });

      await db.watch.createNotificationsFromAudit({
        auditLog,
        changedByDisplayName: actor.display_name
      });

      const notificationsA = await db.watch.listNotifications(watcherA.id, workspace);
      const notificationsB = await db.watch.listNotifications(watcherB.id, workspace);
      const notificationsActor = await db.watch.listNotifications(actor.id, workspace);

      expect(notificationsA).toHaveLength(1);
      expect(notificationsB).toHaveLength(1);
      expect(notificationsActor).toHaveLength(0);
      expect(notificationsA[0]!.entity_slug).toBe(entity.slug);
    });

    it('falls back to entity_id for entity_slug when the audit log has no slug', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureEntity(db, workspace, schema);
      const watcher = await createFixtureUser(db);
      const actor = await createFixtureUser(db);

      await db.watch.createWatch({
        user_id: watcher.id,
        workspace,
        entity_id: entity.id,
        created_at: new Date()
      });

      const auditLog = await db.audit.createAuditLog({
        workspace,
        timestamp: new Date(),
        user_id: actor.id,
        operation: 'create',
        entity_type: 'entity',
        entity_id: entity.id,
        entity_name: entity.name,
        entity_slug: null,
        schema_id: null,
        changes: {},
        metadata: {}
      });

      await db.watch.createNotificationsFromAudit({
        auditLog,
        changedByDisplayName: actor.display_name
      });

      const notifications = await db.watch.listNotifications(watcher.id, workspace);
      expect(notifications).toHaveLength(1);
      expect(notifications[0]!.entity_slug).toBe(entity.id);
    });

    it('clears all notifications for a user', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const schema = await createFixtureSchema(db, workspace);
      const entity = await createFixtureEntity(db, workspace, schema);
      const watcher = await createFixtureUser(db);
      const actor = await createFixtureUser(db);

      await db.watch.createWatch({
        user_id: watcher.id,
        workspace,
        entity_id: entity.id,
        created_at: new Date()
      });

      const auditLog = await db.audit.createAuditLog({
        workspace,
        timestamp: new Date(),
        user_id: actor.id,
        operation: 'create',
        entity_type: 'entity',
        entity_id: entity.id,
        entity_name: entity.name,
        entity_slug: entity.slug,
        schema_id: null,
        changes: {},
        metadata: {}
      });
      await db.watch.createNotificationsFromAudit({
        auditLog,
        changedByDisplayName: actor.display_name
      });

      const cleared = await db.watch.clearNotifications(watcher.id, workspace);
      expect(cleared).toBe(1);
      expect(await db.watch.listNotifications(watcher.id, workspace)).toHaveLength(0);
    });
  });
});
