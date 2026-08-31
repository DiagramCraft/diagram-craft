import { describe, expect, it } from 'vitest';
import { governanceWorkflowConfigSchema } from '@arch-register/api-types/governanceCaseConfigSchemas';
import { FIELD_DATE_REMINDER_CASE_KIND } from '../../domain/catalog/fieldDateReminderJob';
import { encodeCaseSubkind } from '../../domain/governance/governanceCaseSubkind';
import { SEED_SCHEMA_IDS, TEAM_IDS, WORKSPACE_ID } from './constants';
import { seedGovernanceCaseConfigs } from './governanceCaseConfigs';

describe('governance workflow seed data', () => {
  it('provides valid examples for the supported non-field-date workflow kinds', () => {
    const sampleRows = seedGovernanceCaseConfigs.filter(
      row => row.case_kind !== FIELD_DATE_REMINDER_CASE_KIND
    );

    expect(new Set(sampleRows.map(row => row.case_kind))).toEqual(
      new Set([
        'entity.change-case',
        'entity.change-case.bulk',
        'entity.deprecation',
        'relation.change-case',
        'assessment.response',
        'conformance.violation'
      ])
    );

    for (const row of sampleRows) {
      expect(governanceWorkflowConfigSchema.safeParse(row.config).success, row.case_kind).toBe(
        true
      );
      expect(row.workspace).toBe(WORKSPACE_ID);
      expect(row.enabled).toBe(true);
    }

    expect(sampleRows.find(row => row.case_kind === 'entity.change-case')).toMatchObject({
      case_subkind: encodeCaseSubkind(SEED_SCHEMA_IDS.contract),
      config: {
        approvals: expect.objectContaining({
          requiredApprovals: 1,
          strategy: 'entity-owner-admin'
        })
      }
    });
    expect(sampleRows.find(row => row.case_kind === 'entity.change-case.bulk')).toMatchObject({
      case_subkind: null,
      config: {
        approvals: expect.objectContaining({
          requiredApprovals: 2,
          fallbackTeamIds: [TEAM_IDS.platform, TEAM_IDS.security]
        })
      }
    });
    expect(sampleRows.find(row => row.case_kind === 'entity.deprecation')).toMatchObject({
      case_subkind: encodeCaseSubkind(SEED_SCHEMA_IDS.technology)
    });
    expect(
      sampleRows
        .filter(row =>
          ['relation.change-case', 'assessment.response', 'conformance.violation'].includes(
            row.case_kind
          )
        )
        .every(row => row.case_subkind === null && row.config.reminders != null)
    ).toBe(true);
  });
});
