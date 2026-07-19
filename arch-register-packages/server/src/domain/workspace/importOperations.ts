import { createHash, randomUUID } from 'node:crypto';
import type {
  DatabaseAdapter,
  ContentNodeDbUpsert,
  EntityDbCreate,
  SchemaDbCreate
} from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import {
  coordinateContentWrite,
  type ContentStorageChange
} from '../project/contentWriteCoordinator';
import type { AuthorizationContext, WorkspaceCapability } from '@arch-register/permissions';
import { formatPublicId } from '../../utils/publicIds';
import { httpAssert } from '../../utils/httpAssert';
import { PermissionChecker } from '@arch-register/permissions';
import { entityRequiresApproval } from '../catalog/entityChangeOperations';
import type { DocumentField, DocumentMetadata } from '@arch-register/api-types/documentContract';
import type {
  ExportManifest,
  ExportConfig,
  ExportSchema,
  ExportEntity,
  ExportProject,
  ExportContentNode,
  ExportDataType,
  ImportParseResult,
  ImportConflict,
  ImportExecuteOptions,
  ImportExecuteResult,
  IdMapping,
  ImportDiagnostic,
  WorkspaceImportPlan,
  ExportDocumentData
} from './exportTypes';

const checker = new PermissionChecker();

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

export const parseImport = async (
  db: DatabaseAdapter,
  authCtx: AuthorizationContext,
  workspace: string,
  manifest: ExportManifest,
  data: {
    config?: ExportConfig;
    schemas?: ExportSchema[];
    entities?: ExportEntity[];
    projects?: ExportProject[];
    content_nodes?: ExportContentNode[];
    documents?: ExportDocumentData;
  }
): Promise<ImportParseResult> => {
  // Check import permissions
  const hasSchemaPermission = checker.hasWorkspaceCapability(authCtx, 'schema.publish');
  const hasEntityPermission = checker.hasWorkspaceCapability(authCtx, 'ent.edit');
  const hasProjectPermission = checker.hasWorkspaceCapability(authCtx, 'proj.create');
  const hasConfigPermission = checker.hasWorkspaceCapability(authCtx, 'ws.settings');

  const errors: string[] = [];
  const warnings: string[] = [];
  const conflicts: ImportConflict[] = [];
  const diagnostics: ImportDiagnostic[] = [];

  diagnostics.push(...validateArchiveData(manifest, data));
  errors.push(...diagnostics.map(diagnostic => diagnostic.message));

  // Validate version compatibility
  if (manifest.version !== '1.0') {
    errors.push(`Unsupported export version: ${manifest.version}`);
  }

  // Validate format
  if (manifest.format !== 'zip-multi-file') {
    errors.push(`Unsupported export format: ${manifest.format}`);
  }

  const summary: ImportParseResult['summary'] = {};

  // Parse and validate config
  if (data.config) {
    if (!hasConfigPermission) {
      errors.push('You do not have permission to import workspace configuration');
    } else {
      const configResult = await validateConfig(db, workspace, data.config);
      summary.config = {
        lifecycle_states: data.config.lifecycle_states.length,
        teams: data.config.teams.length,
        roles: data.config.roles.length
      };
      conflicts.push(...configResult.conflicts);
      warnings.push(...configResult.warnings);
    }
  }

  // Parse and validate schemas
  if (data.schemas) {
    if (!hasSchemaPermission) {
      errors.push('You do not have permission to import schemas');
    } else {
      const schemaResult = await validateSchemas(db, workspace, data.schemas);
      summary.schemas = {
        count: data.schemas.length,
        conflicts: schemaResult.conflicts.length
      };
      conflicts.push(...schemaResult.conflicts);
      warnings.push(...schemaResult.warnings);
    }
  }

  // Parse and validate entities
  if (data.entities) {
    if (!hasEntityPermission) {
      errors.push('You do not have permission to import entities');
    } else {
      const entityResult = await validateEntities(db, workspace, data.entities, data.schemas);
      summary.entities = {
        count: data.entities.length,
        conflicts: entityResult.conflicts.length
      };
      conflicts.push(...entityResult.conflicts);
      warnings.push(...entityResult.warnings);
    }
  }

  // Parse and validate projects
  if (data.projects) {
    if (!hasProjectPermission) {
      errors.push('You do not have permission to import projects');
    } else {
      const projectResult = await validateProjects(db, workspace, data.projects);
      summary.projects = {
        count: data.projects.length,
        conflicts: projectResult.conflicts.length
      };
      conflicts.push(...projectResult.conflicts);
      warnings.push(...projectResult.warnings);
    }
  }

  // Parse and validate content nodes
  if (data.content_nodes) {
    if (!hasConfigPermission) {
      errors.push('You do not have permission to import content nodes');
    } else {
      const contentResult = await validateContentNodes(
        db,
        workspace,
        data.content_nodes,
        data.projects,
        data.entities
      );
      summary.content_nodes = {
        count: data.content_nodes.length,
        conflicts: contentResult.conflicts.length
      };
      conflicts.push(...contentResult.conflicts);
      warnings.push(...contentResult.warnings);
    }
  }

  if (data.documents) {
    if (!hasConfigPermission) errors.push('You do not have permission to import typed documents');
    else {
      const documentResult = await validateDocuments(db, workspace, data.documents, data.projects);
      summary.documents = {
        count: data.documents.types.length,
        templates: data.documents.templates.length,
        revisions: data.documents.revisions.length,
        conflicts: documentResult.conflicts.length
      };
      conflicts.push(...documentResult.conflicts);
      warnings.push(...documentResult.warnings);
      const entityIds = new Set(
        (data.entities ?? []).flatMap(entity =>
          entity.public_id ? [entity.id, entity.public_id] : [entity.id]
        )
      );
      const documentTypeIds = new Set(data.documents.types.map(type => type.id));
      const nodeIds = new Set((data.content_nodes ?? []).map(node => node.id));
      const projectIds = new Set((data.projects ?? []).map(project => project.id));
      for (const template of data.documents.templates) {
        if (!documentTypeIds.has(template.document_type_id)) {
          const message = `Document template '${template.id}' references document type '${template.document_type_id}', which is not included in the import archive and will be skipped`;
          diagnostics.push({
            code: 'missing_reference',
            item_type: 'documents',
            item_id: template.id,
            message
          });
          warnings.push(message);
        }
        if (template.project_id == null || projectIds.has(template.project_id)) continue;
        const message = `Document template '${template.id}' belongs to project '${template.project_id}', which is not included in the import archive and will be skipped`;
        diagnostics.push({
          code: 'missing_reference',
          item_type: 'documents',
          item_id: template.id,
          message
        });
        warnings.push(message);
      }
      for (const metadata of data.documents.metadata) {
        if (!nodeIds.has(metadata.node_id)) {
          const message = `Document metadata for '${metadata.node_id}' has no matching content node in the import archive and will be skipped`;
          diagnostics.push({
            code: 'missing_reference',
            item_type: 'documents',
            item_id: metadata.node_id,
            message
          });
          warnings.push(message);
        }
        for (const link of metadata.links) {
          const available =
            link.target_type === 'entity'
              ? entityIds.has(link.target_id)
              : nodeIds.has(link.target_id);
          if (available) continue;
          const message = `Document link target '${link.target_id}' is not included in the import archive and will be skipped`;
          diagnostics.push({
            code: 'missing_reference',
            item_type: 'documents',
            item_id: metadata.node_id,
            message
          });
          warnings.push(message);
        }
      }
      for (const revision of data.documents.revisions) {
        if (nodeIds.has(revision.node_id)) continue;
        const message = `Document revision '${revision.id}' has no matching content node in the import archive and will be skipped`;
        diagnostics.push({
          code: 'missing_reference',
          item_type: 'documents',
          item_id: revision.id,
          message
        });
        warnings.push(message);
      }
    }
  }

  return {
    valid: errors.length === 0,
    version: manifest.version,
    source_workspace: manifest.source_workspace,
    available_data_types: manifest.export_options,
    summary,
    conflicts,
    errors,
    warnings,
    diagnostics
  };
};

