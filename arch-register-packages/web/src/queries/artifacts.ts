export const artifactKeys = {
  all: ['artifacts'] as const,
  workspaceEntities: (workspaceId: string) => [...artifactKeys.all, workspaceId] as const,
  entity: (workspaceId: string, entityId: string) =>
    [...artifactKeys.workspaceEntities(workspaceId), entityId] as const,
  apiSpecificationRevisions: (workspaceId: string, entityId: string, artifactId: string) =>
    [
      ...artifactKeys.entity(workspaceId, entityId),
      'api-specification-revisions',
      artifactId
    ] as const,
  apiSpecification: (
    workspaceId: string,
    entityId: string,
    artifactId: string,
    revisionId: string,
    query: Record<string, unknown>
  ) =>
    [
      ...artifactKeys.entity(workspaceId, entityId),
      'api-specification',
      artifactId,
      revisionId,
      query
    ] as const,
  revisionContent: (
    workspaceId: string,
    entityId: string,
    artifactId: string,
    revisionId: string
  ) =>
    [
      ...artifactKeys.entity(workspaceId, entityId),
      'revision-content',
      artifactId,
      revisionId
    ] as const
};
