import type { TeamRole } from '@arch-register/permissions';
import { SCHEMA_COLORS } from '@arch-register/api-types/colors';
import type { SavedView } from '@arch-register/api-types/viewContract';
import type {
  SerializedDiagram,
  SerializedDiagramDocument,
  SerializedLayer,
  SerializedStyles
} from '@diagram-craft/model/serialization/serializedTypes';
import { fetchWithAuthResponse } from '../auth/authClient';
import { EntitySchema, SchemaField } from '@arch-register/api-types/schemaContract';
import { EntityLink, EntityRecord, EntitySummary } from '@arch-register/api-types/entityContract';
import { Project, ProjectFile } from '@arch-register/api-types/projectContract';

// Re-export commonly used types for convenience
export type { SavedView };

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
  label: string | null;
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

// Note: Entity operations now use ORPC client via hooks (useEntities)

type FetchEntitiesOptions = {
  schemaId?: string | null;
  owner?: string | null;
  lifecycle?: string | null;
  q?: string | null;
  view?: 'summary' | 'full';
  limit?: number | null;
  offset?: number | null;
};

export type TreeNode = EntitySummary & { _isMatch: boolean };

export type TreeEdge = { childId: string; parentId: string };

export const exportEntitiesToCSV = async (
  workspace: string,
  options: FetchEntitiesOptions = {}
): Promise<Blob> => {
  const { orpcClient } = await import('./orpcClient');
  const result = await orpcClient.entities.exportCsv({
    params: { workspace },
    query: {
      _schemaId: options.schemaId ?? undefined,
      owner: options.owner ?? undefined,
      lifecycle: options.lifecycle ?? undefined,
      q: options.q ?? undefined
    }
  });
  return result.body;
};

export const downloadCsvTemplate = async (
  workspace: string,
  schemaId: string
): Promise<Blob> => {
  const { orpcClient } = await import('./orpcClient');
  const result = await orpcClient.entities.downloadTemplate({
    params: { workspace, schemaId }
  });
  return result.body;
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

export const fetchEntityFacets = (workspace: string) =>
  apiFetch<EntityFacets>(`/api/${workspace}/data/facets`);

// ── Saved View API ────────────────────────────────────────────

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
  _owner: { id: string; name: string } | null;
  _lifecycle: { id: string; name: string } | null;
  _targetLifecycle: { id: string; name: string } | null;
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
// Note: Project CRUD operations now use ORPC client via hooks (useProjects, useProjectFiles)

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

export const emptyDiagram = (name: string) => {
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

// Note: Project file operations (createFolder, deleteFile, deleteFolder, renameFolder, cloneFile, relocateFile, createDiagramFile, toggleTemplateStatus) now use ORPC client via hooks

export const createDiagramFromTemplate = async (
  workspace: string,
  projectId: string,
  name: string,
  templateFile: ProjectFile,
  folder?: string | null
) => {
  const { orpcClient } = await import('./orpcClient');

  // Fetch template content from the template's project (not the current project)
  const templateContent = await orpcClient.projects.getFileContent({
    params: { workspace, id: templateFile.project_id },
    query: { path: templateFile.path }
  });

  const newContent = prepareTemplateDiagramDocument(
    templateContent as unknown as SerializedDiagramDocument & { name?: string },
    name
  );

  // Create new diagram (template flags are in database, not file content)
  const fileName = `${name}.json`;
  const filePath = folder ? `${folder}/${fileName}` : fileName;

  return orpcClient.projects.saveFile({
    params: { workspace, id: projectId },
    query: { path: filePath },
    body: newContent as unknown as Record<string, unknown>
  });
};

// ── Audit Log API ─────────────────────────────────────────────

export type AuditOperation = 'create' | 'update' | 'delete';

export type AuditEntityType = 'workspace' | 'entity_schema' | 'entity' | 'project' | 'project_file';

// ── Workspace Config API ─────────────────────────────────────
// Note: Lifecycle states, teams, team assignments, members, users, and roles now use ORPC client via hooks

export type WorkspaceTeam = {
  id: string;
  name: string;
  sort_order: number;
  color: string | null;
  description: string;
};

export type TeamAssignmentInfo = {
  workspace: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  created_at: string;
};

// ── Global Role Admin ─────────────────────────────────────────
// Note: Auth users and global roles now use ORPC client via hooks
