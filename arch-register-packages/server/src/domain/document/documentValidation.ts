import type {
  DocumentField,
  DocumentMetadata,
  DocumentTypeWrite
} from '@arch-register/api-types/documentContract';
import { DOCUMENT_AI_READ_ONLY_TOOLS } from '@arch-register/api-types/documentContract';
import { httpAssert } from '../../utils/httpAssert';
import { assertNoExternalFieldWrites } from '../externalMetadata/externalMetadataHelpers';

const isEmpty = (value: unknown) =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

export const validateDocumentTypeWrite = (input: DocumentTypeWrite) => {
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const field of input.fields) {
    httpAssert.true(!ids.has(field.id), {
      status: 400,
      message: `Duplicate document field id '${field.id}'`
    });
    httpAssert.true(!names.has(field.name.toLowerCase()), {
      status: 400,
      message: `Duplicate document field name '${field.name}'`
    });
    ids.add(field.id);
    names.add(field.name.toLowerCase());
    if (field.minCardinality !== undefined && field.maxCardinality !== undefined) {
      httpAssert.true(field.minCardinality <= field.maxCardinality, {
        status: 400,
        message: `Invalid cardinality for field '${field.id}'`
      });
    }
    if (field.type === 'enum') {
      httpAssert.true((field.enumOptions?.length ?? 0) > 0, {
        status: 400,
        message: `Enum field '${field.id}' must define options`
      });
    }
    if (field.type === 'entity_link' || field.type === 'document_link') {
      httpAssert.true(
        field.maxCardinality === undefined ||
          field.maxCardinality !== 1 ||
          field.minCardinality === undefined ||
          field.minCardinality <= 1,
        { status: 400, message: `Invalid link cardinality for field '${field.id}'` }
      );
    }
  }

  const actionIds = new Set<string>();
  const generatorOutputFields = new Set<string>();
  const fieldsById = new Map(input.fields.map(field => [field.id, field]));
  const generatorFieldTypes = new Set<DocumentField['type']>([
    'text',
    'long_text',
    'boolean',
    'date',
    'number',
    'enum'
  ]);
  for (const action of input.aiActions ?? []) {
    httpAssert.true(!actionIds.has(action.id), {
      status: 400,
      message: `Duplicate AI action id '${action.id}'`
    });
    actionIds.add(action.id);
    httpAssert.true(action.name.trim().length > 0, {
      status: 400,
      message: `AI action '${action.id}' must have a name`
    });
    httpAssert.true(action.prompt.trim().length > 0, {
      status: 400,
      message: `AI action '${action.id}' must have a prompt`
    });
    if (action.tools !== undefined) {
      httpAssert.true(new Set(action.tools).size === action.tools.length, {
        status: 400,
        message: `AI action '${action.id}' tools must be unique`
      });
      const knownTools = new Set(DOCUMENT_AI_READ_ONLY_TOOLS.map(tool => tool.id));
      httpAssert.true(
        action.tools.every(tool => knownTools.has(tool)),
        {
          status: 400,
          message: `AI action '${action.id}' contains an unknown tool`
        }
      );
    }
    if (action.kind !== 'metadata_generator') continue;

    httpAssert.true(!generatorOutputFields.has(action.outputFieldId), {
      status: 400,
      message: `Multiple AI metadata generators target field '${action.outputFieldId}'`
    });
    generatorOutputFields.add(action.outputFieldId);

    const outputField = fieldsById.get(action.outputFieldId);
    httpAssert.present(outputField, {
      status: 400,
      message: `AI metadata generator '${action.id}' targets unknown field '${action.outputFieldId}'`
    });
    httpAssert.true(!outputField.retired, {
      status: 400,
      message: `AI metadata generator '${action.id}' cannot target retired field '${action.outputFieldId}'`
    });
    httpAssert.true(generatorFieldTypes.has(outputField.type), {
      status: 400,
      message: `AI metadata generator '${action.id}' cannot target ${outputField.type} field '${action.outputFieldId}'`
    });
    httpAssert.true(outputField.external_kind === 'ai', {
      status: 400,
      message: `AI metadata generator '${action.id}' can only target a field with external_kind 'ai' (field '${action.outputFieldId}')`
    });
  }
};

