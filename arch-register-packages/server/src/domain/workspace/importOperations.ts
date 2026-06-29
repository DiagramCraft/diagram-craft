import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter, ContentNodeDbUpsert, EntityDbCreate, SchemaDbCreate } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthorizationContext, WorkspaceCapability } from '@arch-register/permissions';
import { PermissionChecker } from '@arch-register/permissions';
import type {
  ExportManifest,
  ExportConfig,
  ExportSchema,
  ExportEntity,
  ExportProject,
  ExportContentNode,
  ImportParseResult,
  ImportConflict,
  ImportExecuteOptions,
  ImportExecuteResult,
  IdMapping
} from './exportTypes';

const checker = new PermissionChecker();

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
      const contentResult = await validateContentNodes(db, workspace, data.content_nodes);
      summary.content_nodes = {
        count: data.content_nodes.length,
        conflicts: contentResult.conflicts.length
      };
      conflicts.push(...contentResult.conflicts);
      warnings.push(...contentResult.warnings);
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
    warnings
  };
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
    const existing = existingSchemas.find(
      s => s.name.toLowerCase() === schema.name.toLowerCase()
    );
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
  _db: DatabaseAdapter,
  _workspace: string,
  entities: ExportEntity[],
  _schemas?: ExportSchema[]
): Promise<{ conflicts: ImportConflict[]; warnings: string[] }> => {
  const conflicts: ImportConflict[] = [];
  const warnings: string[] = [];

  // TODO: Implement when listEntities method is available
  // For now, just return empty conflicts
  warnings.push(`Entity validation skipped - ${entities.length} entities to import`);

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
  _db: DatabaseAdapter,
  _workspace: string,
  contentNodes: ExportContentNode[]
): Promise<{ conflicts: ImportConflict[]; warnings: string[] }> => {
  const conflicts: ImportConflict[] = [];
  const warnings: string[] = [];

  // TODO: Implement when listAllContentNodes or similar method is available
  warnings.push(`Content node validation skipped - ${contentNodes.length} nodes to import`);

  return { conflicts, warnings };
};

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
  },
  contentFiles?: Map<string, Buffer>
): Promise<ImportExecuteResult> => {
  const result: ImportExecuteResult = {
    success: true,
    imported: {},
    errors: [],
    warnings: []
  };

  const idMapping: IdMapping = {
    schemas: new Map(),
    entities: new Map(),
    teams: new Map(),
    lifecycle_states: new Map(),
    projects: new Map(),
    content_nodes: new Map()
  };

  try {
    if (options.include.includes('config') && data.config) {
      result.imported.config = await importConfig(
        db,
        workspace,
        data.config,
        options.preserve_ids ?? false,
        options.conflict_resolutions,
        idMapping
      );
    }

    if (options.include.includes('schemas') && data.schemas) {
      result.imported.schemas = await importSchemas(
        db,
        workspace,
        data.schemas,
        options.preserve_ids ?? false,
        options.conflict_resolutions,
        idMapping
      );
    }

    if (options.include.includes('entities') && data.entities) {
      result.imported.entities = await importEntities(
        db,
        authCtx,
        workspace,
        data.entities,
        options.preserve_ids ?? false,
        options.conflict_resolutions,
        idMapping
      );
    }

    if (options.include.includes('projects') && data.projects) {
      result.imported.projects = await importProjects(
        db,
        workspace,
        data.projects,
        options.preserve_ids ?? false,
        options.conflict_resolutions,
        idMapping
      );
    }

    if (options.include.includes('content_nodes') && data.content_nodes) {
      result.imported.content_nodes = await importContentNodes(
        db,
        storage,
        authCtx,
        workspace,
        data.content_nodes,
        options.preserve_ids ?? false,
        options.conflict_resolutions,
        idMapping,
        contentFiles
      );
    }
  } catch (error) {
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : 'Unknown error during import');
  }

  return result;
};

type ImportResolution = { action: string; new_name?: string };

const resolveMappedId = (mapping: Map<string, string>, id: string | null | undefined) => {
  if (id == null) return null;
  return mapping.get(id) ?? id;
};

const hasSkipResolution = (
  resolutions: Record<string, ImportResolution>,
  id: string
) => resolutions[id]?.action === 'skip';

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
    if (hasSkipResolution(resolutions, state.id)) return [];
    const nextId = preserveIds ? state.id : randomUUID();
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
    if (hasSkipResolution(resolutions, team.id)) return [];
    const nextId = preserveIds ? team.id : randomUUID();
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
  const existingSchemas = new Map((await db.catalog.listSchemas(workspace)).map(schema => [schema.id, schema]));
  const mappedSchemas = schemas.flatMap(schema => {
    if (hasSkipResolution(resolutions, schema.id)) return [];
    const nextId = preserveIds ? schema.id : randomUUID();
    idMapping.schemas.set(schema.id, nextId);
    return [{ schema, nextId }];
  });

  let created = 0;
  let updated = 0;

  for (const { schema, nextId } of mappedSchemas) {
    const existing = existingSchemas.get(nextId);
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

    const input: SchemaDbCreate = {
      id: nextId,
      workspace,
      name: schema.name,
      description: existing?.description ?? '',
      fields,
      color: schema.color,
      icon: schema.icon,
      default_owner: resolveMappedId(idMapping.teams, schema.default_owner),
      key_prefix: schema.key_prefix ?? '',
      created_at: existing?.created_at ?? now,
      updated_at: now
    };

    if (existing) {
      const previousKeyPrefix = existing.key_prefix;
      const row = await db.catalog.updateSchema(workspace, nextId, {
        name: input.name,
        description: input.description,
        fields: input.fields,
        color: input.color,
        icon: input.icon,
        default_owner: input.default_owner,
        key_prefix: input.key_prefix,
        updated_at: now
      });
      if (row?.key_prefix && row.key_prefix !== previousKeyPrefix) {
        if (previousKeyPrefix) {
          await db.workspace.updatePublicIdPrefix(previousKeyPrefix, row.key_prefix, 'schema', row.id, now);
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
  const existingEntities = new Map((await db.catalog.listEntities(workspace)).map(entity => [entity.id, entity]));
  const mappedEntities = entities.flatMap(entity => {
    if (hasSkipResolution(resolutions, entity.id)) return [];
    const nextId = preserveIds ? entity.id : randomUUID();
    idMapping.entities.set(entity.id, nextId);
    return [{ entity, nextId }];
  });

  let created = 0;
  let updated = 0;
    const skipped = 0;

  for (const { entity, nextId } of mappedEntities) {
    const existing = existingEntities.get(nextId);
    const input: EntityDbCreate = {
      id: nextId,
      workspace,
      public_id: entity.public_id ?? nextId,
      schema_id: resolveMappedId(idMapping.schemas, entity.schema_id) ?? entity.schema_id,
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
  const existingProjects = new Map((await db.project.listProjects(workspace)).map(project => [project.id, project]));
  const mappedProjects = projects.flatMap(project => {
    if (hasSkipResolution(resolutions, project.id)) return [];
    const nextId = preserveIds ? project.id : randomUUID();
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
        public_id: nextId,
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
  const existingNodes = new Map((await db.project.listAllContentNodes(workspace)).map(node => [node.id, node]));
  const mappedNodes = contentNodes.flatMap(node => {
    if (hasSkipResolution(resolutions, node.id)) return [];
    const nextId = preserveIds ? node.id : randomUUID();
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
    const storageProjectId = storageScope(workspace, { project_id: projectId, entity_id: entityId });

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
      await storage.write(workspace, storageProjectId, row.id, contentFiles.get(node.content_file)!);
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
