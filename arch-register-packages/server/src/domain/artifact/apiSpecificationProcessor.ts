import type { DatabaseAdapter } from '../../db/database';
import type { ArtifactDiagnosticDb } from './db/artifactDatabase';
import type { ApiSpecificationItemDbCreate } from './db/apiSpecificationDatabase';
import { diagnosticDbId, normalizeApiSpecification } from './apiSpecificationNormalization';
import type { ArtifactRevisionProcessor } from './artifactProcessor';

const toApiSpecificationItemDb = (
  item: Awaited<ReturnType<typeof normalizeApiSpecification>>['items'][number]
): ApiSpecificationItemDbCreate => ({
  id: item.id,
  item_key: item.itemKey,
  protocol: item.protocol,
  item_kind: item.itemKind,
  path: item.path,
  channel: item.channel,
  action: item.action,
  identifier: item.identifier,
  declared_identifier: item.declaredIdentifier,
  summary: item.summary,
  description: item.description,
  tags: item.tags,
  deprecated: item.deprecated,
  parameters: item.parameters,
  input_summary: item.input,
  output_summary: item.output,
  metadata: item.metadata,
  source_pointer: item.source.pointer,
  source_line: item.source.line,
  source_column: item.source.column,
  sort_order: 0
});

const normalizedArtifactDiagnostic = (
  normalized: Awaited<ReturnType<typeof normalizeApiSpecification>>,
  timestamp: Date
): ArtifactDiagnosticDb | null => {
  const first = normalized.diagnostics.find(diagnostic => diagnostic.severity === 'error');
  if (!first || normalized.status === 'current') return null;
  const category =
    normalized.status === 'unsupported' && first.category === 'unsupported_version'
      ? 'unsupported_version'
      : normalized.status === 'unsupported' && first.category === 'unsupported_media_type'
        ? 'unsupported_media_type'
        : 'normalization_failed';
  return {
    category,
    message: first.message,
    timestamp
  };
};

const persistApiSpecificationNormalization = async (
  tx: DatabaseAdapter,
  workspace: string,
  revisionId: string,
  normalized: Awaited<ReturnType<typeof normalizeApiSpecification>>,
  timestamp: Date
) => {
  await tx.artifactProjections.apiSpecification.replaceRevision({
    workspace,
    artifact_revision_id: revisionId,
    protocol: normalized.protocol,
    specification_version: normalized.specificationVersion,
    title: normalized.title,
    description: normalized.description,
    status: normalized.status,
    item_count: normalized.items.length,
    created_at: timestamp,
    updated_at: timestamp,
    items: normalized.items.map((item, index) => ({
      ...toApiSpecificationItemDb(item),
      sort_order: index
    })),
    diagnostics: normalized.diagnostics.map((diagnostic, index) => ({
      id: diagnosticDbId(revisionId, diagnostic, index),
      severity: diagnostic.severity,
      category: diagnostic.category,
      code: diagnostic.code,
      message: diagnostic.message,
      source_pointer: diagnostic.source?.pointer ?? null,
      source_line: diagnostic.source?.line ?? null,
      source_column: diagnostic.source?.column ?? null,
      sort_order: index
    }))
  });
};

export const apiSpecificationArtifactProcessor: ArtifactRevisionProcessor = {
  artifactType: 'api-specification',
  processRevision: async input => {
    const normalized = await normalizeApiSpecification(
      input.revisionId,
      input.content,
      input.mediaType
    );
    return {
      status: normalized.status,
      diagnostic: normalizedArtifactDiagnostic(normalized, input.timestamp),
      persist: (tx, persistInput) =>
        persistApiSpecificationNormalization(
          tx,
          persistInput.workspace,
          persistInput.revisionId,
          normalized,
          persistInput.timestamp
        )
    };
  }
};
