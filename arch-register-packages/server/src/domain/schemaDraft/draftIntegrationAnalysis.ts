import { resolveEntityDrawerConfiguration } from '@arch-register/api-types/entityDrawerConfiguration';
import type { DatabaseAdapter } from '../../db/database';
import {
  isAutomationReadFieldKnown,
  isAutomationReadFieldKnownAcrossSchemas,
  isAutomationWriteFieldKnown,
  isAutomationWriteFieldKnownAcrossSchemas
} from '../automation/automationRuleFieldAccess';
import type { AutomationRuleDbResult } from '../automation/db/automationRuleDatabase';
import { createEntityDrawerQueryValidator } from '../workspace/entityDrawerQueryValidation';
import {
  validateWorkspaceCapabilityConfiguration,
  type CapabilityTargetResolver
} from '../workspace/workspaceCapabilityOperations';
import type { CatalogSnapshot, DraftCatalog } from './draftCatalog';
import type { DraftFinding } from './draftDependencyAnalyzer';
import type { SchemaDraftKind } from './db/schemaDraftDatabase';

const originOf = (
  catalog: DraftCatalog,
  kind: SchemaDraftKind,
  itemId: string
): DraftFinding['draftItem'] => {
  const change = catalog.changes.find(c => c.kind === kind && c.itemId === itemId);
  return { kind, itemId, name: change?.name ?? change?.liveName ?? null };
};

/** Fields a rule reads or writes, split by access, for the "unknown field" checks. */
const ruleFieldReferences = (rule: AutomationRuleDbResult) => {
  const reads: string[] = [];
  const writes: string[] = [];
  if (rule.trigger.kind === 'field_changed' || rule.trigger.kind === 'relation_field_changed') {
    reads.push(rule.trigger.field);
  }
  for (const condition of rule.conditions) reads.push(condition.field);
  for (const action of rule.actions) {
    if (action.kind === 'set_field_value') writes.push(action.field);
    else if (action.kind === 'send_notification' && action.recipient.kind === 'reference_owner') {
      reads.push(action.recipient.field);
    }
  }
  return { reads, writes };
};

/** Pure: automation rules whose scope or field references stop resolving in the draft catalog. */
export const analyzeAutomationRules = (
  catalog: DraftCatalog,
  rules: readonly AutomationRuleDbResult[]
): DraftFinding[] => {
  const findings: DraftFinding[] = [];
  const schemasOf = (snapshot: CatalogSnapshot, rule: AutomationRuleDbResult) => {
    const all = rule.resource_type === 'relation' ? snapshot.relationSchemas : snapshot.schemas;
    return rule.schema_id != null ? all.filter(s => s.id === rule.schema_id) : all;
  };

  for (const rule of rules) {
    const kind: SchemaDraftKind =
      rule.resource_type === 'relation' ? 'relation_schema' : 'entity_schema';
    const subject = { type: 'automation_rule', id: rule.id, name: rule.name };
    const liveSchemas = schemasOf(catalog.live, rule);
    const draftSchemas = schemasOf(catalog.draft, rule);

    if (rule.schema_id != null && liveSchemas.length > 0 && draftSchemas.length === 0) {
      findings.push({
        severity: 'blocking',
        category: 'automation_rule',
        draftItem: originOf(catalog, kind, rule.schema_id),
        subject,
        message: `Rule "${rule.name}" is scoped to a schema that is deleted in the draft`
      });
      continue;
    }

    const { reads, writes } = ruleFieldReferences(rule);
    const known = (snapshotSchemas: typeof liveSchemas, field: string, write: boolean) => {
      if (rule.schema_id != null) {
        return write
          ? isAutomationWriteFieldKnown(snapshotSchemas[0], field)
          : isAutomationReadFieldKnown(rule.resource_type, snapshotSchemas[0], field);
      }
      return write
        ? isAutomationWriteFieldKnownAcrossSchemas(snapshotSchemas, field)
        : isAutomationReadFieldKnownAcrossSchemas(rule.resource_type, snapshotSchemas, field);
    };
    const origin = rule.schema_id
      ? originOf(catalog, kind, rule.schema_id)
      : { kind, itemId: '', name: null };
    for (const [fields, write] of [
      [reads, false],
      [writes, true]
    ] as const) {
      for (const field of new Set(fields)) {
        if (known(liveSchemas, field, write) && !known(draftSchemas, field, write)) {
          findings.push({
            severity: 'blocking',
            category: 'automation_rule',
            draftItem: origin,
            subject,
            message: `Rule "${rule.name}" ${write ? 'writes' : 'reads'} field "${field}", which is no longer available`
          });
        }
      }
    }
  }
  return findings;
};

