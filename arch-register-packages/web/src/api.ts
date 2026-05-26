// ── Workspace types ───────────────────────────────────────────

export type Workspace = {
  id: string;
  name: string;
  url_slug: string;
  short_code: string;
  description: string;
  created_at: string;
  updated_at: string;
};

// ── Schema field types ────────────────────────────────────────

export type TextField = {
  id: string;
  name: string;
  type: 'text' | 'longtext';
};

export type BooleanField = {
  id: string;
  name: string;
  type: 'boolean';
};

export type SelectField = {
  id: string;
  name: string;
  type: 'select';
  options: Array<{ value: string; label: string }>;
};

export type ReferenceField = {
  id: string;
  name: string;
  type: 'reference';
  schemaId: string;
  minCount: number;
  maxCount: number;
};

export type ContainmentField = {
  id: string;
  name: string;
  type: 'containment';
  schemaId: string;
  minCount: number;
  maxCount: number;
};

export type SchemaField = TextField | BooleanField | SelectField | ReferenceField | ContainmentField;

export type FieldType = SchemaField['type'];

export const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'longtext', label: 'Long text' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'select', label: 'Select' },
  { value: 'reference', label: 'Reference' },
  { value: 'containment', label: 'Containment' },
];

export type EntitySchema = {
  id: string;
  workspace: string;
  name: string;
  fields: SchemaField[];
  color: string | null;
  icon: string | null;
  entity_count: number;
  created_at: string;
  updated_at: string;
};

export const SCHEMA_COLORS = [
  'var(--tag-component)',
  'var(--tag-api)',
  'var(--tag-service)',
  'var(--tag-database)',
  'var(--tag-system)',
  'var(--danger)',
  'oklch(0.65 0.15 340)',
  'oklch(0.65 0.12 170)',
  'oklch(0.65 0.14 200)',
  'oklch(0.70 0.14 55)',
];

export const schemaColor = (index: number): string =>
  SCHEMA_COLORS[index % SCHEMA_COLORS.length]!;

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
  'microscope',
] as const;

export type SchemaIconId = (typeof SCHEMA_ICONS)[number];

const BASE = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const apiFetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? res.statusText);
  }
  return res.json();
};

// ── Entity types ──────────────────────────────────────────────

export type EntityLink = {
  url: string;
  title: string;
  type?: string;
};

export type EntitySummary = {
  _uid: string;
  _workspace: string;
  _schemaId: string;
  _name: string;
  _slug: string;
  _namespace: string;
  _description: string;
  _owner: string | null;
  _lifecycle: string | null;
  _tags: string[];
  _links: EntityLink[];
};

export type EntityRecord = EntitySummary & {
  [key: string]: unknown;
};

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
      offset: options.offset ?? null,
    })}`
  );

export const exportEntitiesToCSV = (workspace: string, options: FetchEntitiesOptions = {}): Promise<Blob> => {
  const url = `${BASE}/api/${workspace}/data/export${buildQuery({
    _schemaId: options.schemaId ?? null,
    owner: options.owner ?? null,
    lifecycle: options.lifecycle ?? null,
    q: options.q ?? null,
  })}`;
  
  return fetch(url)
    .then(res => {
      if (!res.ok) throw new ApiError(res.status, res.statusText);
      return res.blob();
    });
};

export const fetchEntity = (workspace: string, id: string) =>
  apiFetch<EntityRecord>(`/api/${workspace}/data/${id}`);

export const fetchEntityFacets = (workspace: string) =>
  apiFetch<EntityFacets>(`/api/${workspace}/data/facets`);

export const fetchEntityRelations = (workspace: string, id: string) =>
  apiFetch<EntityRelations>(`/api/${workspace}/data/${id}/relations`);

// ── Project types ─────────────────────────────────────────────

export type Project = {
  id: string;
  workspace: string;
  name: string;
  description: string;
  status: 'pinned' | 'active' | 'archived';
  file_count: number;
  created_at: string;
  updated_at: string;
};

export type FileEntry = {
  id: string;
  path: string;
  name: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
};

export type FileTree = {
  folders: Array<{ path: string; files: FileEntry[] }>;
  rootFiles: FileEntry[];
};

export type ProjectDetail = Project & { files: FileTree };

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
      types: options.types?.join(',') ?? null,
    })}`
  );

