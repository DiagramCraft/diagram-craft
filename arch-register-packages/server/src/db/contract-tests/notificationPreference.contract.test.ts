import { describe, expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFixtureUser } from './authFixtures';
import { createFixtureWorkspace } from './projectFixtures';

runContractSuiteAgainstBothDrivers('NotificationPreferenceDatabase', getDb => {
  describe('notification delivery preferences', () => {
    it('has no overrides by default', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);

      expect(await db.notificationPreference.listOverrides(user.id, workspace)).toEqual([]);
    });

    it('stores and updates overrides scoped to the user and workspace', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const otherWorkspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);
      const otherUser = await createFixtureUser(db);

      await db.notificationPreference.setOverrides(user.id, workspace, [
        { notificationType: 'governance-case-activity', channel: 'in_app', enabled: false }
      ]);
      await db.notificationPreference.setOverrides(otherUser.id, workspace, [
        { notificationType: 'governance-case-activity', channel: 'in_app', enabled: true }
      ]);
      await db.notificationPreference.setOverrides(user.id, otherWorkspace, [
        { notificationType: 'governance-case-activity', channel: 'in_app', enabled: true }
      ]);

      const overrides = await db.notificationPreference.listOverrides(user.id, workspace);
      expect(overrides).toHaveLength(1);
      expect(overrides[0]).toMatchObject({
        user_id: user.id,
        workspace,
        notification_type: 'governance-case-activity',
        channel: 'in_app',
        enabled: false
      });

      // Updating the same (user, workspace, type, channel) replaces the prior value.
      await db.notificationPreference.setOverrides(user.id, workspace, [
        { notificationType: 'governance-case-activity', channel: 'in_app', enabled: true }
      ]);
      const updated = await db.notificationPreference.listOverrides(user.id, workspace);
      expect(updated).toHaveLength(1);
      expect(updated[0]?.enabled).toBe(true);
    });

    it('keeps independent overrides per notification type and channel', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);

      await db.notificationPreference.setOverrides(user.id, workspace, [
        { notificationType: 'governance-case-activity', channel: 'in_app', enabled: false },
        { notificationType: 'governance-proposal-reminder', channel: 'in_app', enabled: true },
        { notificationType: 'governance-case-activity', channel: 'email', enabled: true }
      ]);

      const overrides = await db.notificationPreference.listOverrides(user.id, workspace);
      expect(overrides).toHaveLength(3);
      expect(
        overrides.find(
          o => o.notification_type === 'governance-case-activity' && o.channel === 'in_app'
        )?.enabled
      ).toBe(false);
      expect(
        overrides.find(
          o => o.notification_type === 'governance-proposal-reminder' && o.channel === 'in_app'
        )?.enabled
      ).toBe(true);
      expect(
        overrides.find(
          o => o.notification_type === 'governance-case-activity' && o.channel === 'email'
        )?.enabled
      ).toBe(true);
    });
  });
});
