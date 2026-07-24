import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import {
  getNotificationPreferences,
  updateNotificationPreferences
} from './notificationPreferenceOperations';

const authCtxMock = {
  userId: 'user-1',
  globalPermissions: new Set(),
  workspaceRole: null,
  workspaceRoles: new Map(),
  teamRolesByTeam: new Map(),
  schemas: new Map(),
  entities: new Map(),
  grants: []
};

vi.mock('../auth/authorization', () => ({
  buildApiAuthCtx: vi.fn(async () => authCtxMock),
  requireWorkspaceCapability: vi.fn()
}));

vi.mock('../workspace/resolveWorkspace', () => ({
  resolveWorkspace: vi.fn(async () => 'ws-1')
}));

const event = { context: { user: { id: 'user-1' } } } as unknown as AuthenticatedEvent;

const makeDb = (overrides: { enabled: boolean }[] = []): DatabaseAdapter =>
  ({
    catalog: {},
    notificationPreference: {
      listOverrides: vi.fn(async () =>
        overrides.map(o => ({
          user_id: 'user-1',
          workspace: 'ws-1',
          notification_type: 'governance-case-activity',
          channel: 'in_app',
          enabled: o.enabled,
          updated_at: new Date()
        }))
      ),
      setOverrides: vi.fn(async () => {})
    }
  }) as unknown as DatabaseAdapter;

describe('getNotificationPreferences', () => {
  it('defaults normal types to in-app enabled and reminder types to in-app disabled', async () => {
    const db = makeDb();
    const result = await getNotificationPreferences(db, 'ws-1', event);

    const inAppFor = (notificationType: string) =>
      result.preferences.find(
        p => p.notificationType === notificationType && p.channel === 'in_app'
      );

    expect(inAppFor('entity-watch-activity')).toMatchObject({ enabled: true, isDefault: true });
    expect(inAppFor('governance-task-assigned')).toMatchObject({ enabled: true, isDefault: true });
    expect(inAppFor('governance-case-activity')).toMatchObject({ enabled: true, isDefault: true });
    expect(inAppFor('governance-proposal-reminder')).toMatchObject({
      enabled: false,
      isDefault: true
    });

    // Every notification type's non-in_app channels default to disabled; email is implemented.
    const email = result.channels.find(c => c.channel === 'email');
    expect(email).toMatchObject({ implemented: true });
  });

  it('reflects explicit overrides instead of the catalog default', async () => {
    const db = makeDb([{ enabled: false }]);
    const result = await getNotificationPreferences(db, 'ws-1', event);

    const override = result.preferences.find(
      p => p.notificationType === 'governance-case-activity' && p.channel === 'in_app'
    );
    expect(override).toMatchObject({ enabled: false, isDefault: false });
  });
});

describe('updateNotificationPreferences', () => {
  it('persists changes and returns the updated effective preferences', async () => {
    const db = makeDb([{ enabled: false }]);

    const result = await updateNotificationPreferences(db, 'ws-1', event, [
      { notificationType: 'governance-case-activity', channel: 'in_app', enabled: false }
    ]);

    expect(db.notificationPreference.setOverrides).toHaveBeenCalledWith('user-1', 'ws-1', [
      { notificationType: 'governance-case-activity', channel: 'in_app', enabled: false }
    ]);
    expect(
      result.preferences.find(
        p => p.notificationType === 'governance-case-activity' && p.channel === 'in_app'
      )
    ).toMatchObject({ enabled: false, isDefault: false });
  });

  it('rejects an unknown notification type or channel', async () => {
    const db = makeDb();

    await expect(
      updateNotificationPreferences(db, 'ws-1', event, [
        { notificationType: 'not-a-real-type', channel: 'in_app', enabled: true }
      ])
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      updateNotificationPreferences(db, 'ws-1', event, [
        { notificationType: 'governance-case-activity', channel: 'carrier-pigeon', enabled: true }
      ])
    ).rejects.toMatchObject({ status: 400 });
  });
});
