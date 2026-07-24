import type {
  DocumentField,
  DocumentMetadata,
  DocumentType
} from '@arch-register/api-types/documentContract';

const outputFieldInstruction = (field: DocumentField): string => {
  const shape =
    field.type === 'boolean'
      ? `the exact word "true" or "false"`
      : field.type === 'number'
        ? 'a single numeric value'
        : field.type === 'enum'
          ? `exactly one of: ${(field.enumOptions ?? []).map(option => option.value).join(', ')}`
          : field.type === 'date'
            ? 'a single ISO 8601 date (YYYY-MM-DD)'
            : 'a single text value';
  return [
    ``,
    `## Output`,
    `Return a JSON object with exactly these fields:`,
    `- value: ${shape} for the field "${field.name}".`,
    `- reason: a concise explanation of why this value is supported by the document.`,
    `- findings: an array of concise observations from the document that support or qualify the value.`,
    `Do not include surrounding prose or markdown formatting.`
  ].join('\n');
};

export const buildDocumentActionPrompt = (params: {
  documentTitle: string;
  locationPath: string;
  documentType: DocumentType | null;
  metadata: DocumentMetadata;
  body: string;
  actionPrompt: string;
  outputField?: DocumentField;
}): string => {
  const { documentTitle, locationPath, documentType, metadata, body, actionPrompt, outputField } =
    params;

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
    actionPrompt,
    ...(outputField ? [outputFieldInstruction(outputField)] : [])
  ];

  return parts.join('\n');
};
