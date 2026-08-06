import type { TechnologyEolMapping } from '@arch-register/api-types/jobsContract';
import type { SchemaDbResult } from '../catalog/db/catalogDatabase';
import { isFieldGroupAccessControlled } from '../auth/fieldGroupAccessControl';
import { httpAssert } from '../../utils/httpAssert';

const destinationFieldKeys = [
  'latestVersionFieldId',
  'releaseDateFieldId',
  'supportUntilFieldId',
  'securityUntilFieldId',
  'eolDateFieldId',
  'sourceUrlFieldId',
  'synchronizedAtFieldId'
] as const;

const isFieldId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

export const isTechnologyEolMapping = (value: unknown): value is TechnologyEolMapping => {
  if (typeof value !== 'object' || value == null) return false;
  const mapping = value as Record<string, unknown>;
  if (!isFieldId(mapping['productFieldId']) || !isFieldId(mapping['cycleFieldId'])) return false;
  return destinationFieldKeys.every(key => {
    const fieldId = mapping[key];
    return fieldId === null || isFieldId(fieldId);
  });
};

export const destinationFieldIds = (mapping: TechnologyEolMapping) =>
  destinationFieldKeys
    .map(key => mapping[key])
    .filter((fieldId): fieldId is string => fieldId != null);

const compatibleField = (field: { type: string }, role: 'text' | 'date') =>
  role === 'text'
    ? field.type === 'text' || field.type === 'longtext'
    : field.type === 'date' || field.type === 'text' || field.type === 'longtext';

export const assertTechnologyEolMapping = (
  schema: SchemaDbResult | null,
  mapping: TechnologyEolMapping
) => {
  if (!schema) {
    httpAssert.present(schema, { status: 404, message: 'Target schema not found' });
    throw new Error('Target schema not found');
  }
  const fields = new Map(schema.fields.map(field => [field.id, field]));
  const inputFields = [mapping.productFieldId, mapping.cycleFieldId];
  for (const fieldId of inputFields) {
    const field = fields.get(fieldId);
    httpAssert.present(field, { status: 400, message: `Input field '${fieldId}' was not found` });
    httpAssert.true(compatibleField(field!, 'text'), {
      status: 400,
      message: `Input field '${fieldId}' must be a text field`
    });
  }
  const accessControlledInput = inputFields.find(fieldId =>
    isFieldGroupAccessControlled(schema, fieldId)
  );
  httpAssert.true(accessControlledInput == null, {
    status: 400,
    message: `Input field '${accessControlledInput}' cannot belong to an access-controlled field group`
  });

  const destinations = destinationFieldIds(mapping);
  httpAssert.true(new Set(destinations).size === destinations.length, {
    status: 400,
    message: 'Each destination field can only be mapped once'
  });
  httpAssert.true(!destinations.some(fieldId => inputFields.includes(fieldId)), {
    status: 400,
    message: 'Input fields cannot also be destination fields'
  });
  for (const fieldId of destinations) {
    const field = fields.get(fieldId);
    httpAssert.present(field, {
      status: 400,
      message: `Destination field '${fieldId}' was not found`
    });
    httpAssert.true(field!.type !== 'derived', {
      status: 400,
      message: 'Technology End of Life mappings cannot target derived fields'
    });
    httpAssert.true(
      compatibleField(field!, fieldId === mapping.sourceUrlFieldId ? 'text' : 'date'),
      {
        status: 400,
        message: `Destination field '${fieldId}' has an incompatible type`
      }
    );
  }
  return schema;
};
