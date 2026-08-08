import { createHash } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import { PermissionChecker } from '@arch-register/permissions';
import { httpAssert } from '../../utils/httpAssert';
import { filterKnownRestrictedFieldGroups } from '../auth/fieldGroupAccessControl';
import { filterRelationFieldData } from '../catalog/relationHelpers';
import { canViewTypedRelation } from '../catalog/relationAccessControl';
import { listAllRelations } from '../catalog/relationOperations';
import type {
  ExportOptions,
  ExportManifest,
  ExportConfig,
  ExportSchema,
  ExportRelationSchema,
  ExportEntity,
  ExportRelation,
  ExportDiagnostic,
  ExportProject,
  ExportContentNode,
  ExportDocumentData,
  ExportSharedFieldGroup
} from './exportTypes';
import type { SharedFieldGroupLink } from '@arch-register/api-types/schemaContract';
import type { SharedFieldGroupDbResult } from '../catalog/db/catalogDatabase';
import { DOCUMENT_STATUS_CASE_KIND } from '../document/documentWorkflowOperations';
import { parseGovernanceWorkflowConfig } from '../governance/governanceWorkflowConfig';
import {
  ENTITY_CHANGE_POLICY_CASE_KIND,
  ENTITY_DEPRECATION_POLICY_CASE_KIND,
  getSchemaGovernancePoliciesBySchema
} from '../governance/schemaGovernancePolicy';

const checker = new PermissionChecker();

// Shared by exportSchemas and exportRelationSchemas: both resolve a schema's
// `shared_field_group_links` into the full `ExportSharedFieldGroup` definitions the archive embeds
// alongside the schema, so an import can recreate the groups without a separate lookup pass.
const resolveSharedFieldGroups = (
  links: SharedFieldGroupLink[] | undefined,
  sharedGroupsById: Map<string, SharedFieldGroupDbResult>
): ExportSharedFieldGroup[] =>
  (links ?? []).flatMap(link => {
    const group = sharedGroupsById.get(link.groupId);
    return group
      ? [
          {
            id: group.id,
            name: group.name,
            description: group.description,
            fields: group.fields,
            sort_order: group.sort_order
          }
        ]
      : [];
  });

