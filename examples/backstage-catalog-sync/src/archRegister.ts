import type { ArchRegisterEntity } from './mapper.js';

interface Schema {
  id: string;
  name: string;
}

interface RelationSchema {
  id: string;
  name: string;
  in: { schemaIds: string[] | 'any' };
  out: { schemaIds: string[] | 'any' };
}

export interface SyncResult {
  status: 'created' | 'updated' | 'unchanged';
  entity: {
    _uid: string;
    _publicId: string;
    _name: string;
  };
}

export type ApiSpecificationSourcePayload =
  | {
      state: 'present';
      source:
        | {
            kind: 'document';
            sourceKey: string;
            content: string;
            location?: string | null;
            mediaType?: string | null;
            sourceRevision?: string | null;
          }
        | {
            kind: 'link';
            sourceKey: string;
            location: string;
            mediaType?: string | null;
          };
    }
  | { state: 'missing'; sourceKey: string };

export interface ApiSpecificationSyncResult extends SyncResult {
  sourceStatus: 'created' | 'updated' | 'unchanged' | 'queued' | 'link_only' | 'missing' | 'failed' | null;
  artifact: Record<string, unknown> | null;
  revision: Record<string, unknown> | null;
  requestId: string;
  jobRunId: string | null;
  warnings: string[];
}

export interface RelationSyncResult {
  status: 'created' | 'updated' | 'unchanged';
  relation: {
    _uid: string;
  };
}

export interface SyncError extends Error {
  status?: number;
  details?: unknown;
}

export const getEntityByExternalKey = async (
  workspace: string,
  source: string,
  externalKey: string,
  token: string,
  baseUrl: string
): Promise<SyncResult['entity']> => {
  const encodedSource = encodeURIComponent(source);
  const encodedKey = encodeURIComponent(externalKey);
  const url = `${baseUrl}/api/integrations/v1/${workspace}/entities/byExternalKey/${encodedSource}/${encodedKey}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    throw createSyncError(requestFailure(url, error).message, undefined, error);
  }

  if (!response.ok) {
    const detail = (await response.text()).trim().slice(0, 500);
    throw createSyncError(
      `Lookup failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}`,
      response.status,
      detail
    );
  }

  return (await response.json()) as SyncResult['entity'];
};

const requestFailure = (url: string, error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error ? error.cause : undefined;
  const causeRecord = typeof cause === 'object' && cause !== null ? cause : undefined;
  const causeMessage = [
    cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : undefined,
    causeRecord && 'code' in causeRecord ? String(causeRecord.code) : undefined,
    causeRecord && 'address' in causeRecord ? String(causeRecord.address) : undefined,
    causeRecord && 'port' in causeRecord ? String(causeRecord.port) : undefined
  ]
    .filter(Boolean)
    .join(', ');
  return new Error(
    `Request to ${url} failed: ${message}${causeMessage ? ` (${causeMessage})` : ''}`
  );
};

/**
 * Fetches all schemas from the workspace
 */
export const fetchSchemas = async (
  workspace: string,
  token: string,
  baseUrl: string
): Promise<Schema[]> => {
  const url = `${baseUrl}/api/integrations/v1/${workspace}/schemas`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    throw requestFailure(url, error);
  }

  if (!response.ok) {
    const responseBody = await response.text();
    if (response.status === 401) {
      throw new Error('Authentication failed. Check your ARCH_REGISTER_TOKEN.');
    }
    if (response.status === 404) {
      throw new Error(`Workspace '${workspace}' not found.`);
    }
    const detail = responseBody.trim().slice(0, 500);
    throw new Error(
      `Failed to fetch schemas: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}`
    );
  }

  try {
    return (await response.json()) as Schema[];
  } catch (error) {
    throw new Error(
      `Invalid schema response from ${url}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

/**
 * Auto-discovers schema IDs by name
 * Returns a mapping of kind to schema ID
 */
