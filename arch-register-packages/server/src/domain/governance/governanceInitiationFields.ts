import type {
  GovernanceInitiationField,
  GovernanceInitiationFieldValue
} from '@arch-register/api-types/governanceInitiationFields';
import type { GovernanceWorkflowConfig } from '@arch-register/api-types/governanceCaseConfigSchemas';
import type { DatabaseAdapter } from '../../db/database';
import { httpAssert } from '../../utils/httpAssert';

const optionsFor = async (
  db: DatabaseAdapter,
  workspace: string,
  field: Extract<GovernanceInitiationField, { type: 'enum' }>
) => {
  if (field.options) return field.options;
  const enumeration = field.enumId
    ? (await db.catalog.listEnums(workspace)).find(candidate => candidate.id === field.enumId)
    : undefined;
  httpAssert.present(enumeration, {
    status: 400,
    message: `Initiation field '${field.id}' references an unknown workspace enumeration`
  });
  return enumeration.options;
};

const valueFor = async (
  db: DatabaseAdapter,
  workspace: string,
  field: GovernanceInitiationField,
  rawValue: unknown
): Promise<GovernanceInitiationFieldValue> => {
  const value = rawValue === undefined || rawValue === '' ? null : rawValue;
  if (field.requirementLevel === 'required') {
    httpAssert.true(value !== null, {
      status: 400,
      message: `Required initiation field '${field.id}' is missing`
    });
  }

  if (value !== null) {
    if (field.type === 'text') {
      httpAssert.true(typeof value === 'string', {
        status: 400,
        message: `Initiation field '${field.id}' must be text`
      });
    } else if (field.type === 'rating') {
      httpAssert.true(
        typeof value === 'number' &&
          Number.isInteger(value) &&
          value >= 1 &&
          value <= (field.max ?? 5),
        {
          status: 400,
          message: `Initiation field '${field.id}' must be an integer rating between 1 and ${field.max ?? 5}`
        }
      );
    } else {
      const options = await optionsFor(db, workspace, field);
      httpAssert.true(typeof value === 'string' && options.some(option => option.value === value), {
        status: 400,
        message: `Initiation field '${field.id}' must contain a valid option`
      });
    }
  }

  return {
    ...field,
    ...(field.type === 'enum' && field.options == null
      ? { options: await optionsFor(db, workspace, field) }
      : {}),
    value
  } as GovernanceInitiationFieldValue;
};

export const validateGovernanceInitiationFieldDefinitions = async (
  db: DatabaseAdapter,
  workspace: string,
  fields: GovernanceInitiationField[]
) => {
  const ids = new Set<string>();
  for (const field of fields) {
    httpAssert.true(!ids.has(field.id), {
      status: 400,
      message: `Initiation field id '${field.id}' is duplicated`
    });
    ids.add(field.id);
    if (field.type === 'enum') await optionsFor(db, workspace, field);
  }
};

export const resolveGovernanceInitiationFields = async (
  db: DatabaseAdapter,
  workspace: string,
  config: GovernanceWorkflowConfig,
  values: Record<string, unknown> | undefined
): Promise<GovernanceInitiationFieldValue[]> => {
  const fields = config.initiationFields ?? [];
  await validateGovernanceInitiationFieldDefinitions(db, workspace, fields);
  return await Promise.all(fields.map(field => valueFor(db, workspace, field, values?.[field.id])));
};
