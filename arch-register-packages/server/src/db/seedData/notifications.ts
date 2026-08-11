import type { AuditOperation } from '../../domain/audit/db/auditDatabase';
import { LIFECYCLE_IDS, USER_IDS, WORKSPACE2_ID, WORKSPACE_ID } from './constants';

export const seedUserWatches = [
  {
    user_id: USER_IDS.globaladmin,
    workspace: WORKSPACE_ID,
    entity_id: '00000000-0000-0000-0002-000000000001',
    created_at: new Date('2026-01-02T09:00:00.000Z')
  },
  {
    user_id: USER_IDS.globaladmin,
    workspace: WORKSPACE_ID,
    entity_id: '00000000-0000-0000-0004-000000000001',
    created_at: new Date('2026-01-02T09:05:00.000Z')
  },
  {
    user_id: USER_IDS.globaladmin,
    workspace: WORKSPACE_ID,
    entity_id: '00000000-0000-0000-0003-000000000003',
    created_at: new Date('2026-01-02T09:10:00.000Z')
  },
  {
    user_id: USER_IDS.globaladmin,
    workspace: WORKSPACE2_ID,
    entity_id: '00000000-0000-0000-0011-000000000001',
    created_at: new Date('2026-01-07T09:00:00.000Z')
  },
  {
    user_id: USER_IDS.globaladmin,
    workspace: WORKSPACE2_ID,
    entity_id: '00000000-0000-0000-0012-000000000001',
    created_at: new Date('2026-01-07T09:05:00.000Z')
  },
  {
    user_id: USER_IDS.globaladmin,
    workspace: WORKSPACE2_ID,
    entity_id: '00000000-0000-0000-0012-000000000002',
    created_at: new Date('2026-01-07T09:10:00.000Z')
  }
] as const;

export const seedNotificationEvents: Array<{
  workspace: string;
  timestamp: Date;
  user_id: string;
  operation: AuditOperation;
  entity_id: string;
  entity_name: string;
  entity_slug: string;
  schema_id: string;
  changed_by_display_name: string;
  changes: {
    old?: Record<string, unknown>;
    new?: Record<string, unknown>;
  };
}> = [
  {
    workspace: WORKSPACE_ID,
    timestamp: new Date('2026-01-03T08:15:00.000Z'),
    user_id: USER_IDS.workspaceeditor,
    operation: 'update',
    entity_id: '00000000-0000-0000-0002-000000000001',
    entity_name: 'Customer Portal',
    entity_slug: 'customer-portal',
    schema_id: '00000000-0000-0000-0000-000000000002',
    changed_by_display_name: 'Raj Patel',
    changes: {
      old: { _description: 'Public-facing portal for customer self-service.' },
      new: { _description: 'Public-facing portal for customer self-service with a refreshed IA.' }
    }
  },
  {
    workspace: WORKSPACE_ID,
    timestamp: new Date('2026-01-04T11:40:00.000Z'),
    user_id: USER_IDS.platformteamadmin,
    operation: 'update',
    entity_id: '00000000-0000-0000-0004-000000000001',
    entity_name: 'Customer API',
    entity_slug: 'customer-api',
    schema_id: '00000000-0000-0000-0000-000000000004',
    changed_by_display_name: 'Daniel Okonkwo',
    changes: {
      old: { _tags: ['rest', 'public'] },
      new: { _tags: ['rest', 'public', 'versioned'] }
    }
  },
  {
    workspace: WORKSPACE_ID,
    timestamp: new Date('2026-01-05T13:05:00.000Z'),
    user_id: USER_IDS.securityteamadmin,
    operation: 'update',
    entity_id: '00000000-0000-0000-0003-000000000003',
    entity_name: 'Auth Service',
    entity_slug: 'auth-service',
    schema_id: '00000000-0000-0000-0000-000000000003',
    changed_by_display_name: 'Lena Hoffmann',
    changes: {
      old: { _targetLifecycle: LIFECYCLE_IDS.production },
      new: { _targetLifecycle: LIFECYCLE_IDS.deprecated }
    }
  },
  {
    workspace: WORKSPACE_ID,
    timestamp: new Date('2026-01-06T09:20:00.000Z'),
    user_id: USER_IDS.workspaceadmin,
    operation: 'update',
    entity_id: '00000000-0000-0000-0002-000000000001',
    entity_name: 'Customer Portal',
    entity_slug: 'customer-portal',
    schema_id: '00000000-0000-0000-0000-000000000002',
    changed_by_display_name: 'James Chen',
    changes: {
      old: { _targetLifecycleDate: '2026-12-31' },
      new: { _targetLifecycleDate: '2027-03-31' }
    }
  },
  {
    workspace: WORKSPACE2_ID,
    timestamp: new Date('2026-01-07T10:15:00.000Z'),
    user_id: USER_IDS.platformteamadmin,
    operation: 'update',
    entity_id: '00000000-0000-0000-0011-000000000001',
    entity_name: 'Mobile App',
    entity_slug: 'mobile-app',
    schema_id: '00000000-0000-0000-0000-000000000011',
    changed_by_display_name: 'Daniel Okonkwo',
    changes: {
      old: { _description: 'Cross-platform mobile application for iOS and Android.' },
      new: { _description: 'Cross-platform mobile application with refreshed onboarding flows.' }
    }
  },
  {
    workspace: WORKSPACE2_ID,
    timestamp: new Date('2026-01-07T11:30:00.000Z'),
    user_id: USER_IDS.designteamadmin,
    operation: 'update',
    entity_id: '00000000-0000-0000-0012-000000000001',
    entity_name: 'Notifications Service',
    entity_slug: 'notifications-service',
    schema_id: '00000000-0000-0000-0000-000000000012',
    changed_by_display_name: 'Marcus Berg',
    changes: {
      old: { technology: 'Node' },
      new: { technology: 'Node 22' }
    }
  },
  {
    workspace: WORKSPACE2_ID,
    timestamp: new Date('2026-01-07T13:45:00.000Z'),
    user_id: USER_IDS.workspaceeditor,
    operation: 'update',
    entity_id: '00000000-0000-0000-0012-000000000002',
    entity_name: 'Delivery Service',
    entity_slug: 'delivery-service',
    schema_id: '00000000-0000-0000-0000-000000000012',
    changed_by_display_name: 'Raj Patel',
    changes: {
      old: { _tags: ['worker'] },
      new: { _tags: ['worker', 'messaging'] }
    }
  },
  {
    workspace: WORKSPACE2_ID,
    timestamp: new Date('2026-01-08T08:20:00.000Z'),
    user_id: USER_IDS.workspaceadmin,
    operation: 'update',
    entity_id: '00000000-0000-0000-0012-000000000001',
    entity_name: 'Notifications Service',
    entity_slug: 'notifications-service',
    schema_id: '00000000-0000-0000-0000-000000000012',
    changed_by_display_name: 'James Chen',
    changes: {
      old: { _targetLifecycleDate: '2026-09-01' },
      new: { _targetLifecycleDate: '2026-10-15' }
    }
  }
];