export const discoverSchemas = async (
  workspace: string,
  token: string,
  baseUrl: string
): Promise<Record<string, string>> => {
  const schemas = await fetchSchemas(workspace, token, baseUrl);
  const mapping: Record<string, string> = {};

  for (const schema of schemas) {
    const nameLower = schema.name.toLowerCase();

    // Match by exact name (case-insensitive)
    if (nameLower === 'component') {
      mapping.component = schema.id;
    } else if (nameLower === 'api') {
      mapping.api = schema.id;
    } else if (nameLower === 'resource') {
      mapping.resource = schema.id;
    } else if (nameLower === 'system') {
      mapping.system = schema.id;
    } else if (nameLower === 'domain') {
      mapping.domain = schema.id;
    }
  }

  return mapping;
};

/**
 * Fetches all typed relation schemas from the workspace.
 */
export const fetchRelationSchemas = async (
  workspace: string,
  token: string,
  baseUrl: string
): Promise<RelationSchema[]> => {
  const url = `${baseUrl}/api/integrations/v1/${workspace}/relation-schemas`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    throw requestFailure(url, error);
  }

  if (!response.ok) {
    const responseBody = await response.text();
    if (response.status === 401) {
      throw new Error('Authentication failed. Check your ARCH_REGISTER_TOKEN.');
    }
    if (response.status === 404) {
      throw new Error(`Workspace '${workspace}' not found.`);
    }
    const detail = responseBody.trim().slice(0, 500);
    throw new Error(
      `Failed to fetch relation schemas: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}`
    );
  }

  try {
    return (await response.json()) as RelationSchema[];
  } catch (error) {
    throw new Error(
      `Invalid relation schema response from ${url}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

/**
 * Auto-discovers the API participation relation schema IDs by exact name.
 */
export const discoverRelationSchemas = async (
  workspace: string,
  token: string,
  baseUrl: string
): Promise<Record<'provides-api' | 'consumes-api', string>> => {
  const relationSchemas = await fetchRelationSchemas(workspace, token, baseUrl);
  const mapping: Partial<Record<'provides-api' | 'consumes-api', string>> = {};

  for (const relationSchema of relationSchemas) {
    const nameLower = relationSchema.name.toLowerCase();
    if (nameLower === 'provides api') {
      mapping['provides-api'] = relationSchema.id;
    } else if (nameLower === 'consumes api') {
      mapping['consumes-api'] = relationSchema.id;
    }
  }

  return {
    'provides-api': mapping['provides-api'] ?? '',
    'consumes-api': mapping['consumes-api'] ?? ''
  };
};

/**
 * Syncs an entity to Arch Register using the integration API
 * Uses the idempotent upsert endpoint with external identity
 */
export const syncEntity = async (
  workspace: string,
  source: string,
  externalKey: string,
  entity: ArchRegisterEntity,
  token: string,
  baseUrl: string
): Promise<SyncResult> => {
  const encodedSource = encodeURIComponent(source);
  const encodedKey = encodeURIComponent(externalKey);
  const url = `${baseUrl}/api/integrations/v1/${workspace}/entities/byExternalKey/${encodedSource}/${encodedKey}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(entity)
    });
  } catch (error) {
    throw createSyncError(requestFailure(url, error).message, undefined, error);
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorDetails: unknown;

    try {
      errorDetails = JSON.parse(errorText);
    } catch {
      errorDetails = errorText;
    }

    if (response.status === 401) {
      throw createSyncError(
        'Authentication failed. Check your ARCH_REGISTER_TOKEN.',
        response.status,
        errorDetails
      );
    }
    if (response.status === 403) {
      const detail =
        typeof errorDetails === 'object' && errorDetails !== null && 'message' in errorDetails
          ? String(errorDetails.message)
          : undefined;
      throw createSyncError(
        `Permission denied${detail ? `: ${detail}` : '. Ensure your token has ent.external_update permission.'}`,
        response.status,
        errorDetails
      );
    }
    if (response.status === 400) {
      throw createSyncError(
        `Validation error: ${JSON.stringify(errorDetails)}`,
        response.status,
        errorDetails
      );
    }
    if (response.status === 404) {
      throw createSyncError(
        `Schema not found. Check your schema mapping configuration.`,
        response.status,
        errorDetails
      );
    }

    throw createSyncError(
      `Sync failed: ${response.status} ${response.statusText}`,
      response.status,
      errorDetails
    );
  }

  const result = (await response.json()) as SyncResult;
  return result;
};

