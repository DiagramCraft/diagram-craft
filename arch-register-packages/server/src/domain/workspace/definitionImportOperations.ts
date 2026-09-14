import type {
  DefinitionImportDependencyMapping,
  DefinitionImportExecuteRequest,
  DefinitionImportExecuteResponse,
  DefinitionImportRename,
  DefinitionImportSelection,
  DefinitionImportSource
} from '@arch-register/api-types/workspaceContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { requireWorkspaceAdmin } from '../auth/authorization';
import { runAuthorizedOperation } from '../operation';
import { httpAssert } from '../../utils/httpAssert';
import {
  SCHEMA_TEMPLATES,
  canAdministerDefinitionImportSource,
  loadDefinitionImportSource,
  sourceFromBuiltin,
  sourceFromWorkspace,
  toDefinitionImportSourceOption
} from './definitionImportSources';
import {
  buildDefinitionImportPlan,
  definitionImportPlanToPreview,
  stableStringify
} from './definitionImportPlanner';
import { applyDefinitionImport } from './definitionImportApplier';
import type { DefinitionImportTargetState } from './definitionImportTypes';

const loadTargetState = async (
  db: DatabaseAdapter,
  workspace: string
): Promise<DefinitionImportTargetState> => {
  const [schemas, enums, documentTypes, relationSchemas, fieldGroups] = await Promise.all([
    db.catalog.listSchemas(workspace),
    db.catalog.listEnums(workspace),
    db.document.listDocumentTypes(workspace, true),
    db.relation.listRelationSchemas(workspace),
    db.catalog.listSharedFieldGroups(workspace)
  ]);
  return {
    schemas,
    enums,
    documentTypes,
    relationSchemas,
    fieldGroups,
    isSchemaKeyPrefixUsed: async prefix => (await db.catalog.getSchemaByKeyPrefix(prefix)) !== null
  };
};

const preparePlan = async (
  db: DatabaseAdapter,
  workspace: string,
  source: DefinitionImportSource,
  selection: DefinitionImportSelection,
  renames: DefinitionImportRename[],
  dependencyMappings: DefinitionImportDependencyMapping[],
  event: AuthenticatedEvent
) => {
  const [sourceData, target] = await Promise.all([
    loadDefinitionImportSource(db, workspace, source, event),
    loadTargetState(db, workspace)
  ]);
  return buildDefinitionImportPlan({
    source,
    sourceData,
    target,
    selection,
    renames,
    dependencyMappings
  });
};

export const listDefinitionImportSources = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
) =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    fallback: 'Failed to retrieve definition import sources',
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceAdmin(authCtx, 'You must administer the destination workspace');
      const builtinSources = SCHEMA_TEMPLATES.map(template =>
        toDefinitionImportSourceOption(sourceFromBuiltin(template))
      );
      const workspaceSources = await Promise.all(
        (await db.workspace.listWorkspaces())
          .filter(item => item.id !== ws)
          .map(async item => {
            if (!(await canAdministerDefinitionImportSource(db, item.id, event))) return null;
            return toDefinitionImportSourceOption(await sourceFromWorkspace(db, item.id));
          })
      );
      return [...builtinSources, ...workspaceSources.filter(item => item !== null)];
    }
  });

export const previewDefinitionImport = async (
  db: DatabaseAdapter,
  workspace: string,
  input: {
    source: DefinitionImportSource;
    selection: DefinitionImportSelection;
    renames: DefinitionImportRename[];
    dependencyMappings: DefinitionImportDependencyMapping[];
  },
  event: AuthenticatedEvent
) =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    fallback: 'Failed to preview definition import',
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceAdmin(authCtx, 'You must administer the destination workspace');
      return definitionImportPlanToPreview(
        await preparePlan(
          db,
          ws,
          input.source,
          input.selection,
          input.renames ?? [],
          input.dependencyMappings ?? [],
          event
        )
      );
    }
  });

export const executeDefinitionImport = async (
  db: DatabaseAdapter,
  workspace: string,
  input: DefinitionImportExecuteRequest,
  event: AuthenticatedEvent
): Promise<DefinitionImportExecuteResponse> =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    fallback: 'Failed to execute definition import',
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceAdmin(authCtx, 'You must administer the destination workspace');
      const plan = await preparePlan(
        db,
        ws,
        input.source,
        input.selection,
        input.renames ?? [],
        input.dependencyMappings ?? [],
        event
      );
      httpAssert.true(plan.errors.length === 0, { status: 409, message: plan.errors.join('; ') });
      httpAssert.true(plan.conflicts.length === 0, {
        status: 409,
        message: `Definition import conflicts: ${plan.conflicts.map(conflict => conflict.name).join(', ')}`
      });
      httpAssert.true(plan.fingerprint === input.fingerprint, {
        status: 409,
        message: 'The definition import preview is stale. Preview the import again.'
      });

      const expected = definitionImportPlanToPreview(plan);
      httpAssert.true(
        stableStringify({
          schemas: input.schemas,
          enums: input.enums,
          documentTypes: input.documentTypes,
          relationSchemas: input.relationSchemas,
          fieldGroups: input.fieldGroups,
          dashboardWidgets: input.dashboardWidgets,
          dependencyMappings: input.dependencyMappings ?? [],
          schemaPatches: input.schemaPatches ?? [],
          renames: input.renames ?? [],
          keyPrefixRemaps: input.keyPrefixRemaps
        }) ===
          stableStringify({
            schemas: expected.schemas,
            enums: expected.enums,
            documentTypes: expected.documentTypes,
            relationSchemas: expected.relationSchemas,
            fieldGroups: expected.fieldGroups,
            dashboardWidgets: expected.dashboardWidgets,
            dependencyMappings: expected.dependencyMappings,
            schemaPatches: expected.schemaPatches,
            renames: expected.renames,
            keyPrefixRemaps: expected.keyPrefixRemaps
          }),
        { status: 409, message: 'The definition import preview has changed. Preview again.' }
      );
      return applyDefinitionImport(db, ws, authCtx, plan);
    }
  });
