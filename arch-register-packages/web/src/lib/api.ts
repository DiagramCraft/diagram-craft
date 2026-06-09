import type { GlobalRole, TeamRole } from '@arch-register/permissions';
import { SCHEMA_COLORS } from '@arch-register/api-types/colors';
import type {
  Workspace,
  EntitySchema,
  SchemaField,
  TextField,
  BooleanField,
  DateField,
  SelectField,
  ApiSelectField,
  ReferenceField,
  ContainmentField,
  EntityRecord,
  EntitySummary,
  EntityLink,
  Project,
  ProjectDetail,
  ProjectFile,
  FileTree,
  AuditLogEntry,
  WorkspaceLifecycleState,
  WorkspaceOwnerOption,
  WorkspaceRoleDefinition,
  WorkspaceMemberInfo,
  WorkspaceUserInfo,
  CreateWorkspaceRoleRequest,
  UpdateWorkspaceRoleRequest,
  ProjectTemplatesResponse,
  WorkspaceEnum,
  WatchedEntity,
  PinnedEntity,
  NotificationItem,
  NotificationCount
} from '@arch-register/api-types';
import type {
  SavedView,
  CreateSavedViewRequest,
  UpdateSavedViewRequest
} from '@arch-register/api-types/views';
import type {
  SerializedDiagram,
  SerializedDiagramDocument,
  SerializedLayer,
  SerializedStyles
} from '@diagram-craft/model/serialization/serializedTypes';
import { fetchWithAuthResponse } from '../auth/authClient';

// Re-export commonly used types for convenience
export type {
  Workspace,
  EntitySchema,
  SchemaField,
  TextField,
  BooleanField,
  DateField,
  SelectField,
  ApiSelectField,
  ReferenceField,
  ContainmentField,
  EntityRecord,
  EntitySummary,
  EntityLink,
  Project,
  ProjectDetail,
  ProjectFile,
  FileTree,
  AuditLogEntry,
  WorkspaceLifecycleState,
  WorkspaceOwnerOption,
  WorkspaceRoleDefinition,
  WorkspaceMemberInfo,
  WorkspaceUserInfo,
  WorkspaceEnum,
  SavedView,
  WatchedEntity,
  PinnedEntity,
  NotificationItem,
  NotificationCount
};

export type FieldType = SchemaField['type'];

export const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'longtext', label: 'Long text' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select' },
  { value: 'reference', label: 'Reference' },
  { value: 'containment', label: 'Containment' }
];

export const schemaColor = (index: number): string => SCHEMA_COLORS[index % SCHEMA_COLORS.length]!;

export const resolveSchemaColor = (schema: EntitySchema, index: number): string =>
  schema.color ?? schemaColor(index);

export const SCHEMA_ICONS = [
  'box',
  'api',
  'server',
  'database',
  'cloud',
  'lock',
  'users',
  'globe',
  'cpu',
  'network',
  'folder',
  'terminal',
  'plug',
  'layers',
  'git-branch',
  'shield',
  'code',
  'message',
  'settings',
  'chart',
  'bell',
  'key',
  'mail',
  'map-pin',
  'clipboard',
  'tag',
  'link',
  'truck',
  'heart',
  'rocket',
  'building',
  'package',
  'puzzle',
  'wand',
  'eye',
  'flame',
  'snowflake',
  'compass',
  'antenna',
  'certificate',
  'bolt',
  'palette',
  'microscope'
] as const;

export type SchemaIconId = (typeof SCHEMA_ICONS)[number];

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export const apiFetchResponse = async (
  path: string,
  init?: RequestInit,
  options?: { requiresAuth?: boolean; retryOnUnauthorized?: boolean }
) => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...init?.headers
  };

  const res = await fetchWithAuthResponse(
    path,
    {
      ...init,
      headers
    },
    options
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? res.statusText);
  }

  return res;
};

export const apiFetch = async <T>(
  path: string,
  init?: RequestInit,
  options?: { requiresAuth?: boolean; retryOnUnauthorized?: boolean }
): Promise<T> => {
  const res = await apiFetchResponse(path, init, options);
  return res.json();
};

// ── Entity types ──────────────────────────────────────────────

