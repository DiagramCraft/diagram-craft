import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthorizationContext } from '@arch-register/permissions';
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
    const contentResult = await validateContentNodes(db, workspace, data.content_nodes);
    summary.content_nodes = {
      count: data.content_nodes.length,
      conflicts: contentResult.conflicts.length
    };
    conflicts.push(...contentResult.conflicts);
    warnings.push(...contentResult.warnings);
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
  authCtx: AuthorizationContext,
  workspace: string,
  options: ImportExecuteOptions,
  data: {
    config?: ExportConfig;
    schemas?: ExportSchema[];
    entities?: ExportEntity[];
    projects?: ExportProject[];
    content_nodes?: ExportContentNode[];
  }
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
    // Import in dependency order
    if (options.include.includes('config') && data.config) {
      result.imported.config = await importConfig(
        db,
        workspace,
        data.config,
        options.conflict_resolutions,
        idMapping
      );
    }

    if (options.include.includes('schemas') && data.schemas) {
      result.imported.schemas = await importSchemas(
        db,
        workspace,
        data.schemas,
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
        options.conflict_resolutions,
        idMapping
      );
    }

    if (options.include.includes('projects') && data.projects) {
      result.imported.projects = await importProjects(
        db,
        workspace,
        data.projects,
        options.conflict_resolutions,
        idMapping
      );
    }

    if (options.include.includes('content_nodes') && data.content_nodes) {
      result.imported.content_nodes = await importContentNodes(
        db,
        workspace,
        data.content_nodes,
        options.conflict_resolutions,
        idMapping
      );
    }
  } catch (error) {
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : 'Unknown error during import');
  }

  return result;
};

const importConfig = async (
  _db: DatabaseAdapter,
  _workspace: string,
  config: ExportConfig,
  resolutions: Record<string, { action: string; new_name?: string }>,
  idMapping: IdMapping
): Promise<{ lifecycle_states: number; teams: number; roles: number }> => {
  let lifecycleCount = 0;
  let teamCount = 0;
  let roleCount = 0;

  // Import lifecycle states
  for (const state of config.lifecycle_states) {
    const resolution = resolutions[state.id];
    if (resolution?.action === 'skip') continue;

    const newId = randomUUID();
    idMapping.lifecycle_states.set(state.id, newId);

    // Implementation would create or update lifecycle state
    lifecycleCount++;
  }

  // Import teams
  for (const team of config.teams) {
    const resolution = resolutions[team.id];
    if (resolution?.action === 'skip') continue;

    const newId = randomUUID();
    idMapping.teams.set(team.id, newId);

    // Implementation would create or update team
    teamCount++;
  }

  // Import roles
  for (const role of config.roles) {
    const resolution = resolutions[role.id];
    if (resolution?.action === 'skip') continue;

    // Implementation would create or update role
    roleCount++;
  }

  return { lifecycle_states: lifecycleCount, teams: teamCount, roles: roleCount };
};

const importSchemas = async (
  _db: DatabaseAdapter,
  _workspace: string,
  schemas: ExportSchema[],
  resolutions: Record<string, { action: string; new_name?: string }>,
  idMapping: IdMapping
): Promise<{ created: number; updated: number }> => {
  let created = 0;
  let updated = 0;

  for (const schema of schemas) {
    const resolution = resolutions[schema.id];
    if (resolution?.action === 'skip') continue;

    const newId = randomUUID();
    idMapping.schemas.set(schema.id, newId);

    // Implementation would create or update schema
    if (resolution?.action === 'overwrite') {
      updated++;
    } else {
      created++;
    }
  }

  return { created, updated };
};

const importEntities = async (
  _db: DatabaseAdapter,
  _authCtx: AuthorizationContext,
  _workspace: string,
  entities: ExportEntity[],
  resolutions: Record<string, { action: string; new_name?: string }>,
  idMapping: IdMapping
): Promise<{ created: number; updated: number; skipped: number }> => {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const entity of entities) {
    const resolution = resolutions[entity.id];
    if (resolution?.action === 'skip') {
      skipped++;
      continue;
    }

    const newId = randomUUID();
    idMapping.entities.set(entity.id, newId);

    // Implementation would create or update entity with mapped IDs
    if (resolution?.action === 'overwrite') {
      updated++;
    } else {
      created++;
    }
  }

  return { created, updated, skipped };
};

const importProjects = async (
  _db: DatabaseAdapter,
  _workspace: string,
  projects: ExportProject[],
  resolutions: Record<string, { action: string; new_name?: string }>,
  idMapping: IdMapping
): Promise<{ created: number; updated: number }> => {
  let created = 0;
  let updated = 0;

  for (const project of projects) {
    const resolution = resolutions[project.id];
    if (resolution?.action === 'skip') continue;

    const newId = randomUUID();
    idMapping.projects.set(project.id, newId);

    // Implementation would create or update project
    if (resolution?.action === 'overwrite') {
      updated++;
    } else {
      created++;
    }
  }

  return { created, updated };
};

const importContentNodes = async (
  _db: DatabaseAdapter,
  _workspace: string,
  contentNodes: ExportContentNode[],
  resolutions: Record<string, { action: string; new_name?: string }>,
  idMapping: IdMapping
): Promise<{ created: number; updated: number }> => {
  let created = 0;
  let updated = 0;

  for (const node of contentNodes) {
    const resolution = resolutions[node.id];
    if (resolution?.action === 'skip') continue;

    const newId = randomUUID();
    idMapping.content_nodes.set(node.id, newId);

    // Implementation would create or update content node
    if (resolution?.action === 'overwrite') {
      updated++;
    } else {
      created++;
    }
  }

  return { created, updated };
};
