import type { Config } from './config.js';

export type EntityRecord = Record<string, unknown>;

export class ArchRegisterApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ArchRegisterApiError';
  }
}

export type ArchRegisterFetch = typeof fetch;

const idFromReference = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  const reference =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  if (reference && typeof reference['id'] === 'string') {
    return reference['id'];
  }
  return null;
};

export const entityToUpdateBody = (
  entity: EntityRecord,
  targetFieldId: string,
  targetValue: unknown,
  external: Record<string, unknown>
): EntityRecord => {
  const schema = entity['_schema'];
  const schemaRecord =
    typeof schema === 'object' && schema !== null ? (schema as Record<string, unknown>) : null;
  if (schemaRecord === null || typeof schemaRecord['id'] !== 'string') {
    throw new Error('The entity response did not contain a schema identifier');
  }

  const customFields = Object.fromEntries(
    Object.entries(entity).filter(([key]) => !key.startsWith('_'))
  );

  return {
    _schemaId: schemaRecord['id'],
    _name: entity['_name'],
    _slug: entity['_slug'],
    _namespace: entity['_namespace'],
    _description: entity['_description'],
    _owner: idFromReference(entity['_owner']),
    _lifecycle: idFromReference(entity['_lifecycle']),
    _targetLifecycle: idFromReference(entity['_targetLifecycle']),
    _targetLifecycleDate: entity['_targetLifecycleDate'],
    _tags: entity['_tags'],
    _links: entity['_links'],
    _visibilityMode: entity['_visibilityMode'],
    ...customFields,
    [targetFieldId]: targetValue,
    _external: external
  };
};

export class ArchRegisterClient {
  private readonly apiBase: string;

  constructor(
    private readonly config: Config,
    private readonly fetchImpl: ArchRegisterFetch = fetch
  ) {
    this.apiBase = `${config.archRegisterUrl}/api/${encodeURIComponent(config.workspace)}`;
  }

  async getEntity(id: string): Promise<EntityRecord> {
    const response = await this.fetchImpl(`${this.apiBase}/data/${encodeURIComponent(id)}`, {
      headers: { authorization: `Bearer ${this.config.archRegisterToken}` }
    });
    return this.readJson(response);
  }

  async updateEntity(
    entity: EntityRecord,
    value: unknown,
    external: Record<string, unknown>
  ): Promise<EntityRecord> {
    const id = entity['_uid'];
    if (typeof id !== 'string') throw new Error('The webhook entity did not contain _uid');
    const response = await this.fetchImpl(`${this.apiBase}/data/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${this.config.archRegisterToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(entityToUpdateBody(entity, this.config.targetFieldId, value, external))
    });
    return this.readJson(response);
  }

  private async readJson(response: Response): Promise<EntityRecord> {
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ArchRegisterApiError(
        `Arch Register returned HTTP ${response.status}`,
        response.status
      );
    }
    if (typeof body !== 'object' || body === null) {
      throw new ArchRegisterApiError(
        'Arch Register returned an invalid JSON response',
        response.status
      );
    }
    return body as EntityRecord;
  }
}
