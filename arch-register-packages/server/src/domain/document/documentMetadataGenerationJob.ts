import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { buildApiEntityAuthCtx } from '../auth/authorization';
import { createJobSchedule } from '../jobs/jobOperations';
import { resolveAiConfig, createAiTextAdapter } from '../ai/tanstackAiAdapter';
import { createAiChatTools } from '../ai/chatTools';
import { buildDocumentActionPrompt } from '../ai/documentContextPromptBuilder';
import { validateDocumentMetadata } from './documentValidation';
import { storageScope } from '../project/projectOperationHelpers';
import { chat } from '@tanstack/ai';
import type {
  DocumentAiAction,
  DocumentField,
  DocumentGeneratedMetadata,
  DocumentMetadata
} from '@arch-register/api-types/documentContract';
import type {
  DocumentMetadataGenerationScheduleDbResult,
  DocumentTypeDbResult
} from './db/documentDatabase';
import {
  AI_SYSTEM_USER_ID,
  METADATA_GENERATION_DEBOUNCE_MS,
  METADATA_GENERATION_MAX_ATTEMPTS,
  METADATA_GENERATION_RETRY_DELAY_MS,
  METADATA_GENERATION_SCAN_INTERVAL_MINUTES,
  METADATA_GENERATION_SCAN_JOB_TYPE,
  METADATA_GENERATION_SCAN_SYSTEM_IDENTITY
} from './aiMetadataGenerationConstants';

const readBody = (content: Buffer): string => {
  const raw = content.toString('utf8');
  try {
    const parsed = JSON.parse(raw) as { body?: unknown };
    if (parsed !== null && typeof parsed === 'object' && typeof parsed.body === 'string') {
      return parsed.body;
    }
  } catch {
    // External markdown mounts may contain the source file directly.
  }
  return raw;
};

const ensureMetadataGenerationScanScheduleExists = async (
  db: DatabaseAdapter,
  workspace: string,
  now: Date
) => {
  const schedules = await db.jobs.listSchedules(workspace);
  if (schedules.some(schedule => schedule.job_type === METADATA_GENERATION_SCAN_JOB_TYPE)) return;
  await createJobSchedule(
    db,
    {
      workspace,
      jobType: METADATA_GENERATION_SCAN_JOB_TYPE,
      systemIdentity: METADATA_GENERATION_SCAN_SYSTEM_IDENTITY,
      payload: {},
      priority: 5,
      recurrence: {
        type: 'minutes',
        intervalMinutes: METADATA_GENERATION_SCAN_INTERVAL_MINUTES,
        startsAt: now
      }
    },
    now
  );
};

/**
 * Called from the document save/restore write path whenever a document with an enabled AI
 * metadata generator changes. Resets the sliding debounce window for every enabled generator
 * on the document's type. Must be called with the same `db` (transaction) as the revision write
 * so scheduling is atomic with the change it was triggered by.
 */
export const scheduleMetadataGenerationForDocument = async (
  db: DatabaseAdapter,
  params: {
    workspace: string;
    nodeId: string;
    documentType: Pick<DocumentTypeDbResult, 'aiActions' | 'version'>;
    sourceRevision: number;
    scheduledByUserId: string;
    now: Date;
  }
) => {
  const generatorActions = params.documentType.aiActions.filter(
    (action): action is Extract<DocumentAiAction, { kind: 'metadata_generator' }> =>
      action.kind === 'metadata_generator' && action.enabled
  );
  if (generatorActions.length === 0) return;

  await ensureMetadataGenerationScanScheduleExists(db, params.workspace, params.now);

  const runAfterAt = new Date(params.now.getTime() + METADATA_GENERATION_DEBOUNCE_MS);
  for (const action of generatorActions) {
    await db.document.upsertPendingMetadataGeneration({
      workspace: params.workspace,
      node_id: params.nodeId,
      action_id: action.id,
      run_after_at: runAfterAt,
      source_revision: params.sourceRevision,
      generator_version: params.documentType.version ?? 1,
      scheduled_by_user_id: params.scheduledByUserId,
      attempt_count: 0,
      updated_at: params.now
    });
  }
};

type ParsedValue = { ok: true; value: DocumentMetadata[string] } | { ok: false; error: string };