export const exportWorkspace = async (
  db: DatabaseAdapter,
  storage: StorageAdapter | undefined,
  authCtx: WorkspaceAuthorizationContext,
  workspace: string,
  options: ExportOptions
): Promise<{
  manifest: ExportManifest;
  data: {
    config?: ExportConfig;
    schemas?: ExportSchema[];
    relation_schemas?: ExportRelationSchema[];
    entities?: ExportEntity[];
    relations?: ExportRelation[];
    projects?: ExportProject[];
    content_nodes?: ExportContentNode[];
    documents?: ExportDocumentData;
  };
  contentFiles?: Map<string, Buffer>;
}> => {
  // Check export permission
  httpAssert.true(checker.hasWorkspaceCapability(authCtx, 'ws.settings'), {
    status: 403,
    message: 'You do not have permission to export this workspace'
  });

  const workspaceData = await db.workspace.getWorkspace(workspace);
  httpAssert.present(workspaceData, { status: 404, message: 'Workspace not found' });

  const exportedAt = new Date().toISOString();
  const user = await db.auth.getUser(authCtx.userId);
  const exportedBy = user?.email ?? user?.display_name ?? authCtx.userId;

  const data: {
    config?: ExportConfig;
    schemas?: ExportSchema[];
    relation_schemas?: ExportRelationSchema[];
    entities?: ExportEntity[];
    relations?: ExportRelation[];
    projects?: ExportProject[];
    content_nodes?: ExportContentNode[];
    documents?: ExportDocumentData;
  } = {};

  const statistics = {
    entity_count: 0,
    project_count: 0,
    schema_count: 0,
    relation_schema_count: 0,
    relation_count: 0,
    content_node_count: 0,
    total_content_size_bytes: 0,
    document_type_count: 0,
    document_template_count: 0,
    document_revision_count: 0
  };

  // Export configuration
  if (options.include.includes('config')) {
    data.config = await exportConfig(db, workspace);
  }

  // Export schemas
  if (options.include.includes('schemas')) {
    data.schemas = await exportSchemas(db, workspace);
    statistics.schema_count = data.schemas.length;
  }

  const exportDiagnostics: ExportDiagnostic[] = [];

  // Export typed relation schemas. Relation schemas may be useful on their own, but their
  // endpoint schema dependencies are recorded when entity schemas are not part of the archive.
  if (options.include.includes('relation_schemas')) {
    data.relation_schemas = await exportRelationSchemas(db, workspace);
    statistics.relation_schema_count = data.relation_schemas.length;
    const entitySchemaIds = new Set(data.schemas?.map(schema => schema.id) ?? []);
    for (const relationSchema of data.relation_schemas) {
      const referencedEntitySchemaIds = new Set([
        ...(relationSchema.in_schema_ids === 'any' ? [] : relationSchema.in_schema_ids),
        ...(relationSchema.out_schema_ids === 'any' ? [] : relationSchema.out_schema_ids)
      ]);
      for (const entitySchemaId of referencedEntitySchemaIds) {
        if (entitySchemaIds.has(entitySchemaId)) continue;
        exportDiagnostics.push({
          code: 'missing_reference',
          item_type: 'relation_schemas',
          item_id: relationSchema.id,
          message: `Relation schema '${relationSchema.name}' references entity schema '${entitySchemaId}', which is not included in the export`
        });
      }
    }
  }

  // Export entities
  if (options.include.includes('entities')) {
    data.entities = await exportEntities(
      db,
      authCtx,
      workspace,
      options.entity_filters,
      options.include_grants ?? false
    );
    statistics.entity_count = data.entities.length;
  }

  if (options.include.includes('relations')) {
    const result = await exportRelations(
      db,
      authCtx,
      workspace,
      data.relation_schemas,
      data.entities
    );
    data.relations = result.relations;
    exportDiagnostics.push(...result.diagnostics);
    statistics.relation_count = data.relations.length;
  }

  // Export projects
  if (options.include.includes('projects')) {
    data.projects = await exportProjects(db, workspace, options.project_ids);
    statistics.project_count = data.projects.length;
  }

  // Export content nodes
  let contentFiles: Map<string, Buffer> | undefined;
  if (options.include.includes('content_nodes')) {
    const result = await exportContentNodes(
      db,
      storage,
      workspace,
      options.project_ids,
      options.include_content ?? true
    );
    data.content_nodes = result.nodes;
    contentFiles = result.contentFiles;
    statistics.content_node_count = result.nodes.length;
    statistics.total_content_size_bytes = result.nodes.reduce(
      (sum, node) => sum + node.size_bytes,
      0
    );
  }

  if (options.include.includes('documents')) {
    data.documents = await exportDocuments(db, workspace, options.project_ids);
    statistics.document_type_count = data.documents.types.length;
    statistics.document_template_count = data.documents.templates.length;
    statistics.document_revision_count = data.documents.revisions.length;
  }

  const manifest: ExportManifest = {
    version: '1.0',
    format: 'zip-multi-file',
    exported_at: exportedAt,
    exported_by: exportedBy,
    source_workspace: {
      id: workspaceData.id,
      name: workspaceData.name,
      url_slug: workspaceData.url_slug
    },
    export_options: options.include,
    files: {
      ...(data.config && { config: 'config.json' }),
      ...(data.schemas && { schemas: 'schemas.json' }),
      ...(data.relation_schemas && { relation_schemas: 'relation-schemas.json' }),
      ...(data.entities && { entities: 'entities.json' }),
      ...(data.relations && { relations: 'relations.json' }),
      ...(data.projects && { projects: 'projects.json' }),
      ...(data.content_nodes && { content_nodes: 'content-nodes.json' }),
      ...(data.documents && { documents: 'documents.json' }),
      ...(data.content_nodes && options.include_content && { content_directory: 'content/' })
    },
    statistics,
    checksums: {},
    ...(exportDiagnostics.length > 0 && { export_diagnostics: exportDiagnostics })
  };

  return { manifest, data, contentFiles };
};

const exportConfig = async (db: DatabaseAdapter, workspace: string): Promise<ExportConfig> => {
  const [lifecycleStates, teams, customRoles] = await Promise.all([
    db.workspace.listLifecycleStates(workspace),
    db.workspace.listTeams(workspace),
    db.workspace.listCustomWorkspaceRoles(workspace)
  ]);

  return {
    lifecycle_states: lifecycleStates.map(state => ({
      id: state.id,
      label: state.label,
      color: state.color,
      sort_order: state.sort_order
    })),
    teams: teams.map(team => ({
      id: team.id,
      name: team.name,
      sort_order: team.sort_order,
      color: team.color,
      description: team.description
    })),
    roles: customRoles.map(role => ({
      id: role.id,
      name: role.name,
      description: role.description,
      tone: role.tone,
      capabilities: role.capabilities
    }))
  };
};