export type EntityFacetBucket = {
  value: string | null;
  count: number;
};

export type EntitySchemaFacetBucket = {
  schemaId: string;
  count: number;
};

export type EntityFacets = {
  total: number;
  lifecycle: EntityFacetBucket[];
  owner: EntityFacetBucket[];
  schema: EntitySchemaFacetBucket[];
  completeness: { below50: number; below80: number; above80: number };
};

export type EntityRelation = {
  entityId: string;
  entitySlug: string;
  entityName: string;
  entitySchemaId: string;
  fieldName: string;
  kind: 'reference' | 'containment';
};

export type EntityRelations = {
  outgoing: EntityRelation[];
  incoming: EntityRelation[];
};

type FetchEntitiesOptions = {
  schemaId?: string | null;
  owner?: string | null;
  lifecycle?: string | null;
  q?: string | null;
  view?: 'summary' | 'full';
  limit?: number | null;
  offset?: number | null;
};

const buildQuery = (params: Record<string, string | number | null | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return;
    search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

export const fetchEntities = (workspace: string, options: FetchEntitiesOptions = {}) =>
  apiFetch<EntityRecord[]>(
    `/api/${workspace}/data${buildQuery({
      _schemaId: options.schemaId ?? null,
      owner: options.owner ?? null,
      lifecycle: options.lifecycle ?? null,
      q: options.q ?? null,
      view: options.view ?? 'full',
      limit: options.limit ?? null,
      offset: options.offset ?? null
    })}`
  );

export type TreeNode = EntitySummary & { _isMatch: boolean };

export type TreeEdge = { childId: string; parentId: string };

export type TreeResponse = {
  nodes: TreeNode[];
  edges: TreeEdge[];
};

export const fetchEntityTree = (workspace: string, options: FetchEntitiesOptions = {}) =>
  apiFetch<TreeResponse>(
    `/api/${workspace}/data/tree${buildQuery({
      _schemaId: options.schemaId ?? null,
      owner: options.owner ?? null,
      lifecycle: options.lifecycle ?? null,
      q: options.q ?? null
    })}`
  );

export const exportEntitiesToCSV = (
  workspace: string,
  options: FetchEntitiesOptions = {}
): Promise<Blob> => {
  return apiFetchResponse(
    `/api/${workspace}/data/export${buildQuery({
      _schemaId: options.schemaId ?? null,
      owner: options.owner ?? null,
      lifecycle: options.lifecycle ?? null,
      q: options.q ?? null
    })}`
  ).then(res => res.blob());
};

export const downloadCsvTemplate = (workspace: string, schemaId: string): Promise<Blob> => {
  return apiFetchResponse(`/api/${workspace}/data/import/template/${schemaId}`).then(res =>
    res.blob()
  );
};

export const parseCsvImport = (
  workspace: string,
  schemaId: string,
  csvContent: string
): Promise<{
  schemaId: string;
  schemaName: string;
  totalRows: number;
  validRows: number;
  entities: Array<{
    rowNumber: number;
    errors: string[];
    entity: Record<string, unknown> | null;
    isUpdate: boolean;
    matchType?: 'id' | 'slug' | 'name' | 'none';
    nameMatches?: Array<{ id: string; name: string; slug?: string; namespace?: string }>;
    existingId?: string;
    existingEntity?: Record<string, unknown> | null;
    constraintViolations?: Array<{
      type: 'duplicate_slug' | 'wrong_workspace' | 'wrong_schema';
      message: string;
    }>;
  }>;
}> => {
  return apiFetch(`/api/${workspace}/data/import/parse`, {
    method: 'POST',
    body: JSON.stringify({ schemaId, csvContent })
  });
};

export const commitCsvImport = (
  workspace: string,
  schemaId: string,
  entities: Array<Record<string, unknown>>
): Promise<{ created: number; updated: number; ids: string[] }> => {
  return apiFetch(`/api/${workspace}/data/import/commit`, {
    method: 'POST',
    body: JSON.stringify({ schemaId, entities })
  });
};

export const fetchEntity = (workspace: string, id: string) =>
  apiFetch<EntityRecord>(`/api/${workspace}/data/${id}`);

export const createEntity = (
  workspace: string,
  entity: {
    _schemaId: string;
    _name: string;
    _slug?: string;
    _namespace?: string;
    _description?: string;
    _owner?: string | null;
    _lifecycle?: string | null;
    _tags?: string[];
    _links?: EntityLink[];
    _visibilityMode?: 'public' | 'restricted';
    [key: string]: unknown;
  }
) =>
  apiFetch<EntityRecord>(`/api/${workspace}/data`, {
    method: 'POST',
    body: JSON.stringify(entity)
  });

export const deleteEntity = (workspace: string, id: string) =>
  apiFetch<{ success: boolean }>(`/api/${workspace}/data/${id}`, { method: 'DELETE' });

export const cloneEntity = (workspace: string, id: string) =>
  apiFetch<EntityRecord>(`/api/${workspace}/data/${id}/clone`, { method: 'POST' });

export const fetchEntityFacets = (workspace: string) =>
  apiFetch<EntityFacets>(`/api/${workspace}/data/facets`);

export const fetchEntityRelations = (workspace: string, id: string) =>
  apiFetch<EntityRelations>(`/api/${workspace}/data/${id}/relations`);

// ── Saved View API ────────────────────────────────────────────

export const fetchSavedViews = (workspace: string) =>
  apiFetch<SavedView[]>(`/api/${workspace}/views`);

export const createSavedView = (workspace: string, body: CreateSavedViewRequest) =>
  apiFetch<SavedView>(`/api/${workspace}/views`, {
    method: 'POST',
    body: JSON.stringify(body)
  });

export const updateSavedView = (workspace: string, id: string, body: UpdateSavedViewRequest) =>
  apiFetch<SavedView>(`/api/${workspace}/views/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });

export const deleteSavedView = (workspace: string, id: string) =>
  apiFetch<{ success: boolean }>(`/api/${workspace}/views/${id}`, {
    method: 'DELETE'
  });

// ── Project types ─────────────────────────────────────────────

export type ProjectSearchResult = {
  id: string;
  name: string;
  description: string;
  status: Project['status'];
};

export type ProjectFileSearchResult = {
  projectId: string;
  projectName: string;
  fileId: string;
  path: string;
  name: string;
};

export type EntitySearchResult = {
  entityId: string;
  schemaId: string;
  schemaName: string;
  _name: string;
  _slug: string;
  _description: string;
  _owner: string | null;
  _lifecycle: string | null;
  _targetLifecycle: string | null;
  matchedFields: string[];
  matchedMetadata: string[];
};

export type SchemaSearchResult = {
  schemaId: string;
  name: string;
  fieldMatches: Array<{ fieldId: string; fieldName: string }>;
};

export type SearchResponse = {
  query: string;
  projects: ProjectSearchResult[];
  files: ProjectFileSearchResult[];
  entities: EntitySearchResult[];
  schemas: SchemaSearchResult[];
};

// ── Project API ───────────────────────────────────────────────

export const fetchProjects = (workspace: string) =>
  apiFetch<Project[]>(`/api/${workspace}/projects`);

export const fetchProject = (workspace: string, id: string) =>
  apiFetch<ProjectDetail>(`/api/${workspace}/projects/${id}`);

export const fetchProjectFiles = (workspace: string, id: string) =>
  apiFetch<FileTree>(`/api/${workspace}/projects/${id}/files`);

export const searchArchRegister = (
  workspace: string,
  options: {
    q: string;
    limitPerType?: number | null;
    types?: Array<'projects' | 'files' | 'entities' | 'schemas'> | null;
  }
) =>
  apiFetch<SearchResponse>(
    `/api/${workspace}/search${buildQuery({
      q: options.q,
      limitPerType: options.limitPerType ?? null,
      types: options.types?.join(',') ?? null
    })}`
  );

export const createProject = (
  workspace: string,
  body: {
    name: string;
    description?: string;
    owner?: string | null;
    status?: 'pinned' | 'active' | 'archived';
    color?: string | null;
  }
) =>
  apiFetch<Project>(`/api/${workspace}/projects`, {
    method: 'POST',
    body: JSON.stringify(body)
  });

export const updateProject = (
  workspace: string,
  id: string,
  body: {
    name: string;
    description?: string;
    owner?: string | null;
    status?: 'pinned' | 'active' | 'archived';
    color?: string | null;
  }
) =>
  apiFetch<Project>(`/api/${workspace}/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body)
  });