const validateArchiveData = (
  manifest: ExportManifest,
  data: {
    config?: ExportConfig;
    schemas?: ExportSchema[];
    entities?: ExportEntity[];
    projects?: ExportProject[];
    content_nodes?: ExportContentNode[];
    documents?: ExportDocumentData;
  }
): ImportDiagnostic[] => {
  const diagnostics: ImportDiagnostic[] = [];
  const collections: Array<[ExportDataType, Array<{ id: string }> | undefined]> = [
    ['schemas', data.schemas],
    ['entities', data.entities],
    ['projects', data.projects],
    ['content_nodes', data.content_nodes]
  ];
  for (const [type, items] of collections) {
    const ids = new Set<string>();
    for (const item of items ?? []) {
      if (ids.has(item.id)) {
        diagnostics.push({
          code: 'duplicate_import_item',
          item_type: type,
          item_id: item.id,
          message: `Duplicate ${type} item ID in import archive: ${item.id}`
        });
      }
      ids.add(item.id);
    }
  }

  const available = new Set(manifest.export_options);
  for (const [type, items] of collections) {
    if (items && !available.has(type)) {
      diagnostics.push({
        code: 'invalid_manifest',
        item_type: type,
        message: `Archive contains ${type} data not declared in its manifest`
      });
    }
  }

  if (data.documents && !available.has('documents')) {
    diagnostics.push({
      code: 'invalid_manifest',
      item_type: 'documents',
      message: 'Archive contains documents data not declared in its manifest'
    });
  }
  if (data.documents) {
    const typeIds = new Set<string>();
    for (const type of data.documents.types) {
      if (typeIds.has(type.id)) {
        diagnostics.push({
          code: 'duplicate_import_item',
          item_type: 'documents',
          item_id: type.id,
          message: `Duplicate document type ID in import archive: ${type.id}`
        });
      }
      typeIds.add(type.id);
    }
  }
  return diagnostics;
};

const validateConfig = async (
  db: DatabaseAdapter,
  workspace: string,
  config: ExportConfig
): Promise<{ conflicts: ImportConflict[]; warnings: string[] }> => {
  const conflicts: ImportConflict[] = [];
  const warnings: string[] = [];

  const [existingLifecycles, existingTeams, existingRoles] = await Promise.all([
    db.workspace.listLifecycleStates(workspace),
    db.workspace.listTeams(workspace),
    db.workspace.listCustomWorkspaceRoles(workspace)
  ]);

  // Check lifecycle state conflicts
  for (const state of config.lifecycle_states) {
    const existing = existingLifecycles.find(
      s => s.label.toLowerCase() === state.label.toLowerCase()
    );
    if (existing) {
      conflicts.push({
        type: 'config',
        item_id: state.id,
        item_name: state.label,
        conflict_reason: 'duplicate_name',
        existing_item: { id: existing.id, label: existing.label },
        import_item: state,
        suggested_resolution: 'merge'
      });
    }
  }

  // Check team conflicts
  for (const team of config.teams) {
    const existing = existingTeams.find(t => t.name.toLowerCase() === team.name.toLowerCase());
    if (existing) {
      conflicts.push({
        type: 'config',
        item_id: team.id,
        item_name: team.name,
        conflict_reason: 'duplicate_name',
        existing_item: { id: existing.id, name: existing.name },
        import_item: team,
        suggested_resolution: 'merge'
      });
    }
  }

  // Check role conflicts
  for (const role of config.roles) {
    const existing = existingRoles.find(r => r.name.toLowerCase() === role.name.toLowerCase());
    if (existing) {
      conflicts.push({
        type: 'config',
        item_id: role.id,
        item_name: role.name,
        conflict_reason: 'duplicate_name',
        existing_item: { id: existing.id, name: existing.name },
        import_item: role,
        suggested_resolution: 'merge'
      });
    }
  }

  return { conflicts, warnings };
};

const validateSchemas = async (
  db: DatabaseAdapter,
  workspace: string,
  schemas: ExportSchema[]
): Promise<{ conflicts: ImportConflict[]; warnings: string[] }> => {
  const conflicts: ImportConflict[] = [];
  const warnings: string[] = [];

  const existingSchemas = await db.catalog.listSchemas(workspace);

  for (const schema of schemas) {
    const existing = existingSchemas.find(s => s.name.toLowerCase() === schema.name.toLowerCase());
    if (existing) {
      conflicts.push({
        type: 'schemas',
        item_id: schema.id,
        item_name: schema.name,
        conflict_reason: 'duplicate_name',
        existing_item: { id: existing.id, name: existing.name },
        import_item: schema,
        suggested_resolution: 'merge'
      });
    }
  }

  return { conflicts, warnings };
};

