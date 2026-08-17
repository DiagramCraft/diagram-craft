import { randomUUID } from 'node:crypto';
import {
  getWorkspaceCapabilityDefinition,
  remapCapabilityFieldMappings,
  resolveCapabilityFieldMappings
} from '@arch-register/api-types/integrationCatalog';
import type {
  WorkspaceCapabilityConfiguration,
  WorkspaceCapabilityConfigurationInput,
  WorkspaceCapabilityBindings,
  WorkspaceCapabilityDiagnostic,
  WorkspaceCapabilityTarget
} from '@arch-register/api-types/workspaceCapabilityContract';
import type { DatabaseAdapter } from '../../db/database';
import type { WorkspaceCapabilityConfigurationDbResult } from './db/workspaceDatabase';
import { httpAssert } from '../../utils/httpAssert';

const toApiConfiguration = async (
  db: DatabaseAdapter,
  row: WorkspaceCapabilityConfigurationDbResult
): Promise<WorkspaceCapabilityConfiguration> => {
  const diagnostics = await validateWorkspaceCapabilityConfiguration(db, row.workspace, row.type, {
    bindings: row.bindings
  });

  return {
    id: row.id,
    workspace: row.workspace,
    type: row.type,
    bindings: row.bindings,
    valid: diagnostics.length === 0,
    diagnostics,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString()
  };
};

const getTarget = async (
  db: DatabaseAdapter,
  workspace: string,
  target: WorkspaceCapabilityTarget
) => {
  switch (target.kind) {
    case 'entity_schema':
      return await db.catalog.getSchema(workspace, target.id);
    case 'relation_schema':
      return await db.relation.getRelationSchema(workspace, target.id);
    case 'document_type':
      return await db.document.getDocumentType(workspace, target.id);
  }
};

const getTargetFields = (target: Awaited<ReturnType<typeof getTarget>>) =>
  target && 'fields' in target
    ? target.fields.map(field => ({
        id: field.id,
        type: field.type,
        archived: 'archived' in field ? field.archived : undefined,
        minCardinality: 'minCardinality' in field ? field.minCardinality : undefined,
        maxCardinality: 'maxCardinality' in field ? field.maxCardinality : undefined,
        schemaId: 'schemaId' in field ? field.schemaId : undefined,
        minCount: 'minCount' in field ? field.minCount : undefined,
        maxCount: 'maxCount' in field ? field.maxCount : undefined
      }))
    : [];

export const validateWorkspaceCapabilityConfiguration = async (
  db: DatabaseAdapter,
  workspace: string,
  type: string,
  input: WorkspaceCapabilityConfigurationInput
): Promise<WorkspaceCapabilityDiagnostic[]> => {
  const definition = getWorkspaceCapabilityDefinition(type);
  if (!definition) {
    return [{ code: 'unknown_capability', message: `Capability '${type}' is not available.` }];
  }

  const diagnostics: WorkspaceCapabilityDiagnostic[] = [];
  const rolesById = new Map(definition.bindingRoles.map(role => [role.id, role]));

  for (const bindingId of Object.keys(input.bindings)) {
    if (!rolesById.has(bindingId)) {
      diagnostics.push({
        code: 'unknown_binding',
        bindingId,
        message: `Capability configuration contains unknown binding '${bindingId}'.`
      });
    }
  }

  for (const role of definition.bindingRoles) {
    const binding = input.bindings[role.id];
    if (!binding) {
      if (role.required) {
        diagnostics.push({
          code: 'missing_binding',
          bindingId: role.id,
          message: `Capability configuration is missing required binding '${role.label}'.`
        });
      }
      continue;
    }

    if (binding.target.kind !== role.targetKind) {
      diagnostics.push({
        code: 'wrong_target_kind',
        bindingId: role.id,
        message: `Binding '${role.label}' must target '${role.targetKind}'.`
      });
      continue;
    }

    const target = await getTarget(db, workspace, binding.target);
    if (!target) {
      diagnostics.push({
        code: 'unknown_target',
        bindingId: role.id,
        message: `Binding '${role.label}' references unknown ${binding.target.kind} '${binding.target.id}'.`
      });
      continue;
    }

    const resolution = resolveCapabilityFieldMappings(
      binding,
      role.fieldRoles,
      getTargetFields(target)
    );
    for (const issue of resolution.issues) {
      diagnostics.push({
        code: 'invalid_field_mapping',
        bindingId: role.id,
        message: issue.message
      });
    }

    for (const fieldRole of role.fieldRoles) {
      if (fieldRole.referenceTargetBinding === undefined) continue;
      const fieldId = resolution.mappings[fieldRole.id];
      const field = getTargetFields(target).find(candidate => candidate.id === fieldId);
      const referencedBinding = input.bindings[fieldRole.referenceTargetBinding];
      if (field?.type !== 'reference' || !referencedBinding) continue;
      if (field.schemaId !== referencedBinding.target.id) {
        diagnostics.push({
          code: 'invalid_field_mapping',
          bindingId: role.id,
          message: `Field '${fieldId}' must reference the '${fieldRole.referenceTargetBinding}' binding target.`
        });
      }
    }
  }

  const termTarget = input.bindings.term?.target;
  const categoryTarget = input.bindings.category?.target;
  if (
    termTarget &&
    categoryTarget &&
    termTarget.kind === 'entity_schema' &&
    categoryTarget.kind === 'entity_schema' &&
    termTarget.id === categoryTarget.id
  ) {
    diagnostics.push({
      code: 'invalid_field_mapping',
      bindingId: 'category',
      message: 'Term and category bindings must target different entity schemas.'
    });
  }

  return diagnostics;
};

