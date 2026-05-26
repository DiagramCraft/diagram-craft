export type ViewId =
  | 'home'
  | 'project-detail'
  | 'entity-browser'
  | 'entity-detail'
  | 'data-model'
  | 'diagram'
  | 'workspace-settings'
  | 'search';

export type Route = {
  view: ViewId;
  workspaceId: string | null;
  projectId: string | null;
  entityId: string | null;
  diagramId: string | null;
  schemaId: string | null;
  projectSidebarTab: 'projects' | 'archive';
  typeFilter: string | null;
  statusFilter: string | null;
  ownerFilter: string | null;
  folderFilter: string | null;
  settingsSection: string;
  prev: Route | null;
};

export type RoutePatch = Partial<Route>;

export type NavigateFn = (patch: RoutePatch) => void;
