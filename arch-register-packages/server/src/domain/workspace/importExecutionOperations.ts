import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import {
  coordinateContentWrite,
  type ContentStorageChange
} from '../project/contentWriteCoordinator';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';

import type {
  ExportConfig,
  ExportSchema,
  ExportEntity,
  ExportProject,
  ExportContentNode,
  ImportExecuteOptions,
  ImportExecuteResult,
  ExportDocumentData
} from './exportTypes';

import { buildImportPlan, applyConflictRenames } from './importPlanningOperations';
import {
  importConfig,
  importSchemas,
  importEntities,
  importProjects,
  importContentNodes,
  importDocuments
} from './importAppliers';
const describeImportPersistenceError = (error: unknown) => {
  if (!(error instanceof Error)) return 'Unknown error during import';
  const cause =
    error.cause != null && typeof error.cause === 'object' && 'message' in error.cause
      ? error.cause
      : null;
  const databaseMessage = cause != null && typeof cause.message === 'string' ? cause.message : null;
  return databaseMessage && databaseMessage !== error.message
    ? `${error.message}: ${databaseMessage}`
    : error.message;
};
export const executeImport = async (
  db: DatabaseAdapter,
  storage: StorageAdapter | undefined,
  authCtx: WorkspaceAuthorizationContext,
  workspace: string,
  options: ImportExecuteOptions,
  data: {
    config?: ExportConfig;
    schemas?: ExportSchema[];
    entities?: ExportEntity[];
    projects?: ExportProject[];
    content_nodes?: ExportContentNode[];
    documents?: ExportDocumentData;
  },
  contentFiles?: Map<string, Buffer>
): Promise<ImportExecuteResult> => {
  const result: ImportExecuteResult = {
    success: true,
    imported: {},
    errors: [],
    warnings: []
  };

  try {
    const {
      plan,
      mapping: idMapping,
      warnings: planWarnings
    } = await buildImportPlan(db, authCtx, workspace, options, data, contentFiles);
    result.warnings.push(...planWarnings);
    if (plan.diagnostics.length > 0) {
      result.success = false;
      result.errors = plan.diagnostics.map(diagnostic => diagnostic.message);
      result.failure = {
        stage: 'planning',
        message: 'Import plan validation failed',
        affected_items: plan.diagnostics.flatMap(diagnostic =>
          diagnostic.item_id ? [diagnostic.item_id] : []
        ),
        compensation: 'not_required',
        recovery: 'reupload_archive'
      };
      return result;
    }
    const storageChanges: ContentStorageChange[] = plan.storage_writes.map(write => ({
      type: 'write',
      workspace: write.workspace,
      storageId: write.storage_id,
      nodeId: write.node_id,
      content: contentFiles!.get(write.source_path)!
    }));
    const resolvedData = applyConflictRenames(data, options.conflict_resolutions);
    await coordinateContentWrite({
      db,
      storage,
      operation: 'workspace-import',
      scope: workspace,
      nodeIds: plan.storage_writes.map(write => write.node_id),
      storageChanges,
      writeDatabase: async transactionDb => {
        if (options.include.includes('config') && resolvedData.config)
          result.imported.config = await importConfig(
            transactionDb,
            workspace,
            resolvedData.config,
            options.preserve_ids ?? false,
            options.conflict_resolutions,
            idMapping
          );
        if (options.include.includes('schemas') && resolvedData.schemas)
          result.imported.schemas = await importSchemas(
            transactionDb,
            workspace,
            resolvedData.schemas,
            options.preserve_ids ?? false,
            options.conflict_resolutions,
            idMapping
          );
        if (options.include.includes('entities') && resolvedData.entities)
          result.imported.entities = await importEntities(
            transactionDb,
            authCtx,
            workspace,
            resolvedData.entities,
            options.preserve_ids ?? false,
            options.conflict_resolutions,
            idMapping
          );
        if (options.include.includes('projects') && resolvedData.projects)
          result.imported.projects = await importProjects(
            transactionDb,
            workspace,
            resolvedData.projects,
            options.preserve_ids ?? false,
            options.conflict_resolutions,
            idMapping
          );
        if (options.include.includes('content_nodes') && resolvedData.content_nodes)
          result.imported.content_nodes = await importContentNodes(
            transactionDb,
            undefined,
            authCtx,
            workspace,
            resolvedData.content_nodes,
            options.preserve_ids ?? false,
            options.conflict_resolutions,
            idMapping,
            contentFiles
          );
        if (options.include.includes('documents') && resolvedData.documents)
          result.imported.documents = await importDocuments(
            transactionDb,
            workspace,
            resolvedData.documents,
            options.preserve_ids ?? false,
            options.conflict_resolutions,
            idMapping,
            resolvedData.entities
          );
      }
    });
  } catch (error) {
    result.success = false;
    result.errors.push(describeImportPersistenceError(error));
    result.failure = {
      stage: 'persistence',
      message: result.errors[0]!,
      affected_items: [],
      compensation: storage ? 'completed' : 'not_required',
      recovery: 'reupload_archive'
    };
  }

  return result;
};
