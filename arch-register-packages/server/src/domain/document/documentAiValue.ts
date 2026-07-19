import type { DocumentField, DocumentMetadata } from '@arch-register/api-types/documentContract';

export type ParsedDocumentAiValue =
  | { ok: true; value: DocumentMetadata[string] }
  | { ok: false; error: string };

/** Parses the deliberately strict response format used by metadata generators. */
export const parseGeneratedValue = (
  field: DocumentField,
  rawAnswer: string
): ParsedDocumentAiValue => {
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
