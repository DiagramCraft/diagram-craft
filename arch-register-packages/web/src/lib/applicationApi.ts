export const applicationCatalogPath = (workspace: string, path: string) =>
  `/api/application/v1/${encodeURIComponent(workspace)}${path}`;

export const applicationWorkspacePath = applicationCatalogPath;
