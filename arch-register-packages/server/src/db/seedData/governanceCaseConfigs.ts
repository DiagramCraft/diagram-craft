import type { GovernanceCaseConfigDbUpsert } from '../../domain/governance/db/governanceCaseConfigDatabase';
import { FIELD_DATE_REMINDER_CASE_KIND } from '../../domain/catalog/fieldDateReminderJob';
import { encodeCaseSubkind } from '../../domain/governance/governanceCaseSubkind';
import { SEED_SCHEMA_IDS, WORKSPACE_ID, now } from './constants';

/**
 * Out-of-the-box governance case configuration. The stewardship `review_date` on the bundled
 * Data Entity schema is turned into a recurring, routed, escalating reminder: routed to the
 * `steward` principal field, escalated to the same field 14 days overdue, and advanced by one
 * year each time the review is acknowledged.
 */
export const seedGovernanceCaseConfigs: GovernanceCaseConfigDbUpsert[] = [
  {
    workspace: WORKSPACE_ID,
    case_kind: FIELD_DATE_REMINDER_CASE_KIND,
    case_subkind: encodeCaseSubkind(SEED_SCHEMA_IDS.dataEntity, 'review_date'),
    enabled: true,
    config: {
      reminders: { enabled: true, approachingDays: [7, 1], overdueDays: [1, 7, 30] },
      approvals: {
        requiredApprovals: 1,
        strategy: 'entity-principal-field',
        strategyConfig: { fieldId: 'steward' },
        fallbackUserIds: [],
        fallbackTeamIds: []
      },
      escalation: {
        enabled: true,
        overdueDays: 14,
        strategy: 'entity-principal-field',
        strategyConfig: { fieldId: 'steward' },
        fallbackUserIds: [],
        fallbackTeamIds: []
      },
      extensions: {
        completionAdvance: { amount: 1, unit: 'years' }
      }
    },
    updated_at: now,
    updated_by: null
  }
];
