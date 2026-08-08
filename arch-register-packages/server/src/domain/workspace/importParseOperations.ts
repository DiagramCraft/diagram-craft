import type { DatabaseAdapter } from '../../db/database';

import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';

import { PermissionChecker } from '@arch-register/permissions';

import type {
  ExportManifest,
  ExportConfig,
  ExportSchema,
  ExportRelationSchema,
  ExportEntity,
  ExportRelation,
  ExportProject,
  ExportContentNode,
  ExportDataType,
  ImportParseResult,
  ImportConflict,
  ImportDiagnostic,
  ExportDocumentData
} from './exportTypes';
import type { SchemaField, SchemaGroup } from '@arch-register/api-types/schemaContract';
import { findUnresolvedFieldGroupReferences } from '../catalog/schemaHelpers';
import { validateDerivedFieldGroupAccess } from '../derived/derivedFields';

const checker = new PermissionChecker();
export const parseImport = async (
  db: DatabaseAdapter,
  authCtx: WorkspaceAuthorizationContext,
  workspace: string,
  manifest: ExportManifest,
  data: {
    config?: ExportConfig;
    schemas?: ExportSchema[];
    relation_schemas?: ExportRelationSchema[];
    entities?: ExportEntity[];
    relations?: ExportRelation[];
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
  for (const diagnostic of manifest.export_diagnostics ?? []) {
    const message = `Source export diagnostic: ${diagnostic.message}`;
    diagnostics.push({
      code: 'missing_reference',
      item_type: diagnostic.item_type,
      item_id: diagnostic.item_id,
      message
    });
    warnings.push(message);
  }

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
      errors.push(...schemaResult.errors);
    }
  }

  // Parse and validate relation schemas
  if (data.relation_schemas) {
    if (!hasSchemaPermission) {
      errors.push('You do not have permission to import relation schemas');
    } else {
      const relationSchemaResult = await validateRelationSchemas(
        db,
        workspace,
        data.relation_schemas,
        data.schemas
      );
      summary.relation_schemas = {
        count: data.relation_schemas.length,
        conflicts: relationSchemaResult.conflicts.length
      };
      conflicts.push(...relationSchemaResult.conflicts);
      warnings.push(...relationSchemaResult.warnings);
      errors.push(...relationSchemaResult.errors);
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

  // Parse and validate relation instances
  if (data.relations) {
    if (!hasEntityPermission) {
      errors.push('You do not have permission to import relations');
    } else {
      const relationResult = await validateRelations(
        db,
        workspace,
        data.relations,
        data.relation_schemas,
        data.entities
      );
      summary.relations = {
        count: data.relations.length,
        conflicts: relationResult.conflicts.length
      };
      conflicts.push(...relationResult.conflicts);
      warnings.push(...relationResult.warnings);
      errors.push(...relationResult.errors);
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
    relation_schemas?: ExportRelationSchema[];
    entities?: ExportEntity[];
    relations?: ExportRelation[];
    projects?: ExportProject[];
    content_nodes?: ExportContentNode[];
    documents?: ExportDocumentData;
  }
): ImportDiagnostic[] => {
  const diagnostics: ImportDiagnostic[] = [];
  const collections: Array<[ExportDataType, Array<{ id: string }> | undefined]> = [
    ['schemas', data.schemas],
    ['relation_schemas', data.relation_schemas],
    ['entities', data.entities],
    ['relations', data.relations],
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
): Promise<{ conflicts: ImportConflict[]; warnings: string[]; errors: string[] }> => {
  const conflicts: ImportConflict[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

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

    const fields = schema.fields as SchemaField[];
    const groups = (schema.groups ?? []) as SchemaGroup[];
    const unresolved = findUnresolvedFieldGroupReferences(fields, groups);
    errors.push(
      ...unresolved.map(
        reference =>
          `Schema '${schema.name}' field '${reference.fieldName}' references missing field group '${reference.groupId}'`
      )
    );
    if (unresolved.length === 0) {
      try {
        validateDerivedFieldGroupAccess(fields, groups);
      } catch (error) {
        errors.push(
          error instanceof Error ? `Schema '${schema.name}': ${error.message}` : String(error)
        );
      }
    }
  }

  return { conflicts, warnings, errors };
};

const validateRelationSchemas = async (
  db: DatabaseAdapter,
  workspace: string,
  relationSchemas: ExportRelationSchema[],
  schemas?: ExportSchema[]
): Promise<{ conflicts: ImportConflict[]; warnings: string[]; errors: string[] }> => {
  const conflicts: ImportConflict[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const [existingRelationSchemas, existingEntitySchemas, existingSharedGroups] = await Promise.all([
    db.relation.listRelationSchemas(workspace),
    db.catalog.listSchemas(workspace),
    db.catalog.listSharedFieldGroups(workspace)
  ]);
  const sourceEntitySchemaIds = new Set(schemas?.map(schema => schema.id) ?? []);
  const existingEntitySchemaIds = new Set(existingEntitySchemas.map(schema => schema.id));
  const existingSharedGroupIds = new Set(existingSharedGroups.map(group => group.id));

  for (const relationSchema of relationSchemas) {
    const existing = existingRelationSchemas.find(
      schema =>
        schema.id === relationSchema.id ||
        schema.name.toLowerCase() === relationSchema.name.toLowerCase()
    );
    if (existing) {
      conflicts.push({
        type: 'relation_schemas',
        item_id: relationSchema.id,
        item_name: relationSchema.name,
        conflict_reason: 'duplicate_name',
        existing_item: { id: existing.id, name: existing.name },
        import_item: relationSchema,
        suggested_resolution: 'merge'
      });
    }

    for (const entitySchemaId of [
      ...(relationSchema.in_schema_ids === 'any' ? [] : relationSchema.in_schema_ids),
      ...(relationSchema.out_schema_ids === 'any' ? [] : relationSchema.out_schema_ids)
    ]) {
      if (
        sourceEntitySchemaIds.has(entitySchemaId) ||
        existingEntitySchemaIds.has(entitySchemaId)
      ) {
        continue;
      }
      conflicts.push({
        type: 'relation_schemas',
        item_id: relationSchema.id,
        item_name: relationSchema.name,
        conflict_reason: 'missing_dependency',
        import_item: relationSchema,
        suggested_resolution: 'skip'
      });
      warnings.push(
        `Relation schema '${relationSchema.name}' references missing entity schema '${entitySchemaId}' and will be skipped`
      );
    }

    const includedSharedGroupIds = new Set(
      (relationSchema.shared_field_groups ?? []).map(group => group.id)
    );
    for (const link of relationSchema.shared_field_group_links ?? []) {
      if (includedSharedGroupIds.has(link.groupId) || existingSharedGroupIds.has(link.groupId)) {
        continue;
      }
      conflicts.push({
        type: 'relation_schemas',
        item_id: relationSchema.id,
        item_name: relationSchema.name,
        conflict_reason: 'missing_dependency',
        import_item: relationSchema,
        suggested_resolution: 'skip'
      });
      warnings.push(
        `Relation schema '${relationSchema.name}' references missing shared field group '${link.groupId}' and will be skipped`
      );
    }

    const unresolved = findUnresolvedFieldGroupReferences(
      relationSchema.fields as Array<{ id: string; name?: string; groupId?: string }>,
      (relationSchema.groups ?? []) as SchemaGroup[]
    );
    errors.push(
      ...unresolved.map(
        reference =>
          `Relation schema '${relationSchema.name}' field '${reference.fieldName}' references missing field group '${reference.groupId}'`
      )
    );

    if (relationSchema.relation_approval_policy === 'required') {
      errors.push(
        `Relation schema '${relationSchema.name}' uses unsupported approval policy 'required'; relation approval workflow is provided by #2574`
      );
    }
  }

  return { conflicts, warnings, errors };
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

const listAllRelations = async (db: DatabaseAdapter, workspace: string) => {
  const pageSize = 200;
  const relations = [] as Awaited<ReturnType<typeof db.relation.listRelations>>['items'];
  let offset = 0;
  while (true) {
    const page = await db.relation.listRelations(
      workspace,
      { schemaId: null, inEntityId: null, outEntityId: null },
      { limit: pageSize, offset }
    );
    if (page.items.length === 0) break;
    relations.push(...page.items);
    if (page.items.length < pageSize) break;
    offset += pageSize;
  }
  return relations;
};

const validateRelations = async (
  db: DatabaseAdapter,
  workspace: string,
  relations: ExportRelation[],
  relationSchemas?: ExportRelationSchema[],
  entities?: ExportEntity[]
): Promise<{ conflicts: ImportConflict[]; warnings: string[]; errors: string[] }> => {
  const conflicts: ImportConflict[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const [existingRelations, existingRelationSchemas, existingEntities] = await Promise.all([
    listAllRelations(db, workspace),
    db.relation.listRelationSchemas(workspace),
    db.catalog.listEntities(workspace)
  ]);
  const sourceRelationSchemaIds = new Set(relationSchemas?.map(schema => schema.id) ?? []);
  const sourceEntityIds = new Set(entities?.map(entity => entity.id) ?? []);
  const existingEntityIds = new Set(existingEntities.map(entity => entity.id));
  const sourceRelationSchemasById = new Map(
    (relationSchemas ?? []).map(schema => [schema.id, schema])
  );
  const sourceEntitiesById = new Map((entities ?? []).map(entity => [entity.id, entity]));

  for (const relation of relations) {
    const existingSchema = existingRelationSchemas.find(
      schema =>
        schema.id === relation.schema_id ||
        schema.name.toLowerCase() ===
          sourceRelationSchemasById.get(relation.schema_id)?.name.toLowerCase()
    );
    const targetSchemaId = existingSchema?.id ?? relation.schema_id;
    const existing = existingRelations.find(
      candidate =>
        candidate.id === relation.id ||
        (candidate.schema_id === targetSchemaId &&
          candidate.in_entity_id === relation.in_entity_id &&
          candidate.out_entity_id === relation.out_entity_id)
    );
    if (existing) {
      conflicts.push({
        type: 'relations',
        item_id: relation.id,
        item_name: `${relation.in_entity_id} → ${relation.out_entity_id}`,
        conflict_reason: 'duplicate_identity',
        existing_item: {
          id: existing.id,
          schema_id: existing.schema_id,
          in_entity_id: existing.in_entity_id,
          out_entity_id: existing.out_entity_id
        },
        import_item: relation,
        suggested_resolution: 'overwrite'
      });
    }

    if (!sourceRelationSchemaIds.has(relation.schema_id) && !existingSchema) {
      conflicts.push({
        type: 'relations',
        item_id: relation.id,
        item_name: `${relation.in_entity_id} → ${relation.out_entity_id}`,
        conflict_reason: 'missing_dependency',
        import_item: relation,
        suggested_resolution: 'skip'
      });
      warnings.push(
        `Relation '${relation.id}' references missing relation schema '${relation.schema_id}' and will be skipped`
      );
    }
    for (const endpointId of [relation.in_entity_id, relation.out_entity_id]) {
      if (sourceEntityIds.has(endpointId) || existingEntityIds.has(endpointId)) continue;
      conflicts.push({
        type: 'relations',
        item_id: relation.id,
        item_name: `${relation.in_entity_id} → ${relation.out_entity_id}`,
        conflict_reason: 'missing_dependency',
        import_item: relation,
        suggested_resolution: 'skip'
      });
      warnings.push(
        `Relation '${relation.id}' references missing entity '${endpointId}' and will be skipped`
      );
    }

    const schema = sourceRelationSchemasById.get(relation.schema_id);
    const inEntity = sourceEntitiesById.get(relation.in_entity_id);
    const outEntity = sourceEntitiesById.get(relation.out_entity_id);
    if (
      schema &&
      inEntity &&
      outEntity &&
      ((schema.in_schema_ids !== 'any' && !schema.in_schema_ids.includes(inEntity.schema_id)) ||
        (schema.out_schema_ids !== 'any' && !schema.out_schema_ids.includes(outEntity.schema_id)))
    ) {
      conflicts.push({
        type: 'relations',
        item_id: relation.id,
        item_name: `${relation.in_entity_id} → ${relation.out_entity_id}`,
        conflict_reason: 'schema_mismatch',
        import_item: relation,
        suggested_resolution: 'skip'
      });
    }

    const targetSchema = schema ?? existingSchema;
    if (targetSchema?.relation_approval_policy === 'required') {
      errors.push(
        `Relation '${relation.id}' uses unsupported approval policy 'required'; relation approval workflow is provided by #2574`
      );
    }
    if (relation.approval_policy_override === 'required') {
      errors.push(
        `Relation '${relation.id}' uses unsupported approval policy override 'required'; relation approval workflow is provided by #2574`
      );
    }
  }

  return { conflicts, warnings, errors };
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
