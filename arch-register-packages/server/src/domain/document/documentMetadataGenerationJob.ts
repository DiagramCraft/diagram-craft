import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createLogger } from '../../utils/logger';
import { buildApiEntityAuthCtx } from '../auth/authorization';
import { createJobSchedule, updateJobSchedule } from '../jobs/jobOperations';
import { resolveAiConfig, createAiTextAdapter } from '../ai/tanstackAiAdapter';
import { createAiChatTools } from '../ai/chatTools';
import { buildDocumentActionPrompt } from '../ai/documentContextPromptBuilder';
import { validateDocumentMetadata } from './documentValidation';
import { parseGeneratedValue } from './documentAiValue';
import { storageScope } from '../project/projectOperationHelpers';
import { chat } from '@tanstack/ai';
import type {
  DocumentAiAction,
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

const logger = createLogger('ai-metadata-generation');

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
  const existing = schedules.find(
    schedule => schedule.job_type === METADATA_GENERATION_SCAN_JOB_TYPE
  );
  if (existing) {
    // Self-heal a schedule created under a previous interval constant so operators can tune the
    // scan cadence without needing a data migration.
    if (
      existing.recurrence.type !== 'minutes' ||
      existing.recurrence.intervalMinutes !== METADATA_GENERATION_SCAN_INTERVAL_MINUTES
    ) {
      await updateJobSchedule(
        db,
        existing.id,
        {
          recurrence: {
            type: 'minutes',
            intervalMinutes: METADATA_GENERATION_SCAN_INTERVAL_MINUTES,
            startsAt: now
          }
        },
        now
      );
    }
    return;
  }
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
    logger.info(
      `Scheduled metadata generation for node ${params.nodeId}, action ${action.id}, to run at ${runAfterAt.toISOString()}`,
      { workspace: params.workspace, sourceRevision: params.sourceRevision }
    );
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

const MAX_EXPLANATION_LENGTH = 4000;

const truncateExplanation = (explanation: string | null): string | null => {
  if (!explanation) return null;
  return explanation.length > MAX_EXPLANATION_LENGTH
    ? `${explanation.slice(0, MAX_EXPLANATION_LENGTH)}…`
    : explanation;
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
        explanation: string | null;
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
        explanation: string | null;
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
            explanation: truncateExplanation(outcome.explanation),
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
            explanation: truncateExplanation(outcome.explanation),
            findings: [],
            failureNotice: outcome.failureNotice,
            generatedAt: outcome.now.toISOString(),
            sourceRevision: outcome.sourceRevision,
            generatorVersion: outcome.generatorVersion
          };

    // Keyed by target field id (not action id) — this is the same convention used by
    // renameDocumentMetadataField/removeDocumentMetadataField and by the web UI's
    // generatedMetadata[field.id] lookup.
    const nextGenerated = { ...current.generated_metadata, [outcome.fieldId]: resultEntry };

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
  failureNotice: string,
  explanation: string | null = null,
  // The target field id, when known. Falls back to the action id for the rare case where an
  // unexpected error strikes before the generator's target field could even be resolved — this
  // keeps the failure durably logged, even though it won't surface against a specific field in
  // the properties panel (generatedMetadata is keyed by field id).
  fieldId: string = row.action_id
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
    fieldId,
    failureNotice,
    explanation,
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
  const skip = (reason: string) => {
    logger.info(`Skipping node ${row.node_id}, action ${row.action_id}: ${reason}`, {
      workspace: row.workspace
    });
    return 'skipped' as const;
  };

  const node = await db.project.getAnyContentNodeById(row.workspace, row.node_id);
  if (!node) return skip('document no longer exists');

  const metadataRow = await db.document.getDocumentMetadata(row.workspace, node.id);
  const documentType = metadataRow?.document_type_id
    ? await db.document.getDocumentType(row.workspace, metadataRow.document_type_id)
    : null;
  if (!documentType) return skip('document no longer has a document type');
  const action = documentType.aiActions.find(
    candidate =>
      candidate.id === row.action_id && candidate.enabled && candidate.kind === 'metadata_generator'
  );
  if (action?.kind !== 'metadata_generator')
    return skip('generator action is missing, disabled, or no longer a metadata generator');

  const outputField = documentType.fields.find(
    field => field.id === action.outputFieldId && !field.retired
  );
  if (!outputField) return skip(`target field '${action.outputFieldId}' is missing or retired`);

  const fail = (message: string, explanation: string | null = null) => {
    logger.warn(`Generation failed for node ${row.node_id}, action ${row.action_id}: ${message}`, {
      workspace: row.workspace,
      attempt: row.attempt_count + 1
    });
    return scheduleRetryOrFail(db, row, now, message, explanation, outputField.id);
  };

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

  logger.info(
    `Running generator ${action.id} for node ${node.id} (field '${outputField.id}') using ${aiConfig.provider}/${aiConfig.model}`,
    { workspace: row.workspace, attempt: row.attempt_count + 1 }
  );

  let rawAnswer: string;
  let explanation: string | null;
  const startedAt = Date.now();
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
    const capturedReasoning: string[] = [];
    // Keep the model's reasoning/thinking trace separate from its final answer — the generator's
    // output must be strictly parseable as the target field's value, so mixing reasoning into it
    // (as the interactive AI action intentionally does for display) would make that impossible.
    // The reasoning is still useful context, so it's kept and stored as the result's explanation.
    // biome-ignore lint/suspicious/noExplicitAny: Stream chunk type varies by AI provider implementation
    for await (const chunk of stream as AsyncIterable<any>) {
      if (chunk.type === 'TEXT_MESSAGE_CONTENT' && chunk.delta) {
        capturedContent.push(chunk.delta);
      } else if (chunk.type === 'REASONING_MESSAGE_CONTENT' && chunk.delta) {
        capturedReasoning.push(chunk.delta);
      }
    }
    rawAnswer = capturedContent.join('');
    explanation = capturedReasoning.join('').trim() || null;
    logger.info(
      `Generator ${action.id} for node ${node.id} answered in ${Date.now() - startedAt}ms: ${JSON.stringify(rawAnswer.slice(0, 200))}`,
      {
        workspace: row.workspace,
        reasoningChunks: capturedReasoning.length,
        reasoningLength: explanation?.length ?? 0
      }
    );
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
  if (currentRevisionNumber !== row.source_revision) {
    logger.info(
      `Discarding result for node ${node.id}, action ${action.id}: document changed during generation ` +
        `(source revision ${row.source_revision}, current revision ${currentRevisionNumber})`,
      { workspace: row.workspace }
    );
    return 'discarded';
  }

  const parsed = parseGeneratedValue(outputField, rawAnswer);
  if (!parsed.ok) return (await fail(parsed.error, explanation)) as ProcessOutcome;

  const validation = validateDocumentMetadata(
    [outputField],
    { [outputField.id]: parsed.value },
    false,
    false
  );
  if (validation.errors.length > 0)
    return (await fail(validation.errors.join('; '), explanation)) as ProcessOutcome;

  await writeGenerationOutcome(db, row.workspace, node.id, {
    status: 'success',
    actionId: action.id,
    fieldId: outputField.id,
    value: parsed.value,
    explanation,
    sourceRevision: row.source_revision,
    generatorVersion: documentType.version ?? 1,
    documentTypeId: documentType.id,
    title: node.name,
    body,
    now
  });
  logger.info(
    `Wrote generated value for node ${node.id}, field '${outputField.id}': ${JSON.stringify(parsed.value)}`,
    { workspace: row.workspace }
  );
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
    logger.debug(
      `Scan tick for workspace ${context.workspace}: ${claimed.length} generation(s) due`
    );

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
        const message = error instanceof Error ? error.message : String(error);
        logger.error(
          `Unexpected error generating node ${row.node_id}, action ${row.action_id}: ${message}`,
          error instanceof Error ? error : undefined
        );
        const outcome = await scheduleRetryOrFail(db, row, now, message);
        summary[outcome] += 1;
      }
    }
    if (claimed.length > 0) {
      logger.info(`Scan tick for workspace ${context.workspace} finished`, summary);
    }
    return summary;
  };