export const deleteProject = (workspace: string, id: string) =>
  apiFetch<{ success: boolean }>(`/api/${workspace}/projects/${id}`, {
    method: 'DELETE'
  });

const randomId = () => Math.random().toString(36).substring(2, 9);

const makeEmptyDiagramTab = (name: string): SerializedDiagram => {
  const diagramId = randomId();
  const layerId = randomId();

  const layers: SerializedLayer[] = [
    {
      id: layerId,
      name: 'Default',
      type: 'layer',
      layerType: 'regular',
      elements: [],
      isLocked: false
    }
  ];

  return {
    id: diagramId,
    name,
    layers,
    activeLayerId: layerId,
    visibleLayers: [layerId],
    diagrams: [],
    comments: [],
    zoom: { x: 0, y: 0, zoom: 1 },
    canvas: { x: -20, y: -20, w: 1076, h: 904 }
  };
};

const makeEmptyDiagramStyles = (): SerializedStyles => ({
  edgeStyles: [
    {
      id: 'default-edge',
      name: 'Default',
      props: { stroke: { color: 'var(--canvas-fg)' }, type: 'straight' },
      type: 'edge'
    }
  ],
  nodeStyles: [
    {
      id: 'default',
      name: 'Default',
      props: {
        fill: { color: 'var(--canvas-bg2)' },
        stroke: { color: 'var(--canvas-fg)' },
        text: { color: 'var(--canvas-fg)' }
      },
      type: 'node'
    },
    {
      id: 'default-text',
      name: 'Text',
      props: {
        fill: { enabled: false },
        stroke: { enabled: false },
        text: { color: 'var(--canvas-fg)' }
      },
      type: 'node'
    }
  ],
  textStyles: [
    {
      id: 'default-text-default',
      name: 'Default',
      props: {
        text: { fontSize: 10, font: 'sans-serif', top: 0, left: 0, right: 0, bottom: 0 }
      },
      type: 'text'
    },
    {
      id: 'h1',
      name: 'H1',
      props: {
        text: {
          fontSize: 20,
          bold: true,
          font: 'sans-serif',
          align: 'left',
          top: 6,
          left: 6,
          right: 6,
          bottom: 6
        }
      },
      type: 'text'
    }
  ]
});

