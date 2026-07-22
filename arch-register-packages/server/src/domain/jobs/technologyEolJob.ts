import type { TechnologyEolMapping } from '@arch-register/api-types/jobsContract';
import type { ExternalUpdateEnvelope } from '@arch-register/api-types/common';
import type { DatabaseAdapter } from '../../db/database';
import { RetryableJobError } from './jobRetry';
import { listAllCatalogEntities } from '../catalog/entityLoader';
import { updateEntityWithAudit } from '../catalog/entityMutations';
import {
  applyExternalFieldUpdate,
  assertNoExternalFieldWrites,
  assertValidExternalUpdateTarget
} from '../externalMetadata/externalMetadataHelpers';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import { getSystemUserId } from '../auth/systemUsers';

export const TECHNOLOGY_EOL_JOB_TYPE = 'technology-eol';
export const TECHNOLOGY_EOL_SYSTEM_IDENTITY = 'technology-eol';
export const TECHNOLOGY_EOL_SOURCE = 'endoflife.date';
// See domain/auth/systemUsers.ts for the registry.
export const TECHNOLOGY_EOL_SYSTEM_USER_ID = getSystemUserId('technology-eol-job');

type EolRelease = {
  cycle?: unknown;
  releaseDate?: unknown;
  latest?: unknown;
  support?: unknown;
  extendedSupport?: unknown;
  eol?: unknown;
};

type TechnologyEolPayload = {
  schemaId: string;
  mapping: TechnologyEolMapping;
};

const isTechnologyEolPayload = (value: Record<string, unknown>): value is TechnologyEolPayload => {
  const mapping = value['mapping'];
  return (
    typeof value['schemaId'] === 'string' &&
    typeof mapping === 'object' &&
    mapping != null &&
    typeof (mapping as Record<string, unknown>)['productFieldId'] === 'string' &&
    typeof (mapping as Record<string, unknown>)['cycleFieldId'] === 'string'
  );
};

const retryAfterMs = (value: string | null) => {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = new Date(value).getTime();
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
};

const fetchRelease = async (
  product: string,
  cycle: string,
  signal: AbortSignal
): Promise<EolRelease> => {
  const url = `https://endoflife.date/api/v1/products/${encodeURIComponent(product)}/releases/${encodeURIComponent(cycle)}`;
  const response = await fetch(url, {
    signal,
    headers: { accept: 'application/json', 'user-agent': 'Arch-Register/Technology-EOL' }
  });

  if (response.status === 404) return {};
  if (response.status === 429) {
    throw new RetryableJobError(
      'endoflife.date rate limit reached',
      retryAfterMs(response.headers.get('retry-after'))
    );
  }
  if (response.status >= 500) {
    throw new RetryableJobError(`endoflife.date returned HTTP ${response.status}`);
  }
  if (!response.ok) throw new Error(`endoflife.date returned HTTP ${response.status}`);

  const body = (await response.json()) as unknown;
  if (body == null || typeof body !== 'object') {
    throw new Error('endoflife.date returned an invalid release response');
  }
  const result =
    'result' in body && typeof body.result === 'object' && body.result != null ? body.result : body;
  if (typeof result !== 'object' || result == null) {
    throw new Error('endoflife.date returned an invalid release result');
  }
  const release = result as Record<string, unknown>;
  const latest = release['latest'];
  return {
    cycle: release['cycle'] ?? release['name'],
    releaseDate: release['releaseDate'],
    latest:
      typeof latest === 'object' && latest != null
        ? (latest as Record<string, unknown>)['name']
        : latest,
    support: release['eoasFrom'] ?? release['support'],
    extendedSupport: release['eoesFrom'] ?? release['extendedSupport'],
    eol: release['eolFrom'] ?? release['eol']
  };
};

const readText = (value: unknown) => {
  if (value == null || value === false) return null;
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
};

const readDate = (value: unknown) => {
  const text = readText(value);
  if (text == null) return null;
  return Number.isNaN(new Date(text).getTime()) ? null : text;
};

const setFieldValue = (
  schema: SchemaDbResult,
  fieldId: string,
  value: unknown,
  data: Record<string, unknown>
) => {
  const field = schema.fields.find(candidate => candidate.id === fieldId);
  if (!field) return;
  data[fieldId] = field.type === 'date' ? readDate(value) : readText(value);
};

