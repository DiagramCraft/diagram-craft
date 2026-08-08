import { describe, expect, it } from 'vitest';
import { resolveGovernanceWorkflowConfig } from './governanceWorkflowConfig';

const defaults = {
  reminders: { enabled: true, approachingDays: [2], overdueDays: [1] },
  escalation: {
    enabled: true,
    overdueDays: 5,
    strategyConfig: {},
    fallbackUserIds: [],
    fallbackTeamIds: []
  },
  extensions: {}
};

describe('resolveGovernanceWorkflowConfig', () => {
  it('prefers a subkind row and inherits unspecified components', () => {
    const result = resolveGovernanceWorkflowConfig(
      [
        {
          case_subkind: null,
          enabled: true,
          config: {
            reminders: { enabled: true, approachingDays: [3], overdueDays: [2] }
          }
        },
        {
          case_subkind: 'schema-1',
          enabled: false,
          config: {
            approvals: { requiredApprovals: 2, fallbackUserIds: [], fallbackTeamIds: [] }
          }
        }
      ],
      'schema-1',
      defaults
    );

    expect(result.enabled).toBe(false);
    expect(result.source).toBe('subkind');
    expect(result.config.reminders?.approachingDays).toEqual([3]);
    expect(result.config.approvals?.requiredApprovals).toBe(2);
  });

  it('does not erase code defaults for an unrelated component', () => {
    const result = resolveGovernanceWorkflowConfig(
      [{ case_subkind: null, enabled: true, config: { approvals: { requiredApprovals: 2 } } }],
      null,
      defaults
    );

    expect(result.config.approvals?.requiredApprovals).toBe(2);
    expect(result.config.reminders?.overdueDays).toEqual([1]);
    expect(result.config.escalation?.overdueDays).toBe(5);
  });

  it('does not apply workspace rows to kinds that are subkind-only', () => {
    const result = resolveGovernanceWorkflowConfig(
      [
        {
          case_subkind: null,
          enabled: false,
          config: { reminders: { enabled: false, approachingDays: [], overdueDays: [] } }
        }
      ],
      'document-type:status',
      defaults,
      false
    );

    expect(result.enabled).toBe(true);
    expect(result.source).toBe('default');
    expect(result.config.reminders?.approachingDays).toEqual([2]);
  });
});