const emptyDiagram = (name: string) => {
  const diagram = makeEmptyDiagramTab(name);
  return {
    name,
    diagrams: [diagram],
    attachments: {},
    customPalette: Array(14).fill('#000000'),
    styles: makeEmptyDiagramStyles(),
    schemas: [
      {
        id: 'default',
        name: 'Default',
        providerId: 'default',
        fields: [
          { id: 'name', name: 'Name', type: 'text' },
          { id: 'notes', name: 'Notes', type: 'longtext' }
        ]
      }
    ],
    schemaMetadata: {
      default: { availableForElementLocalData: false, useDocumentOverrides: false }
    },
    props: {
      query: { history: [], saved: [] },
      stencils: ['default@@rect'],
      activeStencilPackages: [],
      recentEdgeStylesheets: []
    },
    data: {
      providers: [
        {
          id: 'default',
          providerId: 'defaultDataProvider',
          data: '{"schemas":[{"id":"default","name":"Default","providerId":"default","fields":[{"id":"name","name":"Name","type":"text"},{"id":"notes","name":"Notes","type":"longtext"}]}],"data":[]}'
        }
      ],
      templates: [],
      overrides: {}
    },
    activeDiagramId: diagram.id,
    hash: randomId() + randomId()
  };
};

export const prepareTemplateDiagramDocument = <
  T extends SerializedDiagramDocument & { name?: string }
>(
  templateContent: T,
  name: string
): T & { name: string } => {
  const diagrams = templateContent.diagrams.slice(1);
  const fallbackDiagram = makeEmptyDiagramTab('Sheet 1');
  const nextDiagrams = diagrams.length > 0 ? diagrams : [fallbackDiagram];

  return {
    ...templateContent,
    name,
    diagrams: nextDiagrams,
    activeDiagramId: nextDiagrams[0]!.id
  } as T & { name: string };
};

