import {
  databaseBoolean,
  databaseDate,
  parseDatabaseJson,
  type DatabaseRow
} from '../../../db/rowMappers';
import type {
  AutomationAction,
  AutomationCondition,
  AutomationRuleTrigger
} from '@arch-register/api-types/automationRuleContract';

export type AutomationRuleDbResult = {
  id: string;
  workspace: string;
  name: string;
  description: string | null;
  schema_id: string | null;
  trigger: AutomationRuleTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

export type AutomationRuleDbCreate = AutomationRuleDbResult;
export type AutomationRuleDbUpdate = Omit<
  AutomationRuleDbResult,
  'id' | 'workspace' | 'created_at'
>;

export type AutomationRuleDatabase = {
  listRules(workspace: string): Promise<AutomationRuleDbResult[]>;
  getRule(workspace: string, id: string): Promise<AutomationRuleDbResult | null>;
  createRule(input: AutomationRuleDbCreate): Promise<AutomationRuleDbResult>;
  updateRule(
    workspace: string,
    id: string,
    input: AutomationRuleDbUpdate
  ): Promise<AutomationRuleDbResult | null>;
  deleteRule(workspace: string, id: string): Promise<boolean>;
};

export const automationRuleMapper = (row: DatabaseRow): AutomationRuleDbResult => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  name: String(row['name']),
  description: row['description'] == null ? null : String(row['description']),
  schema_id: row['schema_id'] == null ? null : String(row['schema_id']),
  trigger: parseDatabaseJson(row['trigger'], { kind: 'entity_created' }, 'automation_rule.trigger'),
  conditions: parseDatabaseJson(row['conditions'], [], 'automation_rule.conditions'),
  actions: parseDatabaseJson(row['actions'], [], 'automation_rule.actions'),
  enabled: databaseBoolean(row['enabled']),
  created_at: databaseDate(row['created_at']),
  updated_at: databaseDate(row['updated_at'])
});