export const createProject = (
  workspace: string,
  body: { name: string; description?: string; status?: 'pinned' | 'active' | 'archived' }
) =>
  apiFetch<Project>(`/api/${workspace}/projects`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const updateProject = (
  workspace: string,
  id: string,
  body: { name: string; description?: string; status?: 'pinned' | 'active' | 'archived' }
) =>
  apiFetch<Project>(`/api/${workspace}/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

export const deleteProject = (workspace: string, id: string) =>
  apiFetch<{ success: boolean }>(`/api/${workspace}/projects/${id}`, {
    method: 'DELETE',
  });

const randomId = () => Math.random().toString(36).substring(2, 9);

const emptyDiagram = (name: string) => {
  const diagramId = randomId();
  const layerId = randomId();
  return {
    name,
    diagrams: [{
      id: diagramId,
      name,
      layers: [{
        id: layerId,
        name: 'Default',
        type: 'layer',
        layerType: 'regular',
        elements: [],
        isLocked: false,
      }],
      activeLayerId: layerId,
      visibleLayers: [layerId],
      diagrams: [],
      comments: [],
      zoom: { x: 0, y: 0, zoom: 1 },
      canvas: { x: -20, y: -20, w: 1076, h: 904, r: 0 },
    }],
    attachments: {},
    customPalette: Array(14).fill('#000000'),
    styles: {
      edgeStyles: [{
        _snapshotType: 'stylesheet', id: 'default-edge', name: 'Default',
        props: { stroke: { color: 'var(--canvas-fg)' }, type: 'straight' }, type: 'edge',
      }],
      nodeStyles: [
        {
          _snapshotType: 'stylesheet', id: 'default', name: 'Default',
          props: { fill: { color: 'var(--canvas-bg2)' }, stroke: { color: 'var(--canvas-fg)' }, text: { color: 'var(--canvas-fg)' } }, type: 'node',
        },
        {
          _snapshotType: 'stylesheet', id: 'default-text', name: 'Text',
          props: { fill: { enabled: false }, stroke: { enabled: false }, text: { color: 'var(--canvas-fg)' } }, type: 'node',
        },
      ],
      textStyles: [
        {
          _snapshotType: 'stylesheet', id: 'default-text-default', name: 'Default',
          props: { text: { fontSize: 10, font: 'sans-serif', top: 0, left: 0, right: 0, bottom: 0 } }, type: 'text',
        },
        {
          _snapshotType: 'stylesheet', id: 'h1', name: 'H1',
          props: { text: { fontSize: 20, bold: true, font: 'sans-serif', align: 'left', top: 6, left: 6, right: 6, bottom: 6 } }, type: 'text',
        },
      ],
    },
    schemas: [{ id: 'default', name: 'Default', providerId: 'default', fields: [{ id: 'name', name: 'Name', type: 'text' }, { id: 'notes', name: 'Notes', type: 'longtext' }] }],
    schemaMetadata: { default: { availableForElementLocalData: false, useDocumentOverrides: false } },
    props: { query: { history: [], saved: [] }, stencils: ['default@@rect'], activeStencilPackages: [], recentEdgeStylesheets: [] },
    data: {
      providers: [{ id: 'default', providerId: 'defaultDataProvider', data: '{"schemas":[{"id":"default","name":"Default","providerId":"default","fields":[{"id":"name","name":"Name","type":"text"},{"id":"notes","name":"Notes","type":"longtext"}]}],"data":[]}' }],
      templates: [],
      overrides: {},
    },
    activeDiagramId: diagramId,
    hash: randomId() + randomId(),
  };
};

export type ProjectFile = FileEntry;

export const createDiagramFile = (workspace: string, projectId: string, name: string, folder?: string | null) => {
  const fileName = `${name}.json`;
  const filePath = folder ? `${folder}/${fileName}` : fileName;
  return apiFetch<FileEntry>(`/api/${workspace}/projects/${projectId}/files/${filePath}`, {
    method: 'PUT',
    body: JSON.stringify(emptyDiagram(name)),
  });
};

export const createFolder = (workspace: string, projectId: string, path: string) =>
  apiFetch<{ success: boolean; path: string }>(`/api/${workspace}/projects/${projectId}/folders`, {
    method: 'POST',
    body: JSON.stringify({ path }),
  });

// ── Audit Log API ─────────────────────────────────────────────

export type AuditOperation = 'create' | 'update' | 'delete';

export type AuditEntityType = 'workspace' | 'entity_schema' | 'entity' | 'project' | 'project_file';

export type AuditLogEntry = {
  id: string;
  workspace: string;
  timestamp: string;
  user_id: string;
  operation: AuditOperation;
  entity_type: AuditEntityType;
  entity_id: string;
  entity_name: string;
  entity_slug: string | null;
  schema_id: string | null;
  changes: {
    old?: Record<string, unknown>;
    new?: Record<string, unknown>;
  };
  metadata: Record<string, unknown>;
};

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
      offset: options.offset ?? null,
    })}`
  );

export const fetchAuditStats = (workspace: string) =>
  apiFetch<AuditStats>(`/api/${workspace}/audit/stats`);

// ── Workspace Config API ─────────────────────────────────────

export type WorkspaceLifecycleState = {
  id: string;
  label: string;
  color: string;
  sort_order: number;
};

export type WorkspaceOwnerOption = {
  id: string;
  sort_order: number;
};

export const fetchLifecycleStates = (workspace: string) =>
  apiFetch<WorkspaceLifecycleState[]>(`/api/${workspace}/config/lifecycle-states`);

export const updateLifecycleStates = (workspace: string, states: WorkspaceLifecycleState[]) =>
  apiFetch<WorkspaceLifecycleState[]>(`/api/${workspace}/config/lifecycle-states`, {
    method: 'PUT',
    body: JSON.stringify(states),
  });

export const fetchOwnerOptions = (workspace: string) =>
  apiFetch<WorkspaceOwnerOption[]>(`/api/${workspace}/config/owners`);

export const updateOwnerOptions = (workspace: string, owners: WorkspaceOwnerOption[]) =>
  apiFetch<WorkspaceOwnerOption[]>(`/api/${workspace}/config/owners`, {
    method: 'PUT',
    body: JSON.stringify(owners),
  });