const validateEntities = async (
  db: DatabaseAdapter,
  workspace: string,
  entities: ExportEntity[],
  schemas?: ExportSchema[]
): Promise<{ conflicts: ImportConflict[]; warnings: string[] }> => {
  const conflicts: ImportConflict[] = [];
  const warnings: string[] = [];

  const [existingEntities, existingSchemas] = await Promise.all([
    db.catalog.listEntities(workspace),
    db.catalog.listSchemas(workspace)
  ]);
  const sourceSchemaIds = new Set(schemas?.map(schema => schema.id) ?? []);
  const schemaIds = new Set(existingSchemas.map(schema => schema.id));

  for (const entity of entities) {
    const existing = existingEntities.find(
      candidate =>
        candidate.id === entity.id ||
        candidate.slug.toLowerCase() === entity.slug.toLowerCase() ||
        candidate.name.toLowerCase() === entity.name.toLowerCase()
    );
    if (existing) {
      conflicts.push({
        type: 'entities',
        item_id: entity.id,
        item_name: entity.name,
        conflict_reason:
          existing.slug.toLowerCase() === entity.slug.toLowerCase()
            ? 'duplicate_slug'
            : 'duplicate_name',
        existing_item: { id: existing.id, name: existing.name, slug: existing.slug },
        import_item: entity,
        suggested_resolution: 'merge'
      });
    }
    if (!sourceSchemaIds.has(entity.schema_id) && !schemaIds.has(entity.schema_id)) {
      conflicts.push({
        type: 'entities',
        item_id: entity.id,
        item_name: entity.name,
        conflict_reason: 'missing_dependency',
        import_item: entity,
        suggested_resolution: 'skip'
      });
    }
  }

  return { conflicts, warnings };
};

const validateProjects = async (
  db: DatabaseAdapter,
  workspace: string,
  projects: ExportProject[]
): Promise<{ conflicts: ImportConflict[]; warnings: string[] }> => {
  const conflicts: ImportConflict[] = [];
  const warnings: string[] = [];

  const existingProjects = await db.project.listProjects(workspace);

  for (const project of projects) {
    const existing = existingProjects.find(
      p => p.name.toLowerCase() === project.name.toLowerCase()
    );
    if (existing) {
      conflicts.push({
        type: 'projects',
        item_id: project.id,
        item_name: project.name,
        conflict_reason: 'duplicate_name',
        existing_item: { id: existing.id, name: existing.name },
        import_item: project,
        suggested_resolution: 'rename'
      });
    }
  }

  return { conflicts, warnings };
};

const validateContentNodes = async (
  db: DatabaseAdapter,
  workspace: string,
  contentNodes: ExportContentNode[],
  projects?: ExportProject[],
  entities?: ExportEntity[]
): Promise<{ conflicts: ImportConflict[]; warnings: string[] }> => {
  const conflicts: ImportConflict[] = [];
  const warnings: string[] = [];
  const existing = await db.project.listAllContentNodes(workspace);
  const sourceIds = new Set(contentNodes.map(node => node.id));
  const sourceProjects = new Set(projects?.map(project => project.id) ?? []);
  const sourceEntities = new Set(entities?.map(entity => entity.id) ?? []);

  for (const node of contentNodes) {
    const scopeMatches = (candidate: (typeof existing)[number]) =>
      candidate.project_id === node.project_id && candidate.entity_id === node.entity_id;
    const match = existing.find(
      candidate =>
        candidate.id === node.id || (scopeMatches(candidate) && candidate.path === node.path)
    );
    if (match) {
      conflicts.push({
        type: 'content_nodes',
        item_id: node.id,
        item_name: node.path,
        conflict_reason: 'duplicate_name',
        existing_item: { id: match.id, path: match.path },
        import_item: node,
        suggested_resolution: 'merge'
      });
    }
    if (
      node.parent_id &&
      !sourceIds.has(node.parent_id) &&
      !existing.some(item => item.id === node.parent_id)
    ) {
      conflicts.push({
        type: 'content_nodes',
        item_id: node.id,
        item_name: node.path,
        conflict_reason: 'missing_dependency',
        import_item: node,
        suggested_resolution: 'skip'
      });
    }
    if (
      node.project_id &&
      !sourceProjects.has(node.project_id) &&
      !existing.some(item => item.project_id === node.project_id)
    ) {
      conflicts.push({
        type: 'content_nodes',
        item_id: node.id,
        item_name: node.path,
        conflict_reason: 'missing_dependency',
        import_item: node,
        suggested_resolution: 'skip'
      });
    }
    if (
      node.entity_id &&
      !sourceEntities.has(node.entity_id) &&
      !existing.some(item => item.entity_id === node.entity_id)
    ) {
      conflicts.push({
        type: 'content_nodes',
        item_id: node.id,
        item_name: node.path,
        conflict_reason: 'missing_dependency',
        import_item: node,
        suggested_resolution: 'skip'
      });
    }
  }

  return { conflicts, warnings };
};

const validateDocuments = async (
  db: DatabaseAdapter,
  workspace: string,
  documents: ExportDocumentData,
  projects?: ExportProject[]
): Promise<{ conflicts: ImportConflict[]; warnings: string[] }> => {
  const conflicts: ImportConflict[] = [];
  const warnings: string[] = [];
  const [existingTypes, existingTemplates, existingProjects] = await Promise.all([
    db.document.listDocumentTypes(workspace, true),
    db.document.listDocumentTemplates(workspace, undefined, true),
    db.project.listProjects(workspace)
  ]);

  for (const type of documents.types) {
    const existing = existingTypes.find(
      candidate =>
        candidate.id === type.id || candidate.name.toLowerCase() === type.name.toLowerCase()
    );
    if (!existing) continue;
    conflicts.push({
      type: 'documents',
      item_id: type.id,
      item_name: type.name,
      conflict_reason: 'duplicate_name',
      existing_item: { id: existing.id, name: existing.name },
      import_item: type,
      suggested_resolution: 'merge'
    });
  }

  const sourceProjects = new Map((projects ?? []).map(project => [project.id, project]));
  for (const template of documents.templates) {
    if (template.project_id != null && !sourceProjects.has(template.project_id)) continue;
    const sourceProject = template.project_id ? sourceProjects.get(template.project_id) : null;
    const targetProjectId = sourceProject
      ? existingProjects.find(
          project =>
            project.id === sourceProject.id ||
            project.name.toLowerCase() === sourceProject.name.toLowerCase()
        )?.id
      : null;
    const existing = existingTemplates.find(
      candidate =>
        candidate.project_id === targetProjectId &&
        candidate.name.toLowerCase() === template.name.toLowerCase()
    );
    if (!existing) continue;
    conflicts.push({
      type: 'documents',
      item_id: template.id,
      item_name: template.name,
      conflict_reason: 'duplicate_name',
      existing_item: { id: existing.id, name: existing.name, project_id: existing.project_id },
      import_item: template,
      suggested_resolution: 'merge'
    });
  }

  return { conflicts, warnings };
};

