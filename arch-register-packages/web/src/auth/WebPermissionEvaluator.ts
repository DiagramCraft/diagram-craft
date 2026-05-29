import {
  buildAuthorizationContext,
  fetchAuthorizationContextData,
  type AuthorizationContext,
  type PermissionDataProvider
} from '@arch-register/permissions';

export class CachedPermissionEvaluator {
  private contextCache = new Map<string, { context: AuthorizationContext; timestamp: number }>();
  private readonly cacheTtl = 5 * 60 * 1000;

  async buildContext(
    workspaceId: string,
    userId: string,
    dataProvider: PermissionDataProvider
  ): Promise<AuthorizationContext> {
    const cacheKey = `${workspaceId}:${userId}`;
    const cached = this.contextCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTtl) {
      return cached.context;
    }

    const contextData = await fetchAuthorizationContextData(dataProvider, workspaceId, userId);
    const context = buildAuthorizationContext(contextData);
    this.contextCache.set(cacheKey, { context, timestamp: Date.now() });
    return context;
  }

  clearCache(workspaceId?: string, userId?: string): void {
    if (workspaceId && userId) {
      this.contextCache.delete(`${workspaceId}:${userId}`);
      return;
    }

    this.contextCache.clear();
  }
}