// Local alias for backward compatibility
export type FileEntry = ProjectFile;

export const createDiagramFile = (
  workspace: string,
  projectId: string,
  name: string,
  folder?: string | null
) => {
  const fileName = `${name}.json`;
  const filePath = folder ? `${folder}/${fileName}` : fileName;
  return apiFetch<ProjectFile>(`/api/${workspace}/projects/${projectId}/files/${filePath}`, {
    method: 'PUT',
    body: JSON.stringify(emptyDiagram(name))
  });
};

export const createFolder = (workspace: string, projectId: string, path: string) =>
  apiFetch<{ success: boolean; path: string }>(`/api/${workspace}/projects/${projectId}/folders`, {
    method: 'POST',
    body: JSON.stringify({ path })
  });

export const deleteProjectFile = (workspace: string, projectId: string, filePath: string) =>
  apiFetch<{ success: boolean }>(`/api/${workspace}/projects/${projectId}/files/${filePath}`, {
    method: 'DELETE'
  });

export const deleteProjectFolder = (workspace: string, projectId: string, folderPath: string) =>
  apiFetch<{ success: boolean }>(`/api/${workspace}/projects/${projectId}/folders/${folderPath}`, {
    method: 'DELETE'
  });

export const renameProjectFolder = (
  workspace: string,
  projectId: string,
  oldPath: string,
  newPath: string
) =>
  apiFetch<{ success: boolean }>(`/api/${workspace}/projects/${projectId}/folders/rename`, {
    method: 'PUT',
    body: JSON.stringify({ oldPath, newPath })
  });

export const fetchProjectFileContent = (workspace: string, projectId: string, filePath: string) =>
  apiFetch<Record<string, unknown>>(`/api/${workspace}/projects/${projectId}/files/${filePath}`);

export const cloneProjectFile = async (workspace: string, projectId: string, file: ProjectFile) => {
  const content = await fetchProjectFileContent(workspace, projectId, file.path);
  const baseName = file.name;
  const cloneName = `${baseName} (copy)`;
  const folder = file.path.includes('/')
    ? file.path.substring(0, file.path.lastIndexOf('/'))
    : null;
  const clonePath = folder ? `${folder}/${cloneName}.json` : `${cloneName}.json`;
  if (content && typeof content === 'object' && 'name' in content) {
    (content as Record<string, unknown>).name = cloneName;
  }
  return apiFetch<ProjectFile>(`/api/${workspace}/projects/${projectId}/files/${clonePath}`, {
    method: 'PUT',
    body: JSON.stringify(content)
  });
};

// Unified relocate function for move/rename operations
export const relocateProjectFile = async (
  workspace: string,
  projectId: string,
  file: ProjectFile,
  newPath: string
) => {
  return apiFetch<ProjectFile>(
    `/api/${workspace}/projects/${projectId}/files/relocate/${file.path}`,
    {
      method: 'PUT',
      body: JSON.stringify({ newPath })
    }
  );
};

// Convenience wrapper for move operation
export const moveProjectFile = async (
  workspace: string,
  projectId: string,
  file: ProjectFile,
  targetFolder: string | null
) => {
  const fileName = file.path.includes('/')
    ? file.path.substring(file.path.lastIndexOf('/') + 1)
    : file.path;

  const newPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;

  return relocateProjectFile(workspace, projectId, file, newPath);
};

// Convenience wrapper for rename operation
export const renameProjectFile = async (
  workspace: string,
  projectId: string,
  file: ProjectFile,
  newName: string
) => {
  const folder = file.path.includes('/')
    ? file.path.substring(0, file.path.lastIndexOf('/'))
    : null;

  const newPath = folder ? `${folder}/${newName}.json` : `${newName}.json`;

  return relocateProjectFile(workspace, projectId, file, newPath);
};

// ── Template API ──────────────────────────────────────────────

export const fetchProjectTemplates = (workspace: string, projectId: string) =>
  apiFetch<ProjectTemplatesResponse>(`/api/${workspace}/projects/${projectId}/templates`);

