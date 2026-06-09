import { buildAuthorizationContext } from '@arch-register/permissions';
import { describe, expect, it } from 'vitest';
import { canAccessNotification } from './watchRoutes';
import { BaseEntity, EntitySchemaRow } from '../catalog/db/catalogDatabase';
import { UserNotificationRow } from './db/watchDatabase';

const now = new Date('2026-06-09T10:00:00.000Z');

const schema: EntitySchemaRow = {
  id: 'application',
  workspace: 'ws-1',
  name: 'Application',
  description: '',
  fields: [],
  color: null,
  icon: null,
  default_owner: null,
  created_at: now,
  updated_at: now
};

const entity: BaseEntity = {
  id: 'entity-1',
  workspace: 'ws-1',
  slug: 'payments-api',
  namespace: 'default',
  name: 'Payments API',
  description: '',
  owner: null,
  lifecycle: null,
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: [],
  links: [],
  schema_id: 'application',
  data: {},
  visibility_mode: 'restricted',
  created_at: now,
  updated_at: now
};

const notification: UserNotificationRow = {
  id: 'notification-1',
  user_id: 'user-1',
  workspace: 'ws-1',
  entity_id: entity.id,
  audit_log_id: 'audit-1',
  operation: 'delete',
  entity_name: entity.name,
  entity_slug: entity.slug,
  schema_id: entity.schema_id,
  changed_by_user_id: 'user-2',
  changed_by_display_name: 'Another User',
  timestamp: now,
  created_at: now
};

describe('watch route helpers', () => {
  it('hides notifications when the entity is no longer resolvable', () => {
    const authCtx = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: 'viewer',
      workspaceRoles: [],
      teamAssignments: [],
      teams: [],
      schemas: [schema],
      entities: [],
      grants: []
    });

    expect(canAccessNotification(authCtx, new Map(), notification)).toBe(false);
  });

  it('shows notifications only when the user still has view permission', () => {
    const publicEntity = { ...entity, visibility_mode: 'public' as const };
    const authCtx = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: 'viewer',
      workspaceRoles: [],
      teamAssignments: [],
      teams: [],
      schemas: [schema],
      entities: [publicEntity],
      grants: []
    });

    expect(
      canAccessNotification(authCtx, new Map([[publicEntity.id, publicEntity]]), notification)
    ).toBe(true);
  });
});
