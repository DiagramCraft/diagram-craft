import { describe, expect, it } from 'vitest';
import { notificationTypeForGovernanceEvent } from './notificationPreferenceCatalog';

describe('notificationTypeForGovernanceEvent', () => {
  it('maps a manually-triggered reminder to the manual reminder type', () => {
    expect(
      notificationTypeForGovernanceEvent('reminder_sent', {
        trigger: 'manual',
        actor_user_id: 'u1'
      })
    ).toBe('governance-deadline-reminder');
  });

  it('maps a reminder_sent event with no metadata to the manual reminder type', () => {
    expect(notificationTypeForGovernanceEvent('reminder_sent')).toBe(
      'governance-deadline-reminder'
    );
  });

  it('maps a scheduled approaching-window reminder to the approaching type', () => {
    expect(
      notificationTypeForGovernanceEvent('reminder_sent', {
        trigger: 'scheduled',
        window: 'approaching:2'
      })
    ).toBe('governance-deadline-approaching');
  });

  it('maps a scheduled overdue-window reminder to the overdue type', () => {
    expect(
      notificationTypeForGovernanceEvent('reminder_sent', {
        trigger: 'scheduled',
        window: 'overdue:1'
      })
    ).toBe('governance-deadline-overdue');
  });

  it('maps unrelated event types unaffected by metadata', () => {
    expect(notificationTypeForGovernanceEvent('submitted')).toBe('governance-task-assigned');
    expect(notificationTypeForGovernanceEvent('approved')).toBe('governance-case-activity');
    expect(notificationTypeForGovernanceEvent('proposal_stale')).toBe(
      'governance-proposal-reminder'
    );
  });

  it('maps an escalated event to the escalation type', () => {
    expect(notificationTypeForGovernanceEvent('escalated')).toBe('governance-deadline-escalated');
  });
});
