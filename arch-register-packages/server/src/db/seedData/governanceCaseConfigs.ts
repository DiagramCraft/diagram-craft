import type { GovernanceCaseConfigDbUpsert } from '../../domain/governance/db/governanceCaseConfigDatabase';
import {
  ENTITY_CHANGE_CASE_BULK_KIND,
  ENTITY_CHANGE_CASE_KIND
} from '../../domain/catalog/entityChangeOperations';
import { ENTITY_DEPRECATION_CASE_KIND } from '../../domain/catalog/entityDeprecationOperations';
import { FIELD_DATE_REMINDER_CASE_KIND } from '../../domain/catalog/fieldDateReminderJob';
import { RELATION_CHANGE_CASE_KIND } from '../../domain/catalog/relationChangeOperations';
import { ASSESSMENT_RESPONSE_CASE_KIND } from '../../domain/project/assessmentGovernance';
import { CONFORMANCE_VIOLATION_CASE_KIND } from '../../domain/conformance/conformanceGovernance';
import { encodeCaseSubkind } from '../../domain/governance/governanceCaseSubkind';
import { ENTITY_OWNER_ADMIN_STRATEGY } from '../../domain/governance/schemaGovernancePolicy';
import { SEED_SCHEMA_IDS, TEAM_IDS, WORKSPACE_ID, now } from './constants';

/**
 * Representative governance case configuration for the demo workspace. The stewardship
 * `review_date` on the bundled Data Entity schema is turned into a recurring, routed, escalating
 * reminder: routed to the `steward` principal field, escalated to the same field 14 days overdue,
 * and advanced by one year each time the review is acknowledged. The other rows provide examples
 * of schema-scoped approval policies and workspace-wide reminder policies.
 */
export const seedGovernanceCaseConfigs: GovernanceCaseConfigDbUpsert[] = [
  {
    workspace: WORKSPACE_ID,
    case_kind: ENTITY_CHANGE_CASE_KIND,
    case_subkind: encodeCaseSubkind(SEED_SCHEMA_IDS.contract),
    enabled: true,
    config: {
      approvals: {
        requiredApprovals: 1,
        strategy: ENTITY_OWNER_ADMIN_STRATEGY,
        strategyConfig: {},
        fallbackUserIds: [],
        fallbackTeamIds: []
      },
      reminders: { enabled: true, approachingDays: [3, 1], overdueDays: [1, 7] },
      escalation: {
        enabled: true,
        overdueDays: 5,
        strategy: ENTITY_OWNER_ADMIN_STRATEGY,
        strategyConfig: {},
        fallbackUserIds: [],
        fallbackTeamIds: []
      },
      extensions: {}
    },
    updated_at: now,
    updated_by: null
  },
  {
    workspace: WORKSPACE_ID,
    case_kind: ENTITY_CHANGE_CASE_BULK_KIND,
    case_subkind: null,
    enabled: true,
    config: {
      approvals: {
        requiredApprovals: 2,
        strategy: ENTITY_OWNER_ADMIN_STRATEGY,
        strategyConfig: {},
        fallbackUserIds: [],
        fallbackTeamIds: [TEAM_IDS.platform, TEAM_IDS.security]
      },
      reminders: { enabled: true, approachingDays: [5, 2], overdueDays: [1, 7, 14] },
      escalation: {
        enabled: true,
        overdueDays: 7,
        strategy: ENTITY_OWNER_ADMIN_STRATEGY,
        strategyConfig: {},
        fallbackUserIds: [],
        fallbackTeamIds: [TEAM_IDS.security]
      },
      extensions: {}
    },
    updated_at: now,
    updated_by: null
  },
  {
    workspace: WORKSPACE_ID,
    case_kind: ENTITY_DEPRECATION_CASE_KIND,
    case_subkind: encodeCaseSubkind(SEED_SCHEMA_IDS.technology),
    enabled: true,
    config: {
      approvals: {
        requiredApprovals: 1,
        strategy: ENTITY_OWNER_ADMIN_STRATEGY,
        strategyConfig: {},
        fallbackUserIds: [],
        fallbackTeamIds: []
      },
      reminders: { enabled: true, approachingDays: [14, 3], overdueDays: [1, 7, 30] },
      escalation: {
        enabled: true,
        overdueDays: 10,
        strategy: ENTITY_OWNER_ADMIN_STRATEGY,
        strategyConfig: {},
        fallbackUserIds: [],
        fallbackTeamIds: []
      },
      extensions: {}
    },
    updated_at: now,
    updated_by: null
  },
  {
    workspace: WORKSPACE_ID,
    case_kind: RELATION_CHANGE_CASE_KIND,
    case_subkind: null,
    enabled: true,
    config: {
      reminders: { enabled: true, approachingDays: [7, 2], overdueDays: [1, 14] },
      extensions: {}
    },
    updated_at: now,
    updated_by: null
  },
  {
    workspace: WORKSPACE_ID,
    case_kind: ASSESSMENT_RESPONSE_CASE_KIND,
    case_subkind: null,
    enabled: true,
    config: {
      reminders: { enabled: true, approachingDays: [7, 2], overdueDays: [1, 7] },
      extensions: {}
    },
    updated_at: now,
    updated_by: null
  },
  {
    workspace: WORKSPACE_ID,
    case_kind: CONFORMANCE_VIOLATION_CASE_KIND,
    case_subkind: null,
    enabled: true,
    config: {
      reminders: { enabled: true, approachingDays: [3, 1], overdueDays: [1, 3, 7] },
      escalation: {
        enabled: true,
        overdueDays: 7,
        strategyConfig: {},
        fallbackUserIds: [],
        fallbackTeamIds: []
      },
      extensions: {}
    },
    updated_at: now,
    updated_by: null
  },
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
