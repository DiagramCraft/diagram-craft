export const metricKeys = {
  all: ['metrics'] as const,
  rollups: (workspaceId: string) => [...metricKeys.all, 'rollup', workspaceId] as const,
  rollup: (workspaceId: string, request: Record<string, unknown>) =>
    [...metricKeys.rollups(workspaceId), request] as const
};
