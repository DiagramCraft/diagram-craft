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
  withSearch({
    to: '/$workspaceSlug/projects/$projectId/wiki/$nodeId' as const,
    params: { workspaceSlug, projectId, nodeId }
  }, search);

export const entityMarkdownRoute = <TSearch = undefined>(
  workspaceSlug: string,
  entityId: EntityPublicId,
  nodeId: string,
  search?: TSearch
) =>
  withSearch({
    to: '/$workspaceSlug/entities/$entityId/wiki/$nodeId' as const,
    params: { workspaceSlug, entityId, nodeId }
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
) => `/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/diagrams/${encodeURIComponent(diagramId)}`;
