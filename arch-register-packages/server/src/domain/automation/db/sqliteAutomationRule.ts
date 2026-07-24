import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import type {
  AutomationRuleDatabase,
  AutomationRuleDbCreate,
  AutomationRuleDbUpdate
} from './automationRuleDatabase';
import { automationRuleMapper } from './automationRuleDatabase';

export class SqliteAutomationRuleDatabase
  extends SqliteDatabaseBase
  implements AutomationRuleDatabase
{
  async listRules(workspace: string) {
    return this.all(
      'SELECT * FROM workspace_automation_rule WHERE workspace = ? ORDER BY created_at, id',
      [workspace],
      automationRuleMapper
    );
  }

  async getRule(workspace: string, id: string) {
    return await this.get(
      'SELECT * FROM workspace_automation_rule WHERE workspace = ? AND id = ?',
      [workspace, id],
      automationRuleMapper
    );
  }

  async createRule(input: AutomationRuleDbCreate) {
    this.run(
      `INSERT INTO workspace_automation_rule
       (id, workspace, name, description, schema_id, trigger, conditions, actions, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.workspace,
        input.name,
        input.description,
        input.schema_id,
        JSON.stringify(input.trigger),
        JSON.stringify(input.conditions),
        JSON.stringify(input.actions),
        input.enabled ? 1 : 0,
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    return (await this.get(
      'SELECT * FROM workspace_automation_rule WHERE id = ?',
      [input.id],
      automationRuleMapper
    ))!;
  }

  async updateRule(workspace: string, id: string, input: AutomationRuleDbUpdate) {
    this.run(
      `UPDATE workspace_automation_rule
       SET name = ?, description = ?, schema_id = ?, trigger = ?, conditions = ?, actions = ?,
           enabled = ?, updated_at = ?
       WHERE workspace = ? AND id = ?`,
      [
        input.name,
        input.description,
        input.schema_id,
        JSON.stringify(input.trigger),
        JSON.stringify(input.conditions),
        JSON.stringify(input.actions),
        input.enabled ? 1 : 0,
        input.updated_at.toISOString(),
        workspace,
        id
      ]
    );
    return await this.getRule(workspace, id);
  }

  async deleteRule(workspace: string, id: string) {
    return (
      this.run('DELETE FROM workspace_automation_rule WHERE workspace = ? AND id = ?', [
        workspace,
        id
      ]).changes > 0
    );
  }
}