const exportSchemas = async (db: DatabaseAdapter, workspace: string): Promise<ExportSchema[]> => {
  const [schemas, policiesBySchema, governanceRows] = await Promise.all([
    db.catalog.listSchemas(workspace),
    getSchemaGovernancePoliciesBySchema(db, workspace),
    db.governanceCaseConfig?.listCaseConfig(workspace) ?? Promise.resolve([])
  ]);
  const sharedGroups = await db.catalog.listSharedFieldGroups(workspace);
  const sharedGroupsById = new Map(sharedGroups.map(group => [group.id, group]));
  const governanceRowsBySchema = new Map<string, ExportSchema['governance_configs']>();
  for (const row of governanceRows) {
    if (
      row.case_subkind == null ||
      (row.case_kind !== ENTITY_CHANGE_POLICY_CASE_KIND &&
        row.case_kind !== ENTITY_DEPRECATION_POLICY_CASE_KIND)
    ) {
      continue;
    }
    const rows = governanceRowsBySchema.get(row.case_subkind) ?? [];
    rows.push({
      case_kind: row.case_kind,
      enabled: row.enabled,
      config: parseGovernanceWorkflowConfig(row.config, row.enabled)
    });
    governanceRowsBySchema.set(row.case_subkind, rows);
  }

  return schemas.map(schema => ({
    id: schema.id,
    name: schema.name,
    fields: schema.fields,
    groups: schema.groups ?? [],
    shared_field_group_links: schema.shared_field_group_links ?? [],
    shared_field_groups: resolveSharedFieldGroups(
      schema.shared_field_group_links,
      sharedGroupsById
    ),
    templates: schema.templates ?? [],
    color: schema.color,
    icon: schema.icon,
    default_owner: schema.default_owner,
    key_prefix: schema.key_prefix,
    entity_approval_policy: policiesBySchema.get(schema.id)?.entity_approval_policy ?? 'disabled',
    deprecation_policy: policiesBySchema.get(schema.id)?.deprecation_policy ?? 'disabled',
    governance_configs: governanceRowsBySchema.get(schema.id) ?? []
  }));
};

const exportRelationSchemas = async (
  db: DatabaseAdapter,
  workspace: string
): Promise<ExportRelationSchema[]> => {
  const [schemas, sharedGroups] = await Promise.all([
    db.relation.listRelationSchemas(workspace),
    db.catalog.listSharedFieldGroups(workspace)
  ]);
  const sharedGroupsById = new Map(sharedGroups.map(group => [group.id, group]));

  return schemas.map(schema => ({
    id: schema.id,
    name: schema.name,
    description: schema.description,
    in_schema_ids: schema.in_schema_ids,
    out_schema_ids: schema.out_schema_ids,
    fields: schema.fields,
    groups: schema.groups ?? [],
    shared_field_group_links: schema.shared_field_group_links ?? [],
    shared_field_groups: resolveSharedFieldGroups(
      schema.shared_field_group_links,
      sharedGroupsById
    ),
    color: schema.color,
    icon: schema.icon,
    relation_approval_policy: schema.relation_approval_policy ?? 'disabled',
    version: schema.version ?? 1
  }));
};

