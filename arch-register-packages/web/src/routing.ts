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
  workspaceId: string;
  projectId: string | null;
  entityId: string | null;
  diagramId: string | null;
  typeFilter: string | null;
  settingsSection: string;
  prev: Route | null;
};

export type RoutePatch = Partial<Route>;

export type NavigateFn = (patch: RoutePatch) => void;
