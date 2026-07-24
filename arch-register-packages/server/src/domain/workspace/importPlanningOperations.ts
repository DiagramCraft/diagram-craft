import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';

import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';

import type {
  ExportConfig,
  ExportSchema,
  ExportEntity,
  ExportProject,
  ExportContentNode,
  ImportExecuteOptions,
  IdMapping,
  ImportDiagnostic,
  WorkspaceImportPlan,
  ExportDocumentData
} from './exportTypes';

import { parseImport } from './importParseOperations';

type ImportResolution = { action: string; new_name?: string };

const resolveMappedId = (mapping: Map<string, string>, id: string | null | undefined) => {
  if (id == null) return null;
  return mapping.get(id) ?? id;
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

export const buildImportPlan = async (
  db: DatabaseAdapter,
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

export const applyConflictRenames = <
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

const storageScope = (
  workspace: string,
  node: { project_id: string | null; entity_id: string | null }
) => node.project_id ?? node.entity_id ?? workspace;