const exportRelations = async (
  db: DatabaseAdapter,
  authCtx: WorkspaceAuthorizationContext,
  workspace: string,
  relationSchemas?: ExportRelationSchema[],
  entities?: ExportEntity[]
): Promise<{ relations: ExportRelation[]; diagnostics: ExportDiagnostic[] }> => {
  const rows = await listAllRelations(db, workspace, {});

  const relationSchemaIds = new Set(relationSchemas?.map(schema => schema.id) ?? []);
  const entityIds = new Set(entities?.map(entity => entity.id) ?? []);
  const entitySchemas = await db.catalog.listSchemas(workspace);
  const entitySchemaById = new Map(entitySchemas.map(schema => [schema.id, schema]));
  const exportedEntitySchemaByEntityId = new Map(
    (entities ?? []).map(entity => [entity.id, entitySchemaById.get(entity.schema_id)])
  );
  const diagnostics: ExportDiagnostic[] = [];
  const relations: ExportRelation[] = [];

  for (const row of rows) {
    if (!relationSchemaIds.has(row.schema_id)) {
      diagnostics.push({
        code: 'missing_reference',
        item_type: 'relations',
        item_id: row.id,
        message: `Relation '${row.id}' references relation schema '${row.schema_id}', which is not included in the export`
      });
      continue;
    }
    if (!entityIds.has(row.in_entity_id) || !entityIds.has(row.out_entity_id)) {
      diagnostics.push({
        code: 'filtered_reference',
        item_type: 'relations',
        item_id: row.id,
        message: `Relation '${row.id}' was omitted because both endpoint entities must be included in the export`
      });
      continue;
    }
    if (
      !canViewTypedRelation(
        authCtx,
        [
          {
            schema: exportedEntitySchemaByEntityId.get(row.in_entity_id),
            direction: 'in'
          },
          {
            schema: exportedEntitySchemaByEntityId.get(row.out_entity_id),
            direction: 'out'
          }
        ],
        row.schema_id
      )
    ) {
      diagnostics.push({
        code: 'filtered_reference',
        item_type: 'relations',
        item_id: row.id,
        message: `Relation '${row.id}' was omitted because its typed relation owner field is not visible to the exporter`
      });
      continue;
    }
    const schema = relationSchemas?.find(item => item.id === row.schema_id);
    relations.push({
      id: row.id,
      schema_id: row.schema_id,
      in_entity_id: row.in_entity_id,
      out_entity_id: row.out_entity_id,
      data: filterRelationFieldData(
        authCtx,
        schema as Parameters<typeof filterRelationFieldData>[1],
        row.data
      ),
      version: row.version,
      approval_policy_override: row.approval_policy_override,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString()
    });
  }

  return { relations, diagnostics };
};

const exportEntities = async (
  db: DatabaseAdapter,
  authCtx: WorkspaceAuthorizationContext,
  workspace: string,
  filters?: {
    schema_ids?: string[];
    owner_ids?: string[];
    lifecycle_ids?: string[];
    include_subtrees?: boolean;
  },
  includeGrants = false
): Promise<ExportEntity[]> => {
  const schemas = await db.catalog.listSchemas(workspace);
  const schemaById = new Map(schemas.map(schema => [schema.id, schema]));

  let entities = await db.catalog.listEntities(workspace);

  if (filters?.schema_ids?.length) {
    entities = entities.filter(e => filters.schema_ids!.includes(e.schema_id));
  }
  if (filters?.owner_ids?.length) {
    entities = entities.filter(e => e.owner !== null && filters.owner_ids!.includes(e.owner));
  }
  if (filters?.lifecycle_ids?.length) {
    entities = entities.filter(
      e => e.lifecycle !== null && filters.lifecycle_ids!.includes(e.lifecycle)
    );
  }

  const grantsMap = new Map<string, Awaited<ReturnType<typeof db.catalog.getEntityGrants>>>();
  if (includeGrants) {
    await Promise.all(
      entities.map(async e => {
        grantsMap.set(e.id, await db.catalog.getEntityGrants(workspace, e.id));
      })
    );
  }

  return entities.map(e => ({
    id: e.id,
    public_id: e.public_id,
    schema_id: e.schema_id,
    name: e.name,
    slug: e.slug,
    namespace: e.namespace,
    description: e.description,
    owner: e.owner,
    lifecycle: e.lifecycle,
    target_lifecycle: e.target_lifecycle,
    target_lifecycle_date: e.target_lifecycle_date,
    tags: e.tags,
    links: e.links,
    data: filterKnownRestrictedFieldGroups(authCtx, schemaById.get(e.schema_id) ?? null, e.data),
    project_id: e.project_id,
    ...(includeGrants && {
      grants: (grantsMap.get(e.id) ?? []).map(g => ({
        id: g.id,
        principal_type: g.principal_type,
        principal_id: g.principal_id,
        role: g.role,
        applies_to: g.applies_to
      }))
    })
  }));
};

const exportProjects = async (
  db: DatabaseAdapter,
  workspace: string,
  projectIds?: string[]
): Promise<ExportProject[]> => {
  let projects = await db.project.listProjects(workspace);

  // Filter by project IDs if specified
  if (projectIds && projectIds.length > 0) {
    projects = projects.filter(p => projectIds.includes(p.id));
  }

  return projects.map(project => ({
    id: project.id,
    name: project.name,
    description: project.description,
    owner: project.owner,
    status: project.status as 'pinned' | 'active' | 'archived',
    color: project.color
  }));
};

