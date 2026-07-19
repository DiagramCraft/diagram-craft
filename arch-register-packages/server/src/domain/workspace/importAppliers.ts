import { createHash, randomUUID } from 'node:crypto';
import type {
  DatabaseAdapter,
  ContentNodeDbUpsert,
  EntityDbCreate,
  SchemaDbCreate
} from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';

import type {
  WorkspaceAuthorizationContext,
  WorkspaceCapability
} from '@arch-register/permissions';
import { formatPublicId } from '../../utils/publicIds';
import { httpAssert } from '../../utils/httpAssert';

import { entityRequiresApproval } from '../catalog/entityChangeOperations';
import type { DocumentField, DocumentMetadata } from '@arch-register/api-types/documentContract';
import type {
  ExportConfig,
  ExportSchema,
  ExportEntity,
  ExportProject,
  ExportContentNode,
  IdMapping,
  ExportDocumentData
} from './exportTypes';

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

export const importConfig = async (
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

export const importSchemas = async (
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

export const importEntities = async (
  db: DatabaseAdapter,
  _authCtx: WorkspaceAuthorizationContext,
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

export const importProjects = async (
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

export const importContentNodes = async (
  db: DatabaseAdapter,
  storage: StorageAdapter | undefined,
  authCtx: WorkspaceAuthorizationContext,
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

export const importDocuments = async (
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
