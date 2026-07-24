import type {
  McpCreateEntityInput,
  McpSearchEntitiesInput,
  McpUpdateEntityInput
} from '@arch-register/api-types/mcpToolsContract';

export type ApiClientOptions = {
  baseUrl: string;
  workspace: string;
  token: string;
  fetchImpl?: typeof fetch;
};

export class ArchRegisterApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'ArchRegisterApiError';
  }
}

const jsonHeaders = { 'content-type': 'application/json' };

const encodePath = (value: string) => encodeURIComponent(value);

const withQuery = (path: string, params: Record<string, string | number | boolean | undefined>) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }
  const separator = query.size > 0 ? '?' : '';
  return `${path}${separator}${query.toString()}`;
};

export class ArchRegisterApiClient {
  private readonly baseUrl: string;
  private readonly workspace: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.workspace = options.workspace;
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}/api${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
        ...(init.body ? jsonHeaders : {}),
        ...init.headers
      }
    });

    const text = await response.text();
    let body: unknown = null;
    if (text.length > 0) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    if (!response.ok) {
      const message =
        typeof body === 'object' && body !== null && 'message' in body
          ? String(body.message)
          : `Arch Register API returned ${response.status}`;
      throw new ArchRegisterApiError(response.status, message, body);
    }

    return body as T;
  }

  async searchEntities(input: McpSearchEntitiesInput) {
    const params = new URLSearchParams();
    if (input.schemaId) params.set('_schemaId', input.schemaId);
    if (input.owner) params.set('owner', input.owner);
    if (input.lifecycle) params.set('lifecycle', input.lifecycle);
    if (input.query) params.set('q', input.query);
    if (input.conditions) params.set('conditions', JSON.stringify(input.conditions));
    params.set('limit', String(input.limit));
    params.set('offset', String(input.offset));
    params.set('view', 'full');

    const path = `/${encodePath(this.workspace)}/data?${params.toString()}`;
    const page = await this.request<{
      items: Array<Record<string, unknown>>;
      total: number;
    }>(path);

    return { entities: page.items, total: page.total };
  }

  async getEntity(entityId: string) {
    return this.request<Record<string, unknown>>(
      `/${encodePath(this.workspace)}/data/${encodePath(entityId)}`
    );
  }

  async getEntityRelations(entityId: string) {
    return this.request<{
      outgoing: Array<Record<string, unknown>>;
      incoming: Array<Record<string, unknown>>;
    }>(`/${encodePath(this.workspace)}/data/${encodePath(entityId)}/relations`);
  }

  async getEntityDependents(entityId: string, transitive: boolean, maxDepth: number) {
    return this.request<{ dependents: Array<Record<string, unknown>>; truncated: boolean }>(
      withQuery(`/${encodePath(this.workspace)}/data/${encodePath(entityId)}/dependents`, {
        transitive,
        maxDepth
      })
    );
  }

  async listSchemas() {
    return this.request<Array<Record<string, unknown>>>(`/${encodePath(this.workspace)}/schemas`);
  }

  async listLifecycleStates() {
    return this.request<Array<Record<string, unknown>>>(
      `/${encodePath(this.workspace)}/config/lifecycle-states`
    );
  }

  async createEntity(input: McpCreateEntityInput) {
    return this.request<Record<string, unknown>>(`/${encodePath(this.workspace)}/data`, {
      method: 'POST',
      body: JSON.stringify({
        _schemaId: input.schemaId,
        _name: input.name,
        _slug: input.slug,
        _namespace: input.namespace,
        _description: input.description,
        _owner: input.owner,
        _lifecycle: input.lifecycle,
        _tags: input.tags,
        ...(input.fields ?? {})
      })
    });
  }

  async updateEntity(input: McpUpdateEntityInput) {
    return this.request<Record<string, unknown>>(
      `/${encodePath(this.workspace)}/data/${encodePath(input.entityId)}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          _schemaId: input.schemaId,
          _name: input.name,
          _slug: input.slug,
          _namespace: input.namespace,
          _description: input.description,
          _owner: input.owner,
          _lifecycle: input.lifecycle,
          _tags: input.tags,
          ...(input.fields ?? {})
        })
      }
    );
  }
}

export const createApiClient = (options: ApiClientOptions) => new ArchRegisterApiClient(options);