const createIdMapping = (): IdMapping => ({
  schemas: new Map(),
  entities: new Map(),
  teams: new Map(),
  lifecycle_states: new Map(),
  projects: new Map(),
  content_nodes: new Map()
});

const toSerializableMapping = (mapping: IdMapping): WorkspaceImportPlan['id_mapping'] => ({
  schemas: Object.fromEntries(mapping.schemas),
  entities: Object.fromEntries(mapping.entities),
  teams: Object.fromEntries(mapping.teams),
  lifecycle_states: Object.fromEntries(mapping.lifecycle_states),
  projects: Object.fromEntries(mapping.projects),
  content_nodes: Object.fromEntries(mapping.content_nodes)
});

const buildImportPlan = async (
  db: DatabaseAdapter,
  authCtx: AuthorizationContext,
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
): Promise<{ plan: WorkspaceImportPlan; mapping: IdMapping; warnings: string[] }> => {
  const mapping = createIdMapping();
  const parsed = await parseImport(
    db,
    authCtx,
    workspace,
    {
      version: '1.0',
      format: 'zip-multi-file',
      exported_at: '',
      exported_by: '',
      source_workspace: { id: '', name: '', url_slug: '' },
      export_options: options.include,
      files: {},
      statistics: {
        entity_count: 0,
        project_count: 0,
        schema_count: 0,
        content_node_count: 0,
        total_content_size_bytes: 0
      },
      checksums: {}
    },
    data
  );
  const diagnostics: ImportDiagnostic[] = (parsed.diagnostics ?? []).filter(
    diagnostic => !(diagnostic.code === 'missing_reference' && diagnostic.item_type === 'documents')
  );
  const conflictById = new Map(parsed.conflicts.map(conflict => [conflict.item_id, conflict]));

  for (const conflict of parsed.conflicts) {
    const resolution = options.conflict_resolutions[conflict.item_id];
    if (!resolution) {
      diagnostics.push({
        code: 'unresolved_conflict',
        item_type: conflict.type,
        item_id: conflict.item_id,
        message: `Conflict for ${conflict.item_name} requires an explicit resolution`
      });
      continue;
    }
    if (resolution.action === 'rename' && !resolution.new_name?.trim()) {
      diagnostics.push({
        code: 'unresolved_conflict',
        item_type: conflict.type,
        item_id: conflict.item_id,
        message: `A new name is required to rename ${conflict.item_name}`
      });
    }
    if (conflict.conflict_reason === 'missing_dependency' && resolution.action !== 'skip') {
      diagnostics.push({
        code: 'missing_reference',
        item_type: conflict.type,
        item_id: conflict.item_id,
        message: `${conflict.item_name} has a missing dependency and can only be skipped`
      });
    }
  }

  const existingId = (id: string) =>
    conflictById.get(id)?.existing_item?.['id'] as string | undefined;
  const assign = (items: Array<{ id: string }>, bucket: Map<string, string>) => {
    for (const item of items) {
      const resolution = options.conflict_resolutions[item.id];
      if (resolution?.action === 'skip') continue;
      bucket.set(
        item.id,
        (resolution?.action === 'merge' || resolution?.action === 'overwrite') &&
          existingId(item.id)
          ? existingId(item.id)!
          : options.preserve_ids
            ? item.id
            : randomUUID()
      );
    }
  };
  if (options.include.includes('config') && data.config) {
    assign(data.config.teams, mapping.teams);
    assign(data.config.lifecycle_states, mapping.lifecycle_states);
  }
  if (options.include.includes('schemas') && data.schemas) assign(data.schemas, mapping.schemas);
  if (options.include.includes('entities') && data.entities)
    assign(data.entities, mapping.entities);
  if (options.include.includes('projects') && data.projects)
    assign(data.projects, mapping.projects);
  if (options.include.includes('content_nodes') && data.content_nodes)
    assign(data.content_nodes, mapping.content_nodes);

  const storage_writes: WorkspaceImportPlan['storage_writes'] = [];
  for (const node of data.content_nodes ?? []) {
    if (
      !options.include.includes('content_nodes') ||
      !node.content_file ||
      !mapping.content_nodes.has(node.id)
    )
      continue;
    if (!contentFiles?.has(node.content_file)) {
      diagnostics.push({
        code: 'missing_content_file',
        item_type: 'content_nodes',
        item_id: node.id,
        message: `Content file is missing for ${node.path}`
      });
      continue;
    }
    const projectId = resolveMappedId(mapping.projects, node.project_id);
    const entityId = resolveMappedId(mapping.entities, node.entity_id);
    storage_writes.push({
      workspace,
      storage_id: storageScope(workspace, { project_id: projectId, entity_id: entityId }),
      node_id: mapping.content_nodes.get(node.id)!,
      source_path: node.content_file
    });
  }
  return {
    warnings: parsed.warnings,
    plan: {
      include: options.include,
      id_mapping: toSerializableMapping(mapping),
      storage_writes,
      conflicts: parsed.conflicts,
      diagnostics
    },
    mapping
  };
};

const resolvedName = (
  id: string,
  fallback: string,
  resolutions: Record<string, ImportResolution>
) => {
  if (resolutions[id]?.action !== 'rename') return fallback;
  const newName = resolutions[id]?.new_name?.trim();
  return newName == null || newName === '' ? fallback : newName;
};

const applyConflictRenames = <
  T extends {
    config?: ExportConfig;
    schemas?: ExportSchema[];
    entities?: ExportEntity[];
    projects?: ExportProject[];
    content_nodes?: ExportContentNode[];
    documents?: ExportDocumentData;
  }
>(
  data: T,
  resolutions: Record<string, ImportResolution>
): T => ({
  ...data,
  config: data.config && {
    ...data.config,
    lifecycle_states: data.config.lifecycle_states.map(item => ({
      ...item,
      label: resolvedName(item.id, item.label, resolutions)
    })),
    teams: data.config.teams.map(item => ({
      ...item,
      name: resolvedName(item.id, item.name, resolutions)
    })),
    roles: data.config.roles.map(item => ({
      ...item,
      name: resolvedName(item.id, item.name, resolutions)
    }))
  },
  schemas: data.schemas?.map(item => ({
    ...item,
    name: resolvedName(item.id, item.name, resolutions)
  })),
  entities: data.entities?.map(item => ({
    ...item,
    name: resolvedName(item.id, item.name, resolutions)
  })),
  projects: data.projects?.map(item => ({
    ...item,
    name: resolvedName(item.id, item.name, resolutions)
  })),
  content_nodes: data.content_nodes?.map(item => ({
    ...item,
    name: resolvedName(item.id, item.name, resolutions)
  })),
  documents: data.documents && {
    ...data.documents,
    types: data.documents.types.map(item => ({
      ...item,
      name: resolvedName(item.id, item.name, resolutions)
    })),
    templates: data.documents.templates.map(item => ({
      ...item,
      name: resolvedName(item.id, item.name, resolutions)
    }))
  }
});