export const listWorkspaceCapabilityConfigurations = async (
  db: DatabaseAdapter,
  workspace: string
) => {
  const rows = await db.workspace.listWorkspaceCapabilityConfigurations(workspace);
  return await Promise.all(rows.map(row => toApiConfiguration(db, row)));
};

export const getWorkspaceCapabilityConfiguration = async (
  db: DatabaseAdapter,
  workspace: string,
  type: string
) => {
  const row = await db.workspace.getWorkspaceCapabilityConfiguration(workspace, type);
  return row ? await toApiConfiguration(db, row) : null;
};

export const upsertWorkspaceCapabilityConfiguration = async (
  db: DatabaseAdapter,
  workspace: string,
  type: string,
  input: WorkspaceCapabilityConfigurationInput
) => {
  const diagnostics = await validateWorkspaceCapabilityConfiguration(db, workspace, type, input);
  httpAssert.true(diagnostics.length === 0, {
    status: 400,
    message: diagnostics.map(diagnostic => diagnostic.message).join(' ')
  });

  const existing = await db.workspace.getWorkspaceCapabilityConfiguration(workspace, type);
  const now = new Date();
  const row = await db.workspace.upsertWorkspaceCapabilityConfiguration({
    id: existing?.id ?? randomUUID(),
    workspace,
    type,
    bindings: input.bindings,
    created_at: existing?.created_at ?? now,
    updated_at: now
  });
  return await toApiConfiguration(db, row);
};

export const deleteWorkspaceCapabilityConfiguration = async (
  db: DatabaseAdapter,
  workspace: string,
  type: string
) => {
  const deleted = await db.workspace.deleteWorkspaceCapabilityConfiguration(workspace, type);
  httpAssert.present(deleted, {
    status: 404,
    message: `Capability configuration '${type}' not found`
  });
  return await toApiConfiguration(db, deleted!);
};

export const resolveWorkspaceCapabilityBinding = async (
  db: DatabaseAdapter,
  workspace: string,
  type: string,
  target: WorkspaceCapabilityTarget
) => {
  const configuration = await getWorkspaceCapabilityConfiguration(db, workspace, type);
  if (!configuration) return null;

  const definition = getWorkspaceCapabilityDefinition(type);
  if (!definition) return null;

  const roleById = new Map(definition.bindingRoles.map(role => [role.id, role]));
  for (const [bindingId, binding] of Object.entries(configuration.bindings)) {
    const role = roleById.get(bindingId);
    if (role && binding.target.kind === target.kind && binding.target.id === target.id) {
      return { binding, role, configuration };
    }
  }
  return null;
};

export const remapWorkspaceCapabilityFieldMappings = async (
  db: DatabaseAdapter,
  workspace: string,
  target: WorkspaceCapabilityTarget,
  renames: ReadonlyArray<{ oldFieldId: string; newFieldId: string }>,
  updatedAt: Date
) => {
  if (renames.length === 0) return;

  const configurations = await db.workspace.listWorkspaceCapabilityConfigurations(workspace);
  for (const configuration of configurations) {
    const definition = getWorkspaceCapabilityDefinition(configuration.type);
    if (!definition) continue;
    const roleById = new Map(definition.bindingRoles.map(role => [role.id, role]));
    let changed = false;
    const bindings = Object.fromEntries(
      Object.entries(configuration.bindings).map(([bindingId, binding]) => {
        const role = roleById.get(bindingId);
        if (!role || binding.target.kind !== target.kind || binding.target.id !== target.id) {
          return [bindingId, binding];
        }
        const nextBinding = remapCapabilityFieldMappings(binding, role.fieldRoles, renames);
        changed ||= nextBinding !== binding;
        return [bindingId, nextBinding];
      })
    ) as WorkspaceCapabilityBindings;
    if (!changed) continue;
    await db.workspace.upsertWorkspaceCapabilityConfiguration({
      ...configuration,
      bindings,
      updated_at: updatedAt
    });
  }
};