export const toggleTemplateStatus = (
  workspace: string,
  projectId: string,
  filePath: string,
  isTemplate: boolean,
  isWorkspaceTemplate: boolean
) =>
  apiFetch<ProjectFile>(`/api/${workspace}/projects/${projectId}/template-status/${filePath}`, {
    method: 'PUT',
    body: JSON.stringify({
      is_template: isTemplate,
      is_workspace_template: isWorkspaceTemplate
    })
  });

export const createDiagramFromTemplate = async (
  workspace: string,
  projectId: string,
  name: string,
  templateFile: ProjectFile,
  folder?: string | null
) => {
  // Fetch template content from the template's project (not the current project)
  const templateContent = await fetchProjectFileContent(
    workspace,
    templateFile.project_id,
    templateFile.path
  );

  const newContent = prepareTemplateDiagramDocument(
    templateContent as unknown as SerializedDiagramDocument & { name?: string },
    name
  );

  // Create new diagram (template flags are in database, not file content)
  const fileName = `${name}.json`;
  const filePath = folder ? `${folder}/${fileName}` : fileName;

  return apiFetch<ProjectFile>(`/api/${workspace}/projects/${projectId}/files/${filePath}`, {
    method: 'PUT',
    body: JSON.stringify(newContent)
  });
};

// ── Audit Log API ─────────────────────────────────────────────

export type AuditOperation = 'create' | 'update' | 'delete';

export type AuditEntityType = 'workspace' | 'entity_schema' | 'entity' | 'project' | 'project_file';

export type AuditStats = {
  total: number;
  byOperation: Array<{ operation: string; count: number }>;
  byEntityType: Array<{ entity_type: string; count: number }>;
  recentActivity: Array<{ date: string; count: number }>;
};

type FetchAuditLogOptions = {
  entityType?: string | null;
  entityId?: string | null;
  operation?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  limit?: number | null;
  offset?: number | null;
};

export const fetchAuditLog = (workspace: string, options: FetchAuditLogOptions = {}) =>
  apiFetch<AuditLogEntry[]>(
    `/api/${workspace}/audit${buildQuery({
      entityType: options.entityType ?? null,
      entityId: options.entityId ?? null,
      operation: options.operation ?? null,
      startDate: options.startDate ?? null,
      endDate: options.endDate ?? null,
      limit: options.limit ?? null,
      offset: options.offset ?? null
    })}`
  );

export const fetchAuditStats = (workspace: string) =>
  apiFetch<AuditStats>(`/api/${workspace}/audit/stats`);

// ── Watches / Notifications API ──────────────────────────────

export const fetchWatchedEntities = (workspace: string) =>
  apiFetch<WatchedEntity[]>(`/api/${workspace}/watching`);

export const createWatch = (workspace: string, entityId: string) =>
  apiFetch<WatchedEntity>(`/api/${workspace}/watching`, {
    method: 'POST',
    body: JSON.stringify({ entity_id: entityId })
  });

export const deleteWatch = (workspace: string, entityId: string) =>
  apiFetch<{ success: boolean; message: string }>(`/api/${workspace}/watching/${entityId}`, {
    method: 'DELETE'
  });

export const fetchPinnedEntities = (workspace: string) =>
  apiFetch<PinnedEntity[]>(`/api/${workspace}/pinned-entities`);

export const createPinnedEntity = (workspace: string, entityId: string) =>
  apiFetch<PinnedEntity>(`/api/${workspace}/pinned-entities`, {
    method: 'POST',
    body: JSON.stringify({ entity_id: entityId })
  });

export const deletePinnedEntity = (workspace: string, entityId: string) =>
  apiFetch<{ success: boolean; message: string }>(`/api/${workspace}/pinned-entities/${entityId}`, {
    method: 'DELETE'
  });

export const fetchNotifications = (workspace: string) =>
  apiFetch<NotificationItem[]>(`/api/${workspace}/notifications`);

export const fetchNotificationCount = (workspace: string) =>
  apiFetch<NotificationCount>(`/api/${workspace}/notifications/count`);

export const deleteNotification = (workspace: string, notificationId: string) =>
  apiFetch<{ success: boolean; message: string }>(
    `/api/${workspace}/notifications/${notificationId}`,
    {
      method: 'DELETE'
    }
  );

