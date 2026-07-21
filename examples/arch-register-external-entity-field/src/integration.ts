import { INTEGRATION_SOURCE, type Config } from './config.js';
import { ArchRegisterClient } from './archRegister.js';
import { fetchLatestRelease, GithubApiError, parseRepository, type GithubFetch } from './github.js';

export type WebhookEvent = {
  version: '1';
  id: string;
  type: 'entity.created' | 'entity.updated' | 'entity.deleted';
  entity: { id: string };
  metadata?: Record<string, unknown>;
};

type IntegrationResult = 'ignored' | 'updated' | 'failed' | 'unchanged';

const isOwnExternalUpdate = (event: WebhookEvent, config: Config): boolean =>
  event.metadata?.external_kind === 'integration' &&
  event.metadata?.external_field_id === config.targetFieldId &&
  event.metadata?.source === INTEGRATION_SOURCE;

const isTransient = (error: unknown): boolean =>
  error instanceof GithubApiError
    ? error.retryable
    : error instanceof Error && error.name === 'ArchRegisterApiError';

export const processWebhookEvent = async (
  event: WebhookEvent,
  config: Config,
  client: ArchRegisterClient,
  githubFetch: GithubFetch = fetch
): Promise<IntegrationResult> => {
  if (event.type === 'entity.deleted' || isOwnExternalUpdate(event, config)) return 'ignored';

  const entity = await client.getEntity(event.entity.id);
  const currentValue = entity[config.targetFieldId];

  try {
    const repository = parseRepository(entity[config.sourceFieldId]);
    const release = await fetchLatestRelease(repository, {
      token: config.githubToken,
      fetchImpl: githubFetch
    });
    if (currentValue === release.tag_name) return 'unchanged';

    await client.updateEntity(entity, release.tag_name, {
      fieldId: config.targetFieldId,
      kind: 'integration',
      source: INTEGRATION_SOURCE,
      status: 'success',
      requestId: event.id,
      sourceVersion: release.tag_name,
      explanation: `Latest GitHub release published at ${release.published_at ?? 'an unknown time'}: ${release.html_url}`
    });
    return 'updated';
  } catch (error) {
    if (isTransient(error)) throw error;
    const failureNotice = error instanceof Error ? error.message : String(error);
    await client.updateEntity(entity, currentValue, {
      fieldId: config.targetFieldId,
      kind: 'integration',
      source: INTEGRATION_SOURCE,
      status: 'failed',
      requestId: event.id,
      failureNotice
    });
    return 'failed';
  }
};
