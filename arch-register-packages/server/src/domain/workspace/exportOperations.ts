import { createHash } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthorizationContext } from '@arch-register/permissions';
import { PermissionChecker } from '@arch-register/permissions';
import { httpAssert } from '../../utils/httpAssert';
import type {
  ExportOptions,
  ExportManifest,
  ExportConfig,
  ExportSchema,
  ExportEntity,
  ExportProject,
  ExportContentNode,
  ExportDocumentData
} from './exportTypes';

const checker = new PermissionChecker();

export const exportWorkspace = async (
  db: DatabaseAdapter,
  storage: StorageAdapter | undefined,
  authCtx: AuthorizationContext,
  workspace: string,
  options: ExportOptions
): Promise<{
  manifest: ExportManifest;
  data: {
    config?: ExportConfig;
    schemas?: ExportSchema[];
    entities?: ExportEntity[];
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
    entities?: ExportEntity[];
    projects?: ExportProject[];
    content_nodes?: ExportContentNode[];
    documents?: ExportDocumentData;
  } = {};

  const statistics = {
    entity_count: 0,
    project_count: 0,
    schema_count: 0,
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
      ...(data.entities && { entities: 'entities.json' }),
      ...(data.projects && { projects: 'projects.json' }),
      ...(data.content_nodes && { content_nodes: 'content-nodes.json' }),
      ...(data.documents && { documents: 'documents.json' }),
      ...(data.content_nodes && options.include_content && { content_directory: 'content/' })
    },
    statistics,
    checksums: {}
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
  const schemas = await db.catalog.listSchemas(workspace);

  return schemas.map(schema => ({
    id: schema.id,
    name: schema.name,
    fields: schema.fields,
    templates: schema.templates ?? [],
    color: schema.color,
    icon: schema.icon,
    default_owner: schema.default_owner,
    key_prefix: schema.key_prefix
  }));
};

const exportEntities = async (
  db: DatabaseAdapter,
  _authCtx: AuthorizationContext,
  workspace: string,
  filters?: {
    schema_ids?: string[];
    owner_ids?: string[];
    lifecycle_ids?: string[];
    include_subtrees?: boolean;
  },
  includeGrants = false
): Promise<ExportEntity[]> => {
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
    data: e.data,
    visibility_mode: e.visibility_mode as ExportEntity['visibility_mode'],
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
    if (includeContent && node.type !== 'folder' && storage && node.project_id) {
      try {
        const fileExt = node.type === 'diagram' ? 'json' : node.type === 'markdown' ? 'md' : 'bin';
        const contentPath = `content/${node.type}s/${node.id}.${fileExt}`;
        exportNode.content_file = contentPath;

        // Read actual file content from storage
        const content = await storage.read(workspace, node.project_id, node.id);
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
    if (state) metadata.push({ node_id: node.id, document_type_id: state.document_type_id, values: state.values, links: (await db.document.listDocumentLinks(workspace, node.id)).map(link => ({ field_id: link.field_id, target_type: link.target_type, target_id: link.target_id, position: link.position })) });
    for (const revision of await db.project.listMarkdownRevisions(workspace, node.id)) {
      revisions.push({ id: revision.id, node_id: revision.node_id, revision_number: revision.revision_number, title: revision.title, body: revision.body, created_at: revision.created_at.toISOString(), created_by: revision.created_by, restored_from_revision_id: revision.restored_from_revision_id, document_type_id: revision.document_type_id, metadata: revision.metadata });
    }
  }
  return {
    types: (await db.document.listDocumentTypes(workspace, true)).map(type => ({ ...type, created_at: type.created_at.toISOString(), updated_at: type.updated_at.toISOString() })),
    templates: (await db.document.listDocumentTemplates(workspace, undefined, true)).map(template => ({ ...template, created_at: template.created_at.toISOString(), updated_at: template.updated_at.toISOString() })),
    metadata,
    revisions
  };
};

export const calculateChecksum = (content: string): string => {
  return createHash('sha256').update(content).digest('hex');
};