/**
 * Atomically syncs an API entity and its external specification source.
 */
export const syncApiSpecification = async (
  workspace: string,
  source: string,
  externalKey: string,
  entity: ArchRegisterEntity,
  specification: ApiSpecificationSourcePayload | undefined,
  token: string,
  baseUrl: string
): Promise<ApiSpecificationSyncResult> => {
  const encodedSource = encodeURIComponent(source);
  const encodedKey = encodeURIComponent(externalKey);
  const url = `${baseUrl}/api/integrations/v1/${workspace}/api-specifications/byExternalKey/${encodedSource}/${encodedKey}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ entity, ...(specification ? { source: specification } : {}) })
    });
  } catch (error) {
    throw createSyncError(requestFailure(url, error).message, undefined, error);
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorDetails: unknown;
    try {
      errorDetails = JSON.parse(errorText);
    } catch {
      errorDetails = errorText;
    }
    if (response.status === 401) {
      throw createSyncError('Authentication failed. Check your ARCH_REGISTER_TOKEN.', response.status, errorDetails);
    }
    if (response.status === 403) {
      throw createSyncError(
        'Permission denied. Ensure the token has ent.external_update and artifact.manage permissions.',
        response.status,
        errorDetails
      );
    }
    throw createSyncError(
      `API specification sync failed: ${response.status} ${response.statusText}`,
      response.status,
      errorDetails
    );
  }

  return (await response.json()) as ApiSpecificationSyncResult;
};

/**
 * Idempotently syncs a typed API participation relation by external identity.
 */
export const syncRelation = async (
  workspace: string,
  source: string,
  externalKey: string,
  relation: {
    schemaId: string;
    inEntityId: string;
    outEntityId: string;
  },
  token: string,
  baseUrl: string
): Promise<RelationSyncResult> => {
  const encodedSource = encodeURIComponent(source);
  const encodedKey = encodeURIComponent(externalKey);
  const url = `${baseUrl}/api/integrations/v1/${workspace}/relations/byExternalKey/${encodedSource}/${encodedKey}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        _schemaId: relation.schemaId,
        _inEntityId: relation.inEntityId,
        _outEntityId: relation.outEntityId
      })
    });
  } catch (error) {
    throw createSyncError(requestFailure(url, error).message, undefined, error);
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorDetails: unknown;
    try {
      errorDetails = JSON.parse(errorText);
    } catch {
      errorDetails = errorText;
    }

    if (response.status === 401) {
      throw createSyncError(
        'Authentication failed. Check your ARCH_REGISTER_TOKEN.',
        response.status,
        errorDetails
      );
    }
    if (response.status === 403) {
      throw createSyncError(
        'Permission denied while syncing a typed relation.',
        response.status,
        errorDetails
      );
    }
    if (response.status === 400) {
      throw createSyncError(
        `Validation error: ${JSON.stringify(errorDetails)}`,
        response.status,
        errorDetails
      );
    }
    if (response.status === 404) {
      throw createSyncError(
        'Relation schema or endpoint entity not found. Check relation schema discovery and entity sync order.',
        response.status,
        errorDetails
      );
    }

    throw createSyncError(
      `Relation sync failed: ${response.status} ${response.statusText}`,
      response.status,
      errorDetails
    );
  }

  return (await response.json()) as RelationSyncResult;
};

/**
 * Creates a SyncError with additional context
 */
const createSyncError = (message: string, status?: number, details?: unknown): SyncError => {
  const error = new Error(message) as SyncError;
  error.status = status;
  error.details = details;
  return error;
};
