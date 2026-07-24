import type { DocumentField, DocumentMetadata } from '@arch-register/api-types/documentContract';
import { z } from 'zod';

export type ParsedDocumentAiValue =
  | { ok: true; value: DocumentMetadata[string] }
  | { ok: false; error: string };

export type ParsedDocumentAiResponse =
  | {
      ok: true;
      value: DocumentMetadata[string];
      explanation: string | null;
      findings: string[];
    }
  | { ok: false; error: string };

const fieldValueSchema = (field: DocumentField): z.ZodType<DocumentMetadata[string]> => {
  switch (field.type) {
    case 'boolean':
      return z.boolean().describe(`The boolean value for the field "${field.name}"`);
    case 'number':
      return z.number().finite().describe(`The numeric value for the field "${field.name}"`);
    case 'enum': {
      const options = (field.enumOptions ?? []).map(option => option.value);
      if (options.length > 0) {
        return z
          .enum(options as [string, ...string[]])
          .describe(`The selected enum value for the field "${field.name}"`);
      }
      return z.string().describe(`The enum value for the field "${field.name}"`);
    }
    case 'date':
      return z.string().describe(`An ISO 8601 date (YYYY-MM-DD) for the field "${field.name}"`);
    case 'text':
    case 'long_text':
      return z.string().describe(`The text value for the field "${field.name}"`);
    default:
      return z.never().describe(`Unsupported value type for the field "${field.name}"`);
  }
};

export const documentMetadataGenerationOutputSchema = (field: DocumentField) =>
  z.object({
    value: fieldValueSchema(field),
    reason: z
      .string()
      .describe('A concise explanation of why this value is supported by the document'),
    findings: z
      .array(z.string())
      .describe('Concise observations from the document that support or qualify the value')
  });

const parseCandidateValue = (field: DocumentField, candidate: unknown): ParsedDocumentAiValue => {
  switch (field.type) {
    case 'boolean':
      if (typeof candidate === 'boolean') return { ok: true, value: candidate };
      return { ok: false, error: `Expected "true" or "false", got "${String(candidate)}"` };
    case 'number':
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        return { ok: true, value: candidate };
      }
      return { ok: false, error: `Expected a number, got "${String(candidate)}"` };
    case 'enum': {
      if (typeof candidate !== 'string') {
        return { ok: false, error: `Expected one of the enum values, got "${String(candidate)}"` };
      }
      const match = (field.enumOptions ?? []).find(option => option.value === candidate);
      if (!match)
        return { ok: false, error: `Expected one of the enum values, got "${candidate}"` };
      return { ok: true, value: match.value };
    }
    case 'date':
    case 'text':
    case 'long_text':
      if (typeof candidate === 'string' && candidate.length > 0) {
        return { ok: true, value: candidate };
      }
      return { ok: false, error: `Expected a text value, got "${String(candidate)}"` };
    default:
      return {
        ok: false,
        error: `Unsupported field type '${field.type}' for AI metadata generation`
      };
  }
};

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

/** Parses the structured metadata envelope, falling back to the legacy bare-value response. */
export const parseGeneratedResponse = (
  field: DocumentField,
  rawAnswer: string
): ParsedDocumentAiResponse => {
  const trimmed = rawAnswer.trim();
  if (trimmed.length === 0) return { ok: false, error: 'The model returned an empty answer' };

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === 'object' && parsed !== null && 'value' in parsed) {
      const envelope = parsed as { value: unknown; reason?: unknown; findings?: unknown };
      const value = parseCandidateValue(field, envelope.value);
      if (!value.ok) return value;
      const findings = Array.isArray(envelope.findings)
        ? envelope.findings.filter((finding): finding is string => typeof finding === 'string')
        : [];
      return {
        ok: true,
        value: value.value,
        explanation:
          typeof envelope.reason === 'string' && envelope.reason.trim().length > 0
            ? envelope.reason.trim()
            : null,
        findings
      };
    }
  } catch {
    // The compatibility path below handles the legacy bare-value response.
  }

  const legacy = parseGeneratedValue(field, rawAnswer);
  return legacy.ok ? { ok: true, value: legacy.value, explanation: null, findings: [] } : legacy;
};
