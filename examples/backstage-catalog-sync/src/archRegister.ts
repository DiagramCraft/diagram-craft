import type { ArchRegisterEntity } from './mapper.js';

export interface Schema {
  id: string;
  name: string;
  description: string;
}

export interface SyncResult {
  status: 'created' | 'updated' | 'unchanged';
  entity: {
    _uid: string;
    _publicId: string;
    _name: string;
  };
}

export interface SyncError extends Error {
  status?: number;
  details?: unknown;
}

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
  return new Error(`Request to ${url} failed: ${message}${causeMessage ? ` (${causeMessage})` : ''}`);
};

/**
 * Fetches all schemas from the workspace
 */
export const fetchSchemas = async (
  workspace: string,
  token: string,
  baseUrl: string
): Promise<Schema[]> => {
  const url = `${baseUrl}/api/${workspace}/schemas`;
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
    throw new Error(`Invalid schema response from ${url}: ${error instanceof Error ? error.message : String(error)}`);
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
 * Creates a SyncError with additional context
 */
const createSyncError = (message: string, status?: number, details?: unknown): SyncError => {
  const error = new Error(message) as SyncError;
  error.status = status;
  error.details = details;
  return error;
};
