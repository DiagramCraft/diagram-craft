export type ProjectPublicId = string & { readonly __brand: 'ProjectPublicId' };
export type EntityPublicId = string & { readonly __brand: 'EntityPublicId' };

export const asProjectPublicId = (value: string): ProjectPublicId => value as ProjectPublicId;

export const asEntityPublicId = (value: string): EntityPublicId => value as EntityPublicId;

const withSearch = <T extends { to: string; params: Record<string, string> }, TSearch>(
  location: T,
  search: TSearch | undefined
) => {
  if (search === undefined) return location;
  return { ...location, search };
};

export const projectDetailRoute = <TSearch = undefined>(
  workspaceSlug: string,
  projectId: ProjectPublicId,
  search?: TSearch
) =>
  withSearch(
    {
      to: '/$workspaceSlug/projects/$projectId' as const,
      params: { workspaceSlug, projectId }
    },
    search
  );

export const projectDiagramRoute = <TSearch = undefined>(
  workspaceSlug: string,
  projectId: ProjectPublicId,
  diagramId: string,
  search?: TSearch
) =>
  withSearch(
    {
      to: '/$workspaceSlug/projects/$projectId/diagrams/$diagramId' as const,
      params: { workspaceSlug, projectId, diagramId }
    },
    search
  );

export const projectMarkdownRoute = <TSearch = undefined>(
  workspaceSlug: string,
  projectId: ProjectPublicId,
  nodeId: string,
  search?: TSearch
) =>
  withSearch(
    {
      to: '/$workspaceSlug/projects/$projectId/wiki/$nodeId' as const,
      params: { workspaceSlug, projectId, nodeId }
    },
    search
);

export const projectMarkdownDraftRoute = (
  workspaceSlug: string,
  projectId: ProjectPublicId,
  search?: { draftName?: string; draftFolder?: string }
) => withSearch({
  to: '/$workspaceSlug/projects/$projectId/wiki/new' as const,
  params: { workspaceSlug, projectId }
}, search);

export const projectContentFolderRoute = <TSearch = undefined>(
  workspaceSlug: string,
  projectId: ProjectPublicId,
  folderPath: string,
  search?: TSearch
) =>
  withSearch(
    {
      to: '/$workspaceSlug/projects/$projectId/folders/$' as const,
      params: { workspaceSlug, projectId, _splat: folderPath }
    },
    search
  );

export const workspaceMarkdownRoute = <TSearch = undefined>(
  workspaceSlug: string,
  nodeId: string,
  search?: TSearch
) =>
  withSearch(
    {
      to: '/$workspaceSlug/content/wiki/$nodeId' as const,
      params: { workspaceSlug, nodeId }
    },
    search
);

export const workspaceMarkdownDraftRoute = (
  workspaceSlug: string,
  search?: { draftName?: string; draftFolder?: string }
) => withSearch({
  to: '/$workspaceSlug/content/wiki/new' as const,
  params: { workspaceSlug }
}, search);

export const workspaceContentFolderRoute = <TSearch = undefined>(
  workspaceSlug: string,
  folderPath: string,
  search?: TSearch
) =>
  withSearch(
    {
      to: '/$workspaceSlug/content/folders/$' as const,
      params: { workspaceSlug, _splat: folderPath }
    },
    search
  );

export const entityMarkdownRoute = <TSearch = undefined>(
  workspaceSlug: string,
  entityId: EntityPublicId,
  nodeId: string,
  search?: TSearch
) =>
  withSearch(
    {
      to: '/$workspaceSlug/entities/$entityId/wiki/$nodeId' as const,
      params: { workspaceSlug, entityId, nodeId }
    },
    search
);

export const entityMarkdownDraftRoute = (
  workspaceSlug: string,
  entityId: EntityPublicId,
  search?: { draftName?: string; draftFolder?: string }
) => withSearch({
  to: '/$workspaceSlug/entities/$entityId/wiki/new' as const,
  params: { workspaceSlug, entityId }
}, search);

export const entityDetailRoute = <TSearch = undefined>(
  workspaceSlug: string,
  entityId: EntityPublicId,
  search?: TSearch
) =>
  withSearch(
    {
      to: '/$workspaceSlug/entities/$entityId' as const,
      params: { workspaceSlug, entityId }
    },
    search
  );

export const entityContentFolderRoute = <TSearch = undefined>(
  workspaceSlug: string,
  entityId: EntityPublicId,
  folderPath: string,
  search?: TSearch
) =>
  withSearch(
    {
      to: '/$workspaceSlug/entities/$entityId/folders/$' as const,
      params: { workspaceSlug, entityId, _splat: folderPath }
    },
    search
  );

export const entityDiagramRoute = <TSearch = undefined>(
  workspaceSlug: string,
  entityId: EntityPublicId,
  diagramId: string,
  search?: TSearch
) =>
  withSearch(
    {
      to: '/$workspaceSlug/entities/$entityId/diagrams/$diagramId' as const,
      params: { workspaceSlug, entityId, diagramId }
    },
    search
  );

export const projectDiagramHref = (
  workspaceSlug: string,
  projectId: ProjectPublicId,
  diagramId: string
) =>
  `/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/diagrams/${encodeURIComponent(diagramId)}`;