export const clearNotifications = (workspace: string) =>
  apiFetch<{ success: boolean; count: number; message: string }>(
    `/api/${workspace}/notifications`,
    {
      method: 'DELETE'
    }
  );

// ── Workspace Config API ─────────────────────────────────────

export type WorkspaceTeam = {
  id: string;
  sort_order: number;
  color: string | null;
  description: string;
};

export const fetchLifecycleStates = (workspace: string) =>
  apiFetch<WorkspaceLifecycleState[]>(`/api/${workspace}/config/lifecycle-states`);

export const updateLifecycleStates = (workspace: string, states: WorkspaceLifecycleState[]) =>
  apiFetch<WorkspaceLifecycleState[]>(`/api/${workspace}/config/lifecycle-states`, {
    method: 'PUT',
    body: JSON.stringify(states)
  });

export const fetchTeams = (workspace: string) =>
  apiFetch<WorkspaceTeam[]>(`/api/${workspace}/config/teams`);

export const updateTeams = (workspace: string, teams: WorkspaceTeam[]) =>
  apiFetch<WorkspaceTeam[]>(`/api/${workspace}/config/teams`, {
    method: 'PUT',
    body: JSON.stringify(teams)
  });

// ── Workspace Members ──────────────────────────────────────────

export const fetchWorkspaceMembers = (workspace: string) =>
  apiFetch<WorkspaceMemberInfo[]>(`/api/${workspace}/config/members`);

export const fetchWorkspaceUsers = (workspace: string) =>
  apiFetch<WorkspaceUserInfo[]>(`/api/${workspace}/config/users`);

export const fetchWorkspaceRoles = (workspace: string) =>
  apiFetch<WorkspaceRoleDefinition[]>(`/api/${workspace}/config/roles`);

export const createWorkspaceRole = (workspace: string, role: CreateWorkspaceRoleRequest) =>
  apiFetch<WorkspaceRoleDefinition>(`/api/${workspace}/config/roles`, {
    method: 'POST',
    body: JSON.stringify(role)
  });

export const updateWorkspaceRole = (
  workspace: string,
  roleId: string,
  role: UpdateWorkspaceRoleRequest
) =>
  apiFetch<WorkspaceRoleDefinition>(`/api/${workspace}/config/roles/${roleId}`, {
    method: 'PUT',
    body: JSON.stringify(role)
  });

export const deleteWorkspaceRole = (workspace: string, roleId: string) =>
  apiFetch<WorkspaceRoleDefinition>(`/api/${workspace}/config/roles/${roleId}`, {
    method: 'DELETE'
  });

export type TeamAssignmentInfo = {
  workspace: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  created_at: string;
};

export const fetchTeamAssignments = (workspace: string) =>
  apiFetch<TeamAssignmentInfo[]>(`/api/${workspace}/config/team-assignments`);

export const updateTeamAssignments = (
  workspace: string,
  assignments: Array<Pick<TeamAssignmentInfo, 'team_id' | 'user_id' | 'role'>>
) =>
  apiFetch<TeamAssignmentInfo[]>(`/api/${workspace}/config/team-assignments`, {
    method: 'PUT',
    body: JSON.stringify(assignments)
  });

export const updateWorkspaceMemberRole = (workspace: string, userId: string, role: string) =>
  apiFetch<WorkspaceMemberInfo>(`/api/${workspace}/config/members/${userId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role })
  });

// ── Global Role Admin ─────────────────────────────────────────

export type AuthUserInfo = {
  id: string;
  email: string | null;
  display_name: string;
  auth_provider: 'local' | 'oidc';
  is_active: boolean;
};

export type GlobalRoleAssignment = {
  user_id: string;
  role: GlobalRole;
  created_at: string;
};

export const fetchAuthUsers = () => apiFetch<AuthUserInfo[]>(`/api/auth/users`);

export const fetchUserGlobalRoles = (userId: string) =>
  apiFetch<GlobalRoleAssignment[]>(`/api/auth/users/${userId}/global-roles`);

export const updateUserGlobalRoles = (userId: string, roles: GlobalRole[]) =>
  apiFetch<GlobalRoleAssignment[]>(`/api/auth/users/${userId}/global-roles`, {
    method: 'PUT',
    body: JSON.stringify({ roles })
  });