export const executeImport = async (
  db: DatabaseAdapter,
  storage: StorageAdapter | undefined,
  authCtx: AuthorizationContext,
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

type ImportResolution = { action: string; new_name?: string };

const resolveMappedId = (mapping: Map<string, string>, id: string | null | undefined) => {
  if (id == null) return null;
  return mapping.get(id) ?? id;
};

const hasSkipResolution = (resolutions: Record<string, ImportResolution>, id: string) =>
  resolutions[id]?.action === 'skip';

const generateSchemaKeyPrefix = (seed: string) => {
  const bytes = createHash('sha1').update(seed).digest();
  let prefix = '';

  for (let i = 0; prefix.length < 5 && i < bytes.length; i++) {
    prefix += String.fromCharCode(65 + (bytes[i]! % 26));
  }

  return prefix.length >= 2 ? prefix : 'SCM';
};

const importConfig = async (
  db: DatabaseAdapter,
  workspace: string,
  config: ExportConfig,
  preserveIds: boolean,
  resolutions: Record<string, ImportResolution>,
  idMapping: IdMapping
): Promise<{ lifecycle_states: number; teams: number; roles: number }> => {
  const now = new Date();
  const lifecycleStates = config.lifecycle_states.flatMap(state => {
    if (hasSkipResolution(resolutions, state.id) || resolutions[state.id]?.action === 'merge')
      return [];
    const nextId =
      idMapping.lifecycle_states.get(state.id) ?? (preserveIds ? state.id : randomUUID());
    idMapping.lifecycle_states.set(state.id, nextId);
    return [
      {
        id: nextId,
        workspace,
        label: state.label,
        color: state.color,
        sort_order: state.sort_order,
        created_at: now
      }
    ];
  });

  const teams = config.teams.flatMap(team => {
    if (hasSkipResolution(resolutions, team.id) || resolutions[team.id]?.action === 'merge')
      return [];
    const nextId = idMapping.teams.get(team.id) ?? (preserveIds ? team.id : randomUUID());
    idMapping.teams.set(team.id, nextId);
    return [
      {
        id: nextId,
        workspace,
        name: team.name,
        sort_order: team.sort_order,
        color: team.color,
        description: team.description,
        created_at: now
      }
    ];
  });

  if (lifecycleStates.length > 0) {
    await db.workspace.replaceLifecycleStates(workspace, lifecycleStates);
  }

  if (teams.length > 0) {
    await db.workspace.replaceTeams(workspace, teams);
  }

  let roleCount = 0;
  const existingRoles = await db.workspace.listCustomWorkspaceRoles(workspace);
  const existingRolesById = new Map(existingRoles.map(role => [role.id, role]));

  for (const role of config.roles) {
    if (hasSkipResolution(resolutions, role.id)) continue;

    const nextId = preserveIds ? role.id : randomUUID();
    const capabilities = role.capabilities as WorkspaceCapability[];
    const existing = existingRolesById.get(nextId);

    if (existing) {
      await db.workspace.updateCustomWorkspaceRole(workspace, nextId, {
        name: role.name,
        description: role.description,
        tone: role.tone,
        builtin: false,
        capabilities,
        updated_at: now
      });
    } else {
      await db.workspace.createCustomWorkspaceRole({
        id: nextId,
        workspace,
        name: role.name,
        description: role.description,
        tone: role.tone,
        builtin: false,
        capabilities,
        created_at: now,
        updated_at: now
      });
    }
    roleCount++;
  }

  return { lifecycle_states: lifecycleStates.length, teams: teams.length, roles: roleCount };
};

const importSchemas = async (
  db: DatabaseAdapter,
  workspace: string,
  schemas: ExportSchema[],
  preserveIds: boolean,
  resolutions: Record<string, ImportResolution>,
  idMapping: IdMapping
): Promise<{ created: number; updated: number }> => {
  const now = new Date();
  const existingSchemas = await db.catalog.listSchemas(workspace);
  const existingSchemasById = new Map(existingSchemas.map(schema => [schema.id, schema]));
  const existingSchemasByName = new Map(
    existingSchemas.map(schema => [schema.name.toLowerCase(), schema])
  );

  for (const schema of schemas) {
    if (hasSkipResolution(resolutions, schema.id)) continue;
    if (resolutions[schema.id]?.action === 'merge') continue;
    if (idMapping.schemas.has(schema.id)) continue;
    const existing = preserveIds
      ? (existingSchemasById.get(schema.id) ?? existingSchemasByName.get(schema.name.toLowerCase()))
      : (existingSchemasByName.get(schema.name.toLowerCase()) ??
        existingSchemasById.get(schema.id));
    const nextId = existing?.id ?? (preserveIds ? schema.id : randomUUID());
    idMapping.schemas.set(schema.id, nextId);
  }

  const mappedSchemas = schemas.flatMap(schema => {
    if (hasSkipResolution(resolutions, schema.id)) return [];
    const nextId = idMapping.schemas.get(schema.id) ?? schema.id;
    return [{ schema, nextId }];
  });

  let created = 0;
  let updated = 0;

  for (const { schema, nextId } of mappedSchemas) {
    const existing =
      existingSchemasById.get(nextId) ?? existingSchemasByName.get(schema.name.toLowerCase());
    const fields = schema.fields.map(field => {
      if (
        field != null &&
        typeof field === 'object' &&
        'type' in field &&
        (field as { type?: string }).type &&
        ['reference', 'containment'].includes((field as { type: string }).type)
      ) {
        const typedField = field as { schemaId?: string };
        return {
          ...field,
          schemaId: resolveMappedId(idMapping.schemas, typedField.schemaId)
        };
      }
      return field;
    }) as SchemaDbCreate['fields'];
    const fieldById = new Map(fields.map(field => [field.id, field]));
    const templates = (schema.templates ?? []).map(template => {
      const templateFields: typeof template.values.fields = {};
      for (const [fieldId, value] of Object.entries(template.values.fields)) {
        const field = fieldById.get(fieldId);
        if (field?.type === 'reference' || field?.type === 'containment') {
          const remapped = Array.isArray(value)
            ? value.flatMap(id => idMapping.entities.get(id) ?? [])
            : [];
          if (remapped.length > 0) templateFields[fieldId] = remapped;
        } else {
          templateFields[fieldId] = value;
        }
      }
      const owner = template.values.owner ? idMapping.teams.get(template.values.owner) : undefined;
      const lifecycle = template.values.lifecycle
        ? idMapping.lifecycle_states.get(template.values.lifecycle)
        : undefined;
      return {
        ...template,
        values: { ...template.values, fields: templateFields, owner, lifecycle }
      };
    });

    const input: SchemaDbCreate = {
      id: nextId,
      workspace,
      name: schema.name,
      description: existing?.description ?? '',
      fields,
      templates,
      color: schema.color,
      icon: schema.icon,
      default_owner: resolveMappedId(idMapping.teams, schema.default_owner),
      key_prefix: existing?.key_prefix ?? generateSchemaKeyPrefix(nextId),
      created_at: existing?.created_at ?? now,
      updated_at: now
    };

    if (existing) {
      const previousKeyPrefix = existing.key_prefix;
      const row = await db.catalog.updateSchema(workspace, nextId, {
        name: input.name,
        description: input.description,
        fields: input.fields,
        templates: input.templates,
        color: input.color,
        icon: input.icon,
        default_owner: input.default_owner,
        key_prefix: input.key_prefix,
        updated_at: now
      });
      if (row?.key_prefix && row.key_prefix !== previousKeyPrefix) {
        if (previousKeyPrefix) {
          await db.workspace.updatePublicIdPrefix(
            previousKeyPrefix,
            row.key_prefix,
            'schema',
            row.id,
            now
          );
        } else {
          await db.workspace.registerPublicIdPrefix(row.key_prefix, 'schema', row.id, now);
        }
      } else if (previousKeyPrefix && !row?.key_prefix) {
        await db.workspace.deletePublicIdPrefix(previousKeyPrefix);
      }
      updated++;
    } else {
      await db.catalog.createSchema(input);
      if (input.key_prefix) {
        await db.workspace.registerPublicIdPrefix(input.key_prefix, 'schema', nextId, now);
      }
      created++;
    }
  }

  return { created, updated };
};

const importEntities = async (
  db: DatabaseAdapter,
  _authCtx: AuthorizationContext,
  workspace: string,
  entities: ExportEntity[],
  preserveIds: boolean,
  resolutions: Record<string, ImportResolution>,
  idMapping: IdMapping
): Promise<{ created: number; updated: number; skipped: number }> => {
  const now = new Date();
  const existingEntities = new Map(
    (await db.catalog.listEntities(workspace)).map(entity => [entity.id, entity])
  );
  const usedPublicIds = new Set(
    [...existingEntities.values()]
      .map(entity => entity.public_id)
      .filter((publicId): publicId is string => publicId != null)
  );
  const mappedEntities = entities.flatMap(entity => {
    if (hasSkipResolution(resolutions, entity.id) || resolutions[entity.id]?.action === 'merge')
      return [];
    const nextId = idMapping.entities.get(entity.id) ?? (preserveIds ? entity.id : randomUUID());
    idMapping.entities.set(entity.id, nextId);
    return [{ entity, nextId }];
  });

  let created = 0;
  let updated = 0;
  const skipped = 0;

  for (const { entity, nextId } of mappedEntities) {
    const existing = existingEntities.get(nextId);
    if (!existing) continue;
    const schemaId = resolveMappedId(idMapping.schemas, entity.schema_id) ?? entity.schema_id;
    const schema = await db.catalog.getSchema(workspace, schemaId);
    if (schema && entityRequiresApproval(schema, existing)) {
      throw new Error(
        `Entity ${existing.id} requires an approved change proposal before it can be imported`
      );
    }
  }

  for (const { entity, nextId } of mappedEntities) {
    const existing = existingEntities.get(nextId);
    const schemaId = resolveMappedId(idMapping.schemas, entity.schema_id) ?? entity.schema_id;
    const schema = await db.catalog.getSchema(workspace, schemaId);
    let publicId = preserveIds ? (entity.public_id ?? nextId) : null;
    if (!publicId || usedPublicIds.has(publicId)) {
      httpAssert.present(schema, {
        status: 409,
        message: `Schema '${schemaId}' is unavailable while importing entity '${entity.id}'`
      });
      do {
        publicId = formatPublicId(
          schema.key_prefix,
          await db.workspace.allocatePublicId(schema.key_prefix, now)
        );
      } while (usedPublicIds.has(publicId));
    }
    usedPublicIds.add(publicId);
    const input: EntityDbCreate = {
      id: nextId,
      workspace,
      public_id: publicId,
      schema_id: schemaId,
      name: entity.name,
      slug: entity.slug,
      namespace: entity.namespace,
      description: entity.description,
      owner: resolveMappedId(idMapping.teams, entity.owner),
      lifecycle: resolveMappedId(idMapping.lifecycle_states, entity.lifecycle),
      target_lifecycle: resolveMappedId(idMapping.lifecycle_states, entity.target_lifecycle),
      target_lifecycle_date: entity.target_lifecycle_date,
      tags: entity.tags,
      links: entity.links as EntityDbCreate['links'],
      data: entity.data,
      visibility_mode: entity.visibility_mode,
      created_at: existing?.created_at ?? now,
      updated_at: now
    };

    if (existing) {
      await db.catalog.updateEntity(workspace, nextId, {
        name: input.name,
        slug: input.slug,
        namespace: input.namespace,
        description: input.description,
        schema_id: input.schema_id,
        owner: input.owner,
        lifecycle: input.lifecycle,
        target_lifecycle: input.target_lifecycle,
        target_lifecycle_date: input.target_lifecycle_date,
        tags: input.tags,
        links: input.links,
        data: input.data,
        visibility_mode: input.visibility_mode,
        updated_at: now
      });
      updated++;
    } else {
      await db.catalog.createEntity(input);
      created++;
    }
  }

  return { created, updated, skipped };
};

const importProjects = async (
  db: DatabaseAdapter,
  workspace: string,
  projects: ExportProject[],
  preserveIds: boolean,
  resolutions: Record<string, ImportResolution>,
  idMapping: IdMapping
): Promise<{ created: number; updated: number }> => {
  const now = new Date();
  const workspaceRow = await db.workspace.getWorkspace(workspace);
  httpAssert.present(workspaceRow, { status: 404, message: `Workspace '${workspace}' not found` });
  const existingProjects = new Map(
    (await db.project.listProjects(workspace)).map(project => [project.id, project])
  );
  const mappedProjects = projects.flatMap(project => {
    if (hasSkipResolution(resolutions, project.id) || resolutions[project.id]?.action === 'merge')
      return [];
    const nextId = idMapping.projects.get(project.id) ?? (preserveIds ? project.id : randomUUID());
    idMapping.projects.set(project.id, nextId);
    return [{ project, nextId }];
  });

  let created = 0;
  let updated = 0;

  for (const { project, nextId } of mappedProjects) {
    const existing = existingProjects.get(nextId);
    const status = project.status === 'archived' ? 'cancelled' : 'active';
    const pinned = project.status === 'pinned';
    const owner = resolveMappedId(idMapping.teams, project.owner);

    if (existing) {
      await db.project.updateProject(workspace, nextId, {
        name: project.name,
        description: project.description,
        owner,
        status,
        color: project.color,
        target_date: null,
        pinned,
        updated_at: now
      });
      updated++;
    } else {
      await db.project.createProject({
        id: nextId,
        workspace,
        public_id: formatPublicId(
          workspaceRow.short_code,
          await db.workspace.allocatePublicId(workspaceRow.short_code, now)
        ),
        name: project.name,
        description: project.description,
        owner,
        status,
        color: project.color,
        target_date: null,
        pinned,
        created_at: now,
        updated_at: now
      });
      created++;
    }
  }

  return { created, updated };
};

const storageScope = (
  workspace: string,
  node: { project_id: string | null; entity_id: string | null }
) => node.project_id ?? node.entity_id ?? workspace;

const importContentNodes = async (
  db: DatabaseAdapter,
  storage: StorageAdapter | undefined,
  authCtx: AuthorizationContext,
  workspace: string,
  contentNodes: ExportContentNode[],
  preserveIds: boolean,
  resolutions: Record<string, ImportResolution>,
  idMapping: IdMapping,
  contentFiles?: Map<string, Buffer>
): Promise<{ created: number; updated: number }> => {
  const now = new Date();
  const existingNodes = new Map(
    (await db.project.listAllContentNodes(workspace)).map(node => [node.id, node])
  );
  const mappedNodes = contentNodes.flatMap(node => {
    if (hasSkipResolution(resolutions, node.id) || resolutions[node.id]?.action === 'merge')
      return [];
    const nextId = idMapping.content_nodes.get(node.id) ?? (preserveIds ? node.id : randomUUID());
    idMapping.content_nodes.set(node.id, nextId);
    return [{ node, nextId }];
  });

  mappedNodes.sort((a, b) => {
    const depthA = a.node.path.split('/').length;
    const depthB = b.node.path.split('/').length;
    return depthA - depthB || a.node.path.localeCompare(b.node.path);
  });

  let created = 0;
  let updated = 0;

  for (const { node, nextId } of mappedNodes) {
    const existing = existingNodes.get(nextId);
    const projectId = resolveMappedId(idMapping.projects, node.project_id);
    const entityId = resolveMappedId(idMapping.entities, node.entity_id);
    const parentId = resolveMappedId(idMapping.content_nodes, node.parent_id);
    const storageProjectId = storageScope(workspace, {
      project_id: projectId,
      entity_id: entityId
    });

    const row = await db.project.upsertContentNode({
      id: nextId,
      workspace,
      project_id: projectId,
      entity_id: entityId,
      parent_id: parentId,
      path: node.path,
      name: node.name,
      type: node.type,
      size_bytes: node.size_bytes,
      comment_count: 0,
      unresolved_comment_count: 0,
      created_atIfNew: now,
      updated_at: now,
      created_byIfNew: null,
      updated_by: authCtx.userId
    } satisfies ContentNodeDbUpsert);

    if (node.content_file && contentFiles?.has(node.content_file) && storage) {
      await storage.write(
        workspace,
        storageProjectId,
        row.id,
        contentFiles.get(node.content_file)!
      );
    }

    if (node.type !== 'folder') {
      const previewBuffer = node.preview_file ? contentFiles?.get(node.preview_file) : undefined;
      const previewSvg = previewBuffer ? previewBuffer.toString('utf8') : null;

      if (projectId) {
        await db.project.updateContentNodeDerivedData(
          workspace,
          storageProjectId,
          row.id,
          node.size_bytes,
          0,
          0,
          previewSvg,
          now
        );
        await db.project.updateContentNodeTemplateStatus(
          workspace,
          storageProjectId,
          row.id,
          node.is_template,
          node.is_workspace_template,
          now
        );
      } else if (entityId) {
        await db.project.updateContentNodeDerivedData(
          workspace,
          storageProjectId,
          row.id,
          node.size_bytes,
          0,
          0,
          previewSvg,
          now
        );
      } else {
        await db.project.updateWorkspaceContentNodeDerivedData(
          workspace,
          row.id,
          node.size_bytes,
          0,
          0,
          previewSvg,
          now
        );
      }
    }

    if (existing) {
      updated++;
    } else {
      created++;
    }
  }

  return { created, updated };
};

const remapDocumentMetadataValues = (
  fields: DocumentField[],
  sourceValues: DocumentMetadata,
  resolveEntity: (id: string) => string | undefined,
  resolveDocument: (id: string) => string | undefined
) => {
  const values = { ...sourceValues };
  for (const field of fields) {
    if (field.type !== 'entity_link' && field.type !== 'document_link') continue;
    const raw = values[field.id];
    if (raw === undefined) continue;
    const sourceIds = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
    const mapped = sourceIds
      .map(id => (field.type === 'entity_link' ? resolveEntity(id) : resolveDocument(id)))
      .filter((id): id is string => !!id);
    values[field.id] = Array.isArray(raw) ? mapped : (mapped[0] ?? null);
  }
  return values;
};

const importDocuments = async (
  db: DatabaseAdapter,
  workspace: string,
  documents: ExportDocumentData,
  preserveIds: boolean,
  resolutions: Record<string, ImportResolution>,
  idMapping: IdMapping,
  sourceEntities?: ExportEntity[]
): Promise<{ created: number; templates: number; metadata: number; revisions: number }> => {
  const typeMapping = new Map<string, string>();
  const sourceEntityIdByIdentifier = new Map<string, string>();
  for (const entity of sourceEntities ?? []) {
    sourceEntityIdByIdentifier.set(entity.id, entity.id);
    if (entity.public_id) sourceEntityIdByIdentifier.set(entity.public_id, entity.id);
  }
  const existingTypes = await db.document.listDocumentTypes(workspace, true);
  let created = 0;
  for (const type of documents.types) {
    if (hasSkipResolution(resolutions, type.id)) continue;
    const resolution = resolutions[type.id];
    const existing = existingTypes.find(
      candidate =>
        candidate.id === type.id || candidate.name.toLowerCase() === type.name.toLowerCase()
    );
    const reuseExisting = existing != null && resolution?.action !== 'rename';
    const nextId = reuseExisting ? existing.id : preserveIds && !existing ? type.id : randomUUID();
    typeMapping.set(type.id, nextId);
    const now = new Date();
    const input = {
      name: type.name,
      description: type.description,
      fields: type.fields,
      aiActions: type.aiActions ?? [],
      color: type.color,
      icon: type.icon,
      updated_at: now
    };
    if (reuseExisting) {
      await db.document.updateDocumentType(workspace, nextId, input);
      await db.document.archiveDocumentType(workspace, nextId, type.archived, now);
    } else {
      await db.document.createDocumentType({
        id: nextId,
        workspace,
        ...input,
        created_at: new Date(type.created_at)
      });
      if (type.archived) await db.document.archiveDocumentType(workspace, nextId, true, now);
      created++;
    }
  }
  const existingTemplates = await db.document.listDocumentTemplates(workspace, undefined, true);
  let templates = 0;
  for (const template of documents.templates) {
    if (hasSkipResolution(resolutions, template.id)) continue;
    if (template.project_id != null && !idMapping.projects.has(template.project_id)) continue;
    const projectId =
      template.project_id == null ? null : (idMapping.projects.get(template.project_id) ?? null);
    const documentTypeId = typeMapping.get(template.document_type_id);
    if (!documentTypeId) continue;
    const resolution = resolutions[template.id];
    const existing = existingTemplates.find(
      candidate =>
        candidate.id === template.id ||
        (candidate.project_id === projectId &&
          candidate.name.toLowerCase() === template.name.toLowerCase())
    );
    const reuseExisting = existing != null && resolution?.action !== 'rename';
    const templateId = reuseExisting
      ? existing.id
      : preserveIds && !existing
        ? template.id
        : randomUUID();
    const sourceType = documents.types.find(type => type.id === template.document_type_id);
    const metadataDefaults = sourceType
      ? remapDocumentMetadataValues(
          sourceType.fields,
          template.metadata_defaults,
          id => idMapping.entities.get(sourceEntityIdByIdentifier.get(id) ?? id),
          id => idMapping.content_nodes.get(id)
        )
      : template.metadata_defaults;
    const input = {
      workspace,
      project_id: projectId,
      name: template.name,
      body: template.body,
      document_type_id: documentTypeId,
      metadata_defaults: metadataDefaults,
      updated_at: new Date()
    };
    if (reuseExisting) {
      await db.document.updateDocumentTemplate(workspace, templateId, input);
      await db.document.archiveDocumentTemplate(
        workspace,
        templateId,
        template.archived,
        new Date()
      );
    } else {
      await db.document.createDocumentTemplate({
        id: templateId,
        ...input,
        created_at: new Date(template.created_at)
      });
      if (template.archived)
        await db.document.archiveDocumentTemplate(workspace, templateId, true, new Date());
      templates++;
    }
  }
  let metadataCount = 0;
  for (const item of documents.metadata) {
    const nodeId = idMapping.content_nodes.get(item.node_id);
    if (!nodeId) continue;
    const documentTypeId = item.document_type_id
      ? (typeMapping.get(item.document_type_id) ?? null)
      : null;
    if (item.document_type_id && !documentTypeId) continue;
    const sourceType = item.document_type_id
      ? documents.types.find(type => type.id === item.document_type_id)
      : null;
    const values = sourceType
      ? remapDocumentMetadataValues(
          sourceType.fields,
          item.values,
          id => idMapping.entities.get(sourceEntityIdByIdentifier.get(id) ?? id),
          id => idMapping.content_nodes.get(id)
        )
      : item.values;
    await db.document.upsertDocumentMetadata({
      workspace,
      node_id: nodeId,
      document_type_id: documentTypeId,
      values,
      generated_metadata: item.generated_metadata ?? {},
      updated_at: new Date()
    });
    const links = item.links.flatMap(link => {
      const targetId =
        link.target_type === 'entity'
          ? idMapping.entities.get(sourceEntityIdByIdentifier.get(link.target_id) ?? link.target_id)
          : idMapping.content_nodes.get(link.target_id);
      return targetId == null ? [] : [{ ...link, target_id: targetId }];
    });
    await db.document.replaceDocumentLinks(workspace, nodeId, links);
    metadataCount++;
  }
  const revisionMapping = new Map<string, string>();
  let revisions = 0;
  const orderedRevisions = [...documents.revisions].sort(
    (left, right) =>
      left.node_id.localeCompare(right.node_id) || left.revision_number - right.revision_number
  );
  for (const revision of orderedRevisions) {
    const nodeId = idMapping.content_nodes.get(revision.node_id);
    if (!nodeId) continue;
    const id = preserveIds ? revision.id : randomUUID();
    const createdBy =
      revision.created_by && (await db.auth.getUser(revision.created_by))
        ? revision.created_by
        : null;
    const documentTypeId = revision.document_type_id
      ? (typeMapping.get(revision.document_type_id) ?? null)
      : null;
    if (revision.document_type_id && !documentTypeId) continue;
    revisionMapping.set(revision.id, id);
    await db.project.createMarkdownRevision({
      id,
      workspace,
      node_id: nodeId,
      revision_number: revision.revision_number,
      title: revision.title,
      body: revision.body,
      created_at: new Date(revision.created_at),
      created_by: createdBy,
      restored_from_revision_id: revision.restored_from_revision_id
        ? (revisionMapping.get(revision.restored_from_revision_id) ?? null)
        : null,
      document_type_id: documentTypeId,
      metadata: (() => {
        const sourceType = revision.document_type_id
          ? documents.types.find(type => type.id === revision.document_type_id)
          : null;
        return sourceType
          ? remapDocumentMetadataValues(
              sourceType.fields,
              revision.metadata,
              id => idMapping.entities.get(sourceEntityIdByIdentifier.get(id) ?? id),
              id => idMapping.content_nodes.get(id)
            )
          : revision.metadata;
      })()
    });
    revisions++;
  }
  return { created, templates, metadata: metadataCount, revisions };
};
