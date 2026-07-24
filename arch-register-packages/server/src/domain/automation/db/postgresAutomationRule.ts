import type { PostgresSqlClient } from '../../../db/postgresBase';
import type {
  AutomationRuleDatabase,
  AutomationRuleDbCreate,
  AutomationRuleDbUpdate
} from './automationRuleDatabase';
import { automationRuleMapper } from './automationRuleDatabase';
import type { DatabaseRow } from '../../../db/rowMappers';

export class PostgresAutomationRuleDatabase implements AutomationRuleDatabase {
  constructor(private readonly sql: PostgresSqlClient) {}

  async listRules(workspace: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM workspace_automation_rule WHERE workspace = ${workspace} ORDER BY created_at, id
    `;
    return rows.map(automationRuleMapper);
  }

  async getRule(workspace: string, id: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM workspace_automation_rule WHERE workspace = ${workspace} AND id = ${id}
    `;
    return rows[0] ? automationRuleMapper(rows[0]) : null;
  }

  private json(value: unknown) {
    return this.sql.json(value as Parameters<PostgresSqlClient['json']>[0]);
  }

  async createRule(input: AutomationRuleDbCreate) {
    const rows = await this.sql<DatabaseRow[]>`
      INSERT INTO workspace_automation_rule
        (id, workspace, name, description, schema_id, trigger, conditions, actions, enabled, created_at, updated_at)
      VALUES (
        ${input.id}, ${input.workspace}, ${input.name}, ${input.description}, ${input.schema_id},
        ${this.json(input.trigger)}, ${this.json(input.conditions)}, ${this.json(input.actions)},
        ${input.enabled}, ${input.created_at}, ${input.updated_at}
      )
      RETURNING *
    `;
    return automationRuleMapper(rows[0]!);
  }

  async updateRule(workspace: string, id: string, input: AutomationRuleDbUpdate) {
    const rows = await this.sql<DatabaseRow[]>`
      UPDATE workspace_automation_rule
      SET name = ${input.name}, description = ${input.description}, schema_id = ${input.schema_id},
          trigger = ${this.json(input.trigger)}, conditions = ${this.json(input.conditions)},
          actions = ${this.json(input.actions)}, enabled = ${input.enabled},
          updated_at = ${input.updated_at}
      WHERE workspace = ${workspace} AND id = ${id}
      RETURNING *
    `;
    return rows[0] ? automationRuleMapper(rows[0]) : null;
  }

  async deleteRule(workspace: string, id: string) {
    const rows = await this.sql<{ id: string }[]>`
      DELETE FROM workspace_automation_rule WHERE workspace = ${workspace} AND id = ${id} RETURNING id
    `;
    return rows.length > 0;
  }
}
