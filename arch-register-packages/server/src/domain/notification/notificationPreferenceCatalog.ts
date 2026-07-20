import type { GovernanceEventType } from '../governance/db/governanceDatabase';

export type NotificationChannel = 'in_app' | 'email' | 'slack' | 'sms';

export const NOTIFICATION_CHANNEL_CATALOG: Record<
  NotificationChannel,
  { label: string; implemented: boolean }
> = {
  in_app: { label: 'In-app', implemented: true },
  email: { label: 'Email', implemented: true },
  slack: { label: 'Slack', implemented: false },
  sms: { label: 'SMS', implemented: false }
};

export const NOTIFICATION_CHANNELS = Object.keys(
  NOTIFICATION_CHANNEL_CATALOG
) as NotificationChannel[];

export type NotificationType =
  | 'entity-watch-activity'
  | 'comment-activity'
  | 'governance-task-assigned'
  | 'governance-case-activity'
  | 'governance-proposal-reminder';

export type NotificationTypeCategory = 'normal' | 'reminder';

export const NOTIFICATION_TYPE_CATALOG: Record<
  NotificationType,
  {
    label: string;
    description: string;
    category: NotificationTypeCategory;
    defaultChannels: NotificationChannel[];
  }
> = {
  'entity-watch-activity': {
    label: 'Watched entity activity',
    description: 'Changes to entities you watch.',
    category: 'normal',
    defaultChannels: ['in_app']
  },
  'comment-activity': {
    label: 'Comment activity',
    description: 'New comments on content and entities you own, or replies to your comments.',
    category: 'normal',
    defaultChannels: ['in_app']
  },
  'governance-task-assigned': {
    label: 'Governance tasks assigned',
    description: 'A governance review or approval is waiting on you.',
    category: 'normal',
    defaultChannels: ['in_app']
  },
  'governance-case-activity': {
    label: 'Governance case activity',
    description: 'Updates on governance cases you are involved in.',
    category: 'normal',
    defaultChannels: ['in_app']
  },
  'governance-proposal-reminder': {
    label: 'Stale proposal reminders',
    description: 'Reminders that a governed proposal needs attention.',
    category: 'reminder',
    defaultChannels: []
  }
};

export const NOTIFICATION_TYPES = Object.keys(NOTIFICATION_TYPE_CATALOG) as NotificationType[];

export const isNotificationChannel = (value: string): value is NotificationChannel =>
  Object.hasOwn(NOTIFICATION_CHANNEL_CATALOG, value);

export const isNotificationType = (value: string): value is NotificationType =>
  Object.hasOwn(NOTIFICATION_TYPE_CATALOG, value);

const GOVERNANCE_EVENT_TYPE_TO_NOTIFICATION_TYPE: Record<GovernanceEventType, NotificationType> = {
  submitted: 'governance-task-assigned',
  assigned: 'governance-case-activity',
  reassigned: 'governance-case-activity',
  changes_requested: 'governance-case-activity',
  resubmitted: 'governance-case-activity',
  approved: 'governance-case-activity',
  rejected: 'governance-case-activity',
  acknowledged: 'governance-case-activity',
  cancelled: 'governance-case-activity',
  admin_override: 'governance-case-activity',
  proposal_stale: 'governance-proposal-reminder',
  domain_effect_applied: 'governance-case-activity',
  domain_effect_failed: 'governance-case-activity',
  scope_refreshed: 'governance-case-activity',
  postponed: 'governance-case-activity',
  finalized: 'governance-case-activity',
  finalization_override: 'governance-case-activity'
};

export const notificationTypeForGovernanceEvent = (
  eventType: GovernanceEventType
): NotificationType => GOVERNANCE_EVENT_TYPE_TO_NOTIFICATION_TYPE[eventType];
