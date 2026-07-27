const applicationWorkspacePathPattern =
  /^\/api\/([^/]+)\/(schemas|data|projects|entities|content|markdown|search|ai|config|enums|views|collections|templates|analytics|metrics|jobs|webhooks|document-types|document-templates|audit|watching|notifications|notification-preferences|discussions|governance|assessments|milestones|automation-rules|content-mounts|wiki-comments|pinned-entities)(\/.*)?$/;
const applicationControlPlanePathPattern = /^\/api\/workspaces(\/.*)?$/;

/** Map supported workspace calls to the versioned first-party application surface. */
export const toApplicationApiUrl = (input: string) => {
  const isAbsolute = /^https?:\/\//.test(input);
  const url = new URL(input, 'http://localhost');
  if (applicationControlPlanePathPattern.test(url.pathname)) {
    url.pathname = `/api/application/v1${url.pathname.slice('/api'.length)}`;
    return isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  }
  const match = applicationWorkspacePathPattern.exec(url.pathname);

  if (!match) return input;

  url.pathname = `/api/application/v1/${match[1]}/${match[2]}${match[3] ?? ''}`;
  return isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
};

export const applicationCatalogPath = (workspace: string, path: string) =>
  `/api/application/v1/${encodeURIComponent(workspace)}${path}`;

export const applicationWorkspacePath = applicationCatalogPath;