/**
 * Rejects a plain (non-external-update) document save that changes the value of any field
 * carrying `external_kind` — such fields are read-only to ordinary users.
 */
export const assertNoExternalDocumentFieldWrites = (
  fields: DocumentField[],
  currentMetadata: DocumentMetadata,
  nextMetadata: DocumentMetadata
) => assertNoExternalFieldWrites(fields, currentMetadata, nextMetadata);

const valueCardinality = (value: unknown) =>
  Array.isArray(value) ? value.length : isEmpty(value) ? 0 : 1;

const valueTypeMatches = (field: DocumentField, value: unknown) => {
  if (isEmpty(value)) return true;
  switch (field.type) {
    case 'text':
    case 'long_text':
    case 'date':
      return typeof value === 'string';
    case 'boolean':
      return typeof value === 'boolean';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'enum':
      return (
        typeof value === 'string' &&
        (field.enumOptions ?? []).some(option => option.value === value)
      );
    case 'entity_link':
    case 'document_link':
      return Array.isArray(value)
        ? value.every(item => typeof item === 'string' && item.length > 0)
        : typeof value === 'string' && value.length > 0;
  }
};

export const validateDocumentMetadata = (
  fields: DocumentField[],
  metadata: DocumentMetadata,
  allowMissingRequired = false,
  rejectUnknownFields = false
) => {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (rejectUnknownFields) {
    const fieldIds = new Set(fields.map(field => field.id));
    for (const fieldId of Object.keys(metadata)) {
      if (!fieldIds.has(fieldId))
        errors.push(`Metadata field '${fieldId}' is not part of this document type`);
    }
  }
  for (const field of fields) {
    if (field.retired) continue;
    const value = metadata[field.id];
    const cardinality = valueCardinality(value);
    const min = field.minCardinality ?? (field.requirement === 'required' ? 1 : 0);
    const max = field.maxCardinality;
    if (field.requirement === 'required' && !allowMissingRequired && cardinality === 0)
      errors.push(`Field '${field.name}' is required`);
    if (field.requirement === 'expected' && cardinality === 0)
      warnings.push(`Field '${field.name}' is expected`);
    if (cardinality < min && !(allowMissingRequired && field.requirement === 'required'))
      errors.push(`Field '${field.name}' requires at least ${min} value(s)`);
    if (max !== undefined && cardinality > max)
      errors.push(`Field '${field.name}' allows at most ${max} value(s)`);
    if (!valueTypeMatches(field, value)) errors.push(`Field '${field.name}' has an invalid value`);
  }
  return { errors, warnings };
};

export const assertDocumentMetadataValid = (
  fields: DocumentField[],
  metadata: DocumentMetadata,
  rejectUnknownFields = false,
  allowMissingRequired = false
) => {
  const result = validateDocumentMetadata(
    fields,
    metadata,
    allowMissingRequired,
    rejectUnknownFields
  );
  httpAssert.true(result.errors.length === 0, { status: 400, message: result.errors.join('; ') });
  return result;
};

export const documentLinksFromMetadata = (fields: DocumentField[], metadata: DocumentMetadata) => {
  const links: Array<{
    field_id: string;
    target_type: 'entity' | 'document';
    target_id: string;
    position: number;
  }> = [];
  for (const field of fields) {
    if (field.type !== 'entity_link' && field.type !== 'document_link') continue;
    const values = metadata[field.id];
    const normalizedValues: string[] = Array.isArray(values)
      ? values.filter((value): value is string => typeof value === 'string')
      : typeof values === 'string'
        ? [values]
        : [];
    normalizedValues.forEach((target_id, position) =>
      links.push({
        field_id: field.id,
        target_type: field.type === 'entity_link' ? 'entity' : 'document',
        target_id,
        position
      })
    );
  }
  return links;
};