const exportContentNodes = async (
  db: DatabaseAdapter,
  storage: StorageAdapter | undefined,
  workspace: string,
  projectIds?: string[],
  includeContent = true
): Promise<{ nodes: ExportContentNode[]; contentFiles: Map<string, Buffer> }> => {
  let contentNodes = await db.project.listAllContentNodes(workspace);

  // Filter by project IDs if specified
  if (projectIds && projectIds.length > 0) {
    contentNodes = contentNodes.filter(
      node => node.project_id && projectIds.includes(node.project_id)
    );
  }

  const nodes: ExportContentNode[] = [];
  const contentFiles = new Map<string, Buffer>();

  for (const node of contentNodes) {
    const exportNode: ExportContentNode = {
      id: node.id,
      project_id: node.project_id,
      entity_id: node.entity_id,
      parent_id: node.parent_id,
      path: node.path,
      name: node.name,
      type: node.type,
      size_bytes: node.size_bytes,
      is_template: node.is_template,
      is_workspace_template: node.is_workspace_template
    };

    // Add content file references and read actual content if requested
    if (includeContent && node.type !== 'folder' && storage) {
      try {
        const fileExt = node.type === 'diagram' ? 'json' : node.type === 'markdown' ? 'md' : 'bin';
        const contentPath = `content/${node.type}s/${node.id}.${fileExt}`;
        exportNode.content_file = contentPath;

        // Read actual file content from storage
        const storageScope = node.project_id ?? node.entity_id ?? workspace;
        const content = await storage.read(workspace, storageScope, node.id);
        contentFiles.set(contentPath, content);

        // Handle preview SVG if available
        if (node.preview_svg) {
          const previewPath = `content/${node.type}s/${node.id}.svg`;
          exportNode.preview_file = previewPath;
          contentFiles.set(previewPath, Buffer.from(node.preview_svg, 'utf-8'));
        }
      } catch (error) {
        // If file cannot be read, skip it but keep the node metadata
        console.warn(`Failed to read content for node ${node.id}:`, error);
      }
    }

    nodes.push(exportNode);
  }

  return { nodes, contentFiles };
};

const exportDocuments = async (
  db: DatabaseAdapter,
  workspace: string,
  projectIds?: string[]
): Promise<ExportDocumentData> => {
  const nodes = await db.project.listAllContentNodes(workspace);
  const includedNodes = projectIds?.length
    ? nodes.filter(node => node.project_id != null && projectIds.includes(node.project_id))
    : nodes;
  const metadata = [] as ExportDocumentData['metadata'];
  const revisions = [] as ExportDocumentData['revisions'];
  for (const node of includedNodes.filter(item => item.type === 'markdown')) {
    const state = await db.document.getDocumentMetadata(workspace, node.id);
    if (state)
      metadata.push({
        node_id: node.id,
        document_type_id: state.document_type_id,
        values: state.values,
        generated_metadata: state.generated_metadata,
        links: (await db.document.listDocumentLinks(workspace, node.id)).map(link => ({
          field_id: link.field_id,
          target_type: link.target_type,
          target_id: link.target_id,
          position: link.position
        }))
      });
    for (const revision of await db.project.listMarkdownRevisions(workspace, node.id)) {
      revisions.push({
        id: revision.id,
        node_id: revision.node_id,
        revision_number: revision.revision_number,
        title: revision.title,
        body: revision.body,
        created_at: revision.created_at.toISOString(),
        created_by: revision.created_by,
        restored_from_revision_id: revision.restored_from_revision_id,
        document_type_id: revision.document_type_id,
        metadata: revision.metadata
      });
    }
  }
  const workflowConfigs = (
    await db.governanceCaseConfig.listCaseConfigForKind(workspace, DOCUMENT_STATUS_CASE_KIND)
  ).flatMap(row =>
    row.case_subkind
      ? [
          {
            case_kind: row.case_kind,
            case_subkind: row.case_subkind,
            enabled: row.enabled,
            config: parseGovernanceWorkflowConfig(row.config, row.enabled)
          }
        ]
      : []
  );
  return {
    types: (await db.document.listDocumentTypes(workspace, true)).map(type => ({
      ...type,
      created_at: type.created_at.toISOString(),
      updated_at: type.updated_at.toISOString()
    })),
    templates: (await db.document.listDocumentTemplates(workspace, undefined, true))
      .filter(
        template =>
          !projectIds?.length ||
          template.project_id == null ||
          projectIds.includes(template.project_id)
      )
      .map(template => ({
        ...template,
        created_at: template.created_at.toISOString(),
        updated_at: template.updated_at.toISOString()
      })),
    metadata,
    revisions,
    workflow_configs: workflowConfigs
  };
};

export const calculateChecksum = (content: string): string => {
  return createHash('sha256').update(content).digest('hex');
};