const parseGeneratedValue = (field: DocumentField, rawAnswer: string): ParsedValue => {
  const trimmed = rawAnswer.trim().replace(/^["'`]+|["'`]+$/g, '');
  if (trimmed.length === 0) return { ok: false, error: 'The model returned an empty answer' };

  switch (field.type) {
    case 'boolean': {
      const lower = trimmed.toLowerCase();
      if (lower === 'true') return { ok: true, value: true };
      if (lower === 'false') return { ok: true, value: false };
      return { ok: false, error: `Expected "true" or "false", got "${trimmed}"` };
    }
    case 'number': {
      const num = Number(trimmed);
      if (!Number.isFinite(num)) return { ok: false, error: `Expected a number, got "${trimmed}"` };
      return { ok: true, value: num };
    }
    case 'enum': {
      const match = (field.enumOptions ?? []).find(option => option.value === trimmed);
      if (!match) return { ok: false, error: `Expected one of the enum values, got "${trimmed}"` };
      return { ok: true, value: match.value };
    }
    case 'date':
    case 'text':
    case 'long_text':
      return { ok: true, value: trimmed };
    default:
      return {
        ok: false,
        error: `Unsupported field type '${field.type}' for AI metadata generation`
      };
  }
};

const writeGenerationOutcome = async (
  db: DatabaseAdapter,
  workspace: string,
  nodeId: string,
  outcome:
    | {
        status: 'success';
        actionId: string;
        fieldId: string;
        value: DocumentMetadata[string];
        sourceRevision: number;
        generatorVersion: number;
        documentTypeId: string | null;
        title: string;
        body: string;
        now: Date;
      }
    | {
        status: 'failed';
        actionId: string;
        fieldId: string;
        failureNotice: string;
        sourceRevision: number;
        generatorVersion: number;
        now: Date;
      }
) => {
  await db.core.transaction(async tx => {
    const current = await tx.document.getDocumentMetadata(workspace, nodeId);
    if (!current) return;

    const resultEntry: DocumentGeneratedMetadata[string] =
      outcome.status === 'success'
        ? {
            actionId: outcome.actionId,
            fieldId: outcome.fieldId,
            status: 'success',
            explanation: null,
            findings: [],
            failureNotice: null,
            generatedAt: outcome.now.toISOString(),
            sourceRevision: outcome.sourceRevision,
            generatorVersion: outcome.generatorVersion
          }
        : {
            actionId: outcome.actionId,
            fieldId: outcome.fieldId,
            status: 'failed',
            explanation: null,
            findings: [],
            failureNotice: outcome.failureNotice,
            generatedAt: outcome.now.toISOString(),
            sourceRevision: outcome.sourceRevision,
            generatorVersion: outcome.generatorVersion
          };

    const nextGenerated = { ...current.generated_metadata, [outcome.actionId]: resultEntry };

    if (outcome.status === 'failed') {
      await tx.document.upsertDocumentMetadata({
        workspace,
        node_id: nodeId,
        document_type_id: current.document_type_id,
        values: current.values,
        generated_metadata: nextGenerated,
        updated_at: outcome.now
      });
      return;
    }

    const nextValues = { ...current.values, [outcome.fieldId]: outcome.value };
    await tx.document.upsertDocumentMetadata({
      workspace,
      node_id: nodeId,
      document_type_id: outcome.documentTypeId,
      values: nextValues,
      generated_metadata: nextGenerated,
      updated_at: outcome.now
    });

    const revisionNumber = await tx.project.getNextMarkdownRevisionNumber(workspace, nodeId);
    await tx.project.createMarkdownRevision({
      workspace,
      node_id: nodeId,
      revision_number: revisionNumber,
      title: outcome.title,
      body: outcome.body,
      created_at: outcome.now,
      created_by: AI_SYSTEM_USER_ID,
      restored_from_revision_id: null,
      document_type_id: outcome.documentTypeId,
      metadata: nextValues
    });
  });
};

const scheduleRetryOrFail = async (
  db: DatabaseAdapter,
  row: DocumentMetadataGenerationScheduleDbResult,
  now: Date,
  failureNotice: string
): Promise<'retrying' | 'failed'> => {
  if (row.attempt_count + 1 < METADATA_GENERATION_MAX_ATTEMPTS) {
    await db.document.upsertPendingMetadataGeneration({
      workspace: row.workspace,
      node_id: row.node_id,
      action_id: row.action_id,
      run_after_at: new Date(now.getTime() + METADATA_GENERATION_RETRY_DELAY_MS),
      source_revision: row.source_revision,
      generator_version: row.generator_version,
      scheduled_by_user_id: row.scheduled_by_user_id,
      attempt_count: row.attempt_count + 1,
      updated_at: now
    });
    return 'retrying';
  }
  await writeGenerationOutcome(db, row.workspace, row.node_id, {
    status: 'failed',
    actionId: row.action_id,
    fieldId: row.action_id,
    failureNotice,
    sourceRevision: row.source_revision,
    generatorVersion: row.generator_version,
    now
  });
  return 'failed';
};

type ProcessOutcome = 'success' | 'failed' | 'retrying' | 'discarded' | 'skipped';

const processGenerationRow = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  row: DocumentMetadataGenerationScheduleDbResult,
  now: Date
): Promise<ProcessOutcome> => {
  const node = await db.project.getAnyContentNodeById(row.workspace, row.node_id);
  if (!node) return 'skipped';

  const metadataRow = await db.document.getDocumentMetadata(row.workspace, node.id);
  const documentType = metadataRow?.document_type_id
    ? await db.document.getDocumentType(row.workspace, metadataRow.document_type_id)
    : null;
  const action = documentType?.aiActions.find(
    candidate =>
      candidate.id === row.action_id && candidate.enabled && candidate.kind === 'metadata_generator'
  );
  if (action?.kind !== 'metadata_generator' || !documentType) return 'skipped';

  const outputField = documentType.fields.find(
    field => field.id === action.outputFieldId && !field.retired
  );
  if (!outputField) return 'skipped';

  const fail = (message: string) => scheduleRetryOrFail(db, row, now, message);

  const aiConfig = await resolveAiConfig(db, row.workspace);
  if (!aiConfig) return (await fail('AI is not configured for this workspace')) as ProcessOutcome;

  const scheduledByUser = await db.auth.getUser(row.scheduled_by_user_id);
  if (!scheduledByUser)
    return (await fail('The user who scheduled this run no longer exists')) as ProcessOutcome;

  const content = await storage.read(row.workspace, storageScope(row.workspace, node), node.id);
  const body = readBody(content);

  const prompt = buildDocumentActionPrompt({
    documentTitle: node.name,
    locationPath: node.path,
    documentType: {
      ...documentType,
      version: documentType.version ?? 1,
      created_at: documentType.created_at.toISOString(),
      updated_at: documentType.updated_at.toISOString()
    },
    metadata: metadataRow?.values ?? {},
    body,
    actionPrompt: action.prompt,
    outputField
  });

  const fakeEvent = {
    context: {
      user: scheduledByUser,
      authorizationContextCache: new Map(),
      entityAuthorizationContextCache: new Map()
    }
  } as unknown as AuthenticatedEvent;

  let rawAnswer: string;
  try {
    const authCtx = await buildApiEntityAuthCtx(db, row.workspace, fakeEvent);
    const adapter = createAiTextAdapter(aiConfig);
    const tools = createAiChatTools(
      db,
      row.workspace,
      authCtx,
      { id: scheduledByUser.id, displayName: scheduledByUser.display_name },
      { readOnly: true }
    );
    const stream = chat({
      adapter,
      messages: [{ role: 'user', content: prompt }],
      tools,
      temperature: aiConfig.temperature,
      stream: true
    });
    const capturedContent: string[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: Stream chunk type varies by AI provider implementation
    for await (const chunk of stream as AsyncIterable<any>) {
      if (
        (chunk.type === 'TEXT_MESSAGE_CONTENT' || chunk.type === 'REASONING_MESSAGE_CONTENT') &&
        chunk.delta
      ) {
        capturedContent.push(chunk.delta);
      }
    }
    rawAnswer = capturedContent.join('');
  } catch (error) {
    return (await fail(
      `AI request failed: ${error instanceof Error ? error.message : String(error)}`
    )) as ProcessOutcome;
  }

  // Discard if the document changed while this generation was running: a newer save's hook
  // already upserted a fresh pending row for this (workspace, node, action) with its own
  // debounce window, so there is nothing further to schedule here.
  const currentRevisionNumber =
    (await db.project.getNextMarkdownRevisionNumber(row.workspace, node.id)) - 1;
  if (currentRevisionNumber !== row.source_revision) return 'discarded';

  const parsed = parseGeneratedValue(outputField, rawAnswer);
  if (!parsed.ok) return (await fail(parsed.error)) as ProcessOutcome;

  const validation = validateDocumentMetadata(
    [outputField],
    { [outputField.id]: parsed.value },
    false,
    false
  );
  if (validation.errors.length > 0)
    return (await fail(validation.errors.join('; '))) as ProcessOutcome;

  await writeGenerationOutcome(db, row.workspace, node.id, {
    status: 'success',
    actionId: action.id,
    fieldId: outputField.id,
    value: parsed.value,
    sourceRevision: row.source_revision,
    generatorVersion: documentType.version ?? 1,
    documentTypeId: documentType.id,
    title: node.name,
    body,
    now
  });
  return 'success';
};

export const createDocumentMetadataGenerationScanJobHandler =
  (db: DatabaseAdapter, storage: StorageAdapter) =>
  async (context: {
    jobId: string;
    workspace: string;
    payload: Record<string, unknown>;
    signal?: AbortSignal;
  }) => {
    const now = new Date();
    const claimed = await db.document.claimDueMetadataGenerations(context.workspace, now);

    const summary = {
      processed: claimed.length,
      success: 0,
      failed: 0,
      retrying: 0,
      discarded: 0,
      skipped: 0
    };
    for (const row of claimed) {
      try {
        const outcome = await processGenerationRow(db, storage, row, now);
        summary[outcome] += 1;
      } catch (error) {
        await scheduleRetryOrFail(
          db,
          row,
          now,
          error instanceof Error ? error.message : String(error)
        );
        summary.failed += 1;
      }
    }
    return summary;
  };
