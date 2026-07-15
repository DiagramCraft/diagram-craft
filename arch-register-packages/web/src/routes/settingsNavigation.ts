// `schemas`, `documents`, and `model-overview` have dedicated static routes
// (settings/schemas, settings/documents, settings/model-overview) that TanStack Router
// matches in preference to the dynamic settings/$section route. Navigating to those
// sections must use their own route template, or TanStack Router warns that the
// generated path doesn't match the route template used to build it.
export const settingsSectionTarget = (workspaceSlug: string, section: string) => {
  if (section === 'schemas') {
    return { to: '/$workspaceSlug/settings/schemas', params: { workspaceSlug } };
  }
  if (section === 'documents') {
    return { to: '/$workspaceSlug/settings/documents', params: { workspaceSlug } };
  }
  if (section === 'model-overview') {
    return { to: '/$workspaceSlug/settings/model-overview', params: { workspaceSlug } };
  }
  return { to: '/$workspaceSlug/settings/$section', params: { workspaceSlug, section } };
};