const applyRelease = async (
  db: DatabaseAdapter,
  entity: EntityDbResult,
  schema: SchemaDbResult,
  mapping: TechnologyEolMapping,
  release: EolRelease,
  product: string,
  jobId: string,
  status: 'success' | 'failed',
  failureNotice?: string
) => {
  const now = new Date();
  const nextData = { ...entity.data };
  const destinations: Array<{ fieldId: string; value: unknown }> = [
    { fieldId: mapping.latestVersionFieldId!, value: release.latest },
    { fieldId: mapping.releaseDateFieldId!, value: release.releaseDate },
    { fieldId: mapping.supportUntilFieldId!, value: release.support },
    { fieldId: mapping.securityUntilFieldId!, value: release.extendedSupport },
    { fieldId: mapping.eolDateFieldId!, value: release.eol },
    {
      fieldId: mapping.sourceUrlFieldId!,
      value: `https://endoflife.date/${encodeURIComponent(product)}`
    },
    { fieldId: mapping.synchronizedAtFieldId!, value: now.toISOString() }
  ].filter(
    (destination): destination is { fieldId: string; value: unknown } => destination.fieldId != null
  );

  if (status === 'success') {
    for (const destination of destinations) {
      setFieldValue(schema, destination.fieldId, destination.value, nextData);
    }
  }

  let remainingFields: Array<{ id: string; external_kind?: 'ai' | 'automation' | 'integration' }> =
    schema.fields;
  const generatedMetadata = { ...(entity.generated_metadata ?? {}) };
  for (const destination of destinations) {
    const envelope: ExternalUpdateEnvelope = {
      fieldId: destination.fieldId,
      kind: 'integration',
      source: TECHNOLOGY_EOL_SOURCE,
      status,
      requestId: jobId,
      sourceVersion: typeof release.cycle === 'string' ? release.cycle : undefined,
      failureNotice
    };
    remainingFields = assertValidExternalUpdateTarget(
      remainingFields,
      envelope,
      entity.data,
      nextData
    );
    generatedMetadata[destination.fieldId] = applyExternalFieldUpdate(
      destination.fieldId,
      envelope,
      now
    );
  }
  assertNoExternalFieldWrites(remainingFields, entity.data, nextData);

  await updateEntityWithAudit(db, {
    workspace: entity.workspace,
    entityId: entity.id,
    previous: entity,
    actor: { id: TECHNOLOGY_EOL_SYSTEM_USER_ID, displayName: 'Technology EOL job' },
    next: {
      data: nextData,
      generated_metadata: generatedMetadata,
      updated_at: now,
      name: entity.name,
      slug: entity.slug,
      namespace: entity.namespace,
      description: entity.description,
      owner: entity.owner,
      lifecycle: entity.lifecycle,
      target_lifecycle: entity.target_lifecycle,
      target_lifecycle_date: entity.target_lifecycle_date,
      tags: entity.tags,
      links: entity.links,
      schema_id: entity.schema_id,
      visibility_mode: entity.visibility_mode,
      project_id: entity.project_id,
      approval_policy_override: entity.approval_policy_override
    },
    auditMetadata: {
      external_kind: 'integration',
      source: TECHNOLOGY_EOL_SOURCE,
      requestId: jobId,
      status
    }
  });
};

export const createTechnologyEolJobHandler =
  (db: DatabaseAdapter) =>
  async (context: {
    jobId: string;
    workspace: string;
    payload: Record<string, unknown>;
    signal: AbortSignal;
  }) => {
    if (!isTechnologyEolPayload(context.payload)) {
      throw new Error('Technology EOL job has an invalid payload');
    }
    const schema = await db.catalog.getSchema(context.workspace, context.payload.schemaId);
    if (!schema)
      throw new Error(`Technology EOL schema '${context.payload.schemaId}' was not found`);
    const entities = await listAllCatalogEntities(db, context.workspace, {
      schemaId: context.payload.schemaId
    });
    const summary = { processed: 0, updated: 0, failed: 0, skipped: 0 };

    for (const entity of entities) {
      if (context.signal.aborted) return summary;
      const product = readText(entity.data[context.payload.mapping.productFieldId]);
      const cycle = readText(entity.data[context.payload.mapping.cycleFieldId]);
      if (!product || !cycle) {
        summary.skipped += 1;
        continue;
      }

      summary.processed += 1;
      try {
        const release = await fetchRelease(product, cycle, context.signal);
        if (Object.keys(release).length === 0) {
          await applyRelease(
            db,
            entity,
            schema,
            context.payload.mapping,
            release,
            product,
            context.jobId,
            'failed',
            `No release cycle '${cycle}' was found for product '${product}'`
          );
          summary.failed += 1;
        } else {
          await applyRelease(
            db,
            entity,
            schema,
            context.payload.mapping,
            release,
            product,
            context.jobId,
            'success'
          );
          summary.updated += 1;
        }
      } catch (error) {
        if (error instanceof RetryableJobError) throw error;
        summary.failed += 1;
      }
    }
    return summary;
  };
