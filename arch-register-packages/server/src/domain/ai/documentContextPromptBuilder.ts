import type {
  DocumentField,
  DocumentMetadata,
  DocumentType
} from '@arch-register/api-types/documentContract';

export const buildDocumentActionPrompt = (params: {
  documentTitle: string;
  locationPath: string;
  documentType: DocumentType | null;
  metadata: DocumentMetadata;
  body: string;
  actionPrompt: string;
}): string => {
  const { documentTitle, locationPath, documentType, metadata, body, actionPrompt } = params;

  const fieldDescriptions = (documentType?.fields ?? [])
    .filter((field: DocumentField) => !field.retired)
    .map(field => {
      const value = metadata[field.id];
      const formatted = Array.isArray(value) ? value.join(', ') : (value ?? '');
      return `- ${field.name} (${field.type}): ${formatted}`;
    })
    .join('\n');

  const parts = [
    `You are analyzing a single document in an Enterprise Architecture register.`,
    `Use only read-only information; you must not modify entities, documents, or metadata.`,
    ``,
    `## Document`,
    `Title: ${documentTitle}`,
    `Location: ${locationPath}`,
    `Document type: ${documentType?.name ?? 'Untyped'}`,
    ``,
    `## Metadata`,
    fieldDescriptions.length > 0 ? fieldDescriptions : 'No structured metadata.',
    ``,
    `## Document body`,
    body,
    ``,
    `## Instructions`,
    actionPrompt
  ];

  return parts.join('\n');
};
