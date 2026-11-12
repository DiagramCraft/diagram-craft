import { describe, expect, it } from 'vitest';
import { applyDraftItems, type CatalogSnapshot } from './draftCatalog';
import { analyzeAutomationRules, analyzeExternalFields } from './draftIntegrationAnalysis';
import type { SchemaDbResult } from '../catalog/db/catalogDatabase';
import type { AutomationRuleDbResult } from '../automation/db/automationRuleDatabase';

const now = new Date('2026-01-01T00:00:00Z');
const options = { workspace: 'ws', teamIds: new Set<string>(), now };

const schema: SchemaDbResult = {
  id: 'a',
  workspace: 'ws',
  name: 'A',
  description: '',
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'AAA',
  version: 1,
  created_at: now,
  updated_at: now,
  fields: [
    { id: 'f', name: 'F', type: 'text' },
    { id: 'ext', name: 'Ext', type: 'text', external_kind: 'ai' }
  ] as never
};
const live: CatalogSnapshot = {
  schemas: [schema],
  relationSchemas: [],
  documentTypes: [],
  enums: [],
  fieldGroups: [],
  categories: []
};

const rule = (over: Partial<AutomationRuleDbResult>): AutomationRuleDbResult => ({
  id: 'r',
  workspace: 'ws',
  created_by: null,
  name: 'Rule',
  description: null,
  resource_type: 'entity',
  schema_id: 'a',
  trigger: { kind: 'field_changed', field: 'f' } as never,
  conditions: [],
  actions: [{ kind: 'set_field_value', field: 'f', value: 'x' } as never],
  enabled: true,
  created_at: now,
  updated_at: now,
  ...over
});

const withoutField = () =>
  applyDraftItems(
    live,
    [
      {
        kind: 'entity_schema',
        item_id: 'a',
        op: 'update',
        payload: { name: 'A', fields: [{ id: 'other', name: 'Other', type: 'text' }] }
      }
    ],
    options
  );

describe('analyzeAutomationRules', () => {
  it('reports rules that reference a removed field', () => {
    const findings = analyzeAutomationRules(withoutField(), [rule({})]);
    expect(findings.map(f => f.category)).toEqual(['automation_rule', 'automation_rule']);
    expect(findings[0]?.message).toContain('"f"');
  });

  it('reports rules scoped to a deleted schema once', () => {
    const catalog = applyDraftItems(
      live,
      [{ kind: 'entity_schema', item_id: 'a', op: 'delete', payload: null }],
      options
    );
    expect(analyzeAutomationRules(catalog, [rule({})])).toHaveLength(1);
  });

  it('ignores rules that are unaffected', () => {
    const catalog = applyDraftItems(live, [], options);
    expect(analyzeAutomationRules(catalog, [rule({})])).toEqual([]);
  });
});

describe('analyzeExternalFields', () => {
  it('warns when an externally managed field is removed', () => {
    const findings = analyzeExternalFields(withoutField());
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: 'warning', category: 'external_field' });
  });
});
