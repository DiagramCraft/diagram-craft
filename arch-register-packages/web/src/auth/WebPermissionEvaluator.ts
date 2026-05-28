import {
  PermissionEvaluator,
  type AuthorizationContext,
  type Entity,
  type EntityGrant,
  type EntitySchema,
  type GlobalRole,
  type PermissionDataProvider
} from '@arch-register/permissions';
import { apiFetch } from '../api.js';

/**
 * Web-side data provider that fetches permission data from API endpoints
 */
export class WebDataProvider implements PermissionDataProvider {
  constructor(private apiBaseUrl: string) {}

  async getEntities(workspaceId: string): Promise<Entity[]> {
    return apiFetch(`${this.apiBaseUrl}/api/${workspaceId}/data`);
  }

  async getSchemas(workspaceId: string): Promise<EntitySchema[]> {
    return apiFetch(`${this.apiBaseUrl}/api/${workspaceId}/schemas`);
  }

  async getEntityGrants(workspaceId: string): Promise<EntityGrant[]> {
    return apiFetch(`${this.apiBaseUrl}/api/${workspaceId}/grants`);
  }

  async getTeamMemberships(workspaceId: string, userId: string): Promise<string[]> {
    const memberships = await apiFetch<Array<{ team_id: string; user_id: string }>>(
      `${this.apiBaseUrl}/api/${workspaceId}/teams/memberships`
    );
    return memberships.filter(m => m.user_id === userId).map(m => m.team_id);
  }

  async getGlobalRoles(userId: string): Promise<GlobalRole[]> {
    const assignments = await apiFetch<Array<{ role: GlobalRole }>>(
      `${this.apiBaseUrl}/api/users/${userId}/roles`
    );
    return assignments.map(a => a.role);
  }
}

/**
 * Web-side permission evaluator with caching support
 */
export class WebPermissionEvaluator extends PermissionEvaluator {
  private contextCache = new Map<string, { context: AuthorizationContext; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    super();
  }

  async buildContext(
    workspaceId: string,
    userId: string,
    dataProvider: PermissionDataProvider
  ): Promise<AuthorizationContext> {
    const cacheKey = `${workspaceId}:${userId}`;
    const cached = this.contextCache.get(cacheKey);

    // Return cached context if still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.context;
    }

    // Fetch fresh data
    const [globalRoles, teamMemberships, schemas, entities, grants] = await Promise.all([
      dataProvider.getGlobalRoles(userId),
      dataProvider.getTeamMemberships(workspaceId, userId),
      dataProvider.getSchemas(workspaceId),
      dataProvider.getEntities(workspaceId),
      dataProvider.getEntityGrants(workspaceId)
    ]);

    const context = this.buildAuthorizationContextFromData(
      userId,
      globalRoles,
      teamMemberships,
      schemas,
      entities,
      grants
    );

    // Cache the context
    this.contextCache.set(cacheKey, { context, timestamp: Date.now() });
    return context;
  }

  /**
   * Clear cached context for a specific workspace/user or all contexts
   */
  clearCache(workspaceId?: string, userId?: string): void {
    if (workspaceId && userId) {
      this.contextCache.delete(`${workspaceId}:${userId}`);
    } else {
      this.contextCache.clear();
    }
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.contextCache.size,
      keys: Array.from(this.contextCache.keys())
    };
  }
}