const targetResolver =
  (snapshot: CatalogSnapshot): CapabilityTargetResolver =>
  async target => {
    switch (target.kind) {
      case 'entity_schema':
        return snapshot.schemas.find(s => s.id === target.id) ?? null;
      case 'relation_schema':
        return snapshot.relationSchemas.find(s => s.id === target.id) ?? null;
      case 'document_type':
        return snapshot.documentTypes.find(s => s.id === target.id) ?? null;
    }
  };

/** Fields written by an AI, automation or integration; removing them breaks their writer. */
export const analyzeExternalFields = (catalog: DraftCatalog): DraftFinding[] => {
  const findings: DraftFinding[] = [];
  for (const live of catalog.live.schemas) {
    const draft = catalog.draft.schemas.find(s => s.id === live.id);
    for (const field of live.fields) {
      const externalKind = (field as { external_kind?: string }).external_kind;
      if (!externalKind) continue;
      const next = draft?.fields.find(f => f.id === field.id);
      if (next && next.type === field.type) continue;
      findings.push({
        severity: 'warning',
        category: 'external_field',
        draftItem: originOf(catalog, 'entity_schema', live.id),
        subject: { type: 'entity_schema', id: live.id, name: live.name },
        message: `Field "${field.name}" is managed by ${externalKind} and ${next ? 'changes type' : 'is removed'} in the draft`
      });
    }
  }
  return findings;
};

/**
 * Checks everything stored outside the schemas that references them — automation rules,
 * capability bindings and entity drawers — against the draft catalog. Read-only.
 */
export const analyzeDraftIntegrations = async (
  db: DatabaseAdapter,
  workspace: string,
  catalog: DraftCatalog
): Promise<DraftFinding[]> => {
  const [rules, capabilityConfigs, drawerRow] = await Promise.all([
    db.automationRule.listRules(workspace),
    db.workspace.listWorkspaceCapabilityConfigurations(workspace),
    db.workspace.getWorkspaceEntityDrawerConfiguration(workspace)
  ]);
  const findings: DraftFinding[] = [
    ...analyzeAutomationRules(catalog, rules),
    ...analyzeExternalFields(catalog)
  ];

  const liveResolver = targetResolver(catalog.live);
  const draftResolver = targetResolver(catalog.draft);
  for (const config of capabilityConfigs) {
    const input = { bindings: config.bindings };
    const [before, after] = await Promise.all([
      validateWorkspaceCapabilityConfiguration(db, workspace, config.type, input, liveResolver),
      validateWorkspaceCapabilityConfiguration(db, workspace, config.type, input, draftResolver)
    ]);
    const existing = new Set(before.map(d => d.message));
    for (const diagnostic of after.filter(d => !existing.has(d.message))) {
      const target = Object.values(config.bindings).find(b =>
        diagnostic.message.includes(`'${b.target.id}'`)
      )?.target;
      findings.push({
        severity: 'blocking',
        category: 'capability_binding',
        draftItem: target
          ? originOf(catalog, target.kind, target.id)
          : { kind: 'entity_schema', itemId: '', name: null },
        subject: { type: 'capability', id: config.type, name: config.type },
        message: diagnostic.message
      });
    }
  }

  if (drawerRow?.configuration != null) {
    const resolve = (snapshot: CatalogSnapshot) => {
      const validator = createEntityDrawerQueryValidator(
        {
          schemas: snapshot.schemas,
          enums: snapshot.enums,
          relationSchemas: snapshot.relationSchemas
        },
        null
      );
      return resolveEntityDrawerConfiguration(
        drawerRow.configuration,
        snapshot.schemas,
        capabilityConfigs,
        snapshot.relationSchemas.map(r => ({
          id: r.id,
          in: { schemaIds: r.in_schema_ids },
          out: { schemaIds: r.out_schema_ids }
        })),
        validator
      ).diagnostics;
    };
    const existing = new Set(resolve(catalog.live).map(d => d.message));
    for (const diagnostic of resolve(catalog.draft).filter(d => !existing.has(d.message))) {
      findings.push({
        severity: 'blocking',
        category: 'entity_drawer',
        draftItem: { kind: 'entity_schema', itemId: '', name: null },
        subject: { type: 'entity_drawer', id: 'entity-drawer', name: 'Entity drawers' },
        message: diagnostic.message
      });
    }
  }
  return findings;
};
