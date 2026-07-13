export type ImportMatch = {
  id: string;
  name: string;
  slug?: string;
  namespace?: string;
};

export type ImportConstraintViolation = {
  type: 'duplicate_slug' | 'wrong_workspace' | 'wrong_schema';
  message: string;
};

export type ImportParseEntity = {
  rowNumber: number;
  errors: string[];
  entity: Record<string, unknown> | null;
  isUpdate: boolean;
  matchType?: 'id' | 'slug' | 'name' | 'none';
  nameMatches?: ImportMatch[];
  existingId?: string;
  existingEntity?: Record<string, unknown> | null;
  constraintViolations?: ImportConstraintViolation[];
};

export type ImportReviewRow = {
  rowNumber: number;
  errors: string[];
  entity: Record<string, unknown> | null;
  accepted: boolean;
  expanded: boolean;
  isUpdate: boolean;
  hasChanges: boolean;
  matchType: 'id' | 'slug' | 'name' | 'none';
  nameMatches: ImportMatch[];
  userChoice?: 'update' | 'create';
  existingId?: string;
  existingEntity?: Record<string, unknown> | null;
  constraintViolations?: ImportConstraintViolation[];
};

export const normalizeImportValue = (value: unknown) =>
  value === '' || value === null || value === undefined ? null : value;

export const hasActualChanges = (
  newEntity: Record<string, unknown>,
  oldEntity: Record<string, unknown>
): boolean => {
  const fieldsToCompare = Object.keys(newEntity).filter(
    key => !['_existingId', '_schemaId'].includes(key)
  );

  return fieldsToCompare.some(key => {
    const oldValue = normalizeImportValue(oldEntity[key]);
    const newValue = normalizeImportValue(newEntity[key]);
    return JSON.stringify(oldValue) !== JSON.stringify(newValue);
  });
};

export const getChangedImportFields = (
  newEntity: Record<string, unknown>,
  oldEntity: Record<string, unknown>
): { metadata: string[]; custom: string[] } => {
  const fieldsToCompare = Object.keys(newEntity).filter(
    key => !['_existingId', '_schemaId'].includes(key)
  );
  const changed = fieldsToCompare.filter(key => {
    const oldValue = normalizeImportValue(oldEntity[key]);
    const newValue = normalizeImportValue(newEntity[key]);
    return JSON.stringify(oldValue) !== JSON.stringify(newValue);
  });

  return {
    metadata: changed.filter(key => key.startsWith('_')).sort(),
    custom: changed.filter(key => !key.startsWith('_')).sort()
  };
};

export const getImportDetailEntries = (entity: Record<string, unknown>) => {
  const entries = Object.entries(entity).filter(
    ([_key, value]) => value !== undefined && value !== '' && value !== null
  );
  return {
    metadata: entries
      .filter(([key]) => key.startsWith('_'))
      .sort(([a], [b]) => a.localeCompare(b)),
    custom: entries
      .filter(([key]) => !key.startsWith('_'))
      .sort(([a], [b]) => a.localeCompare(b))
  };
};

export const formatImportFieldLabel = (key: string) =>
  key.startsWith('_') ? key.substring(1).charAt(0).toUpperCase() + key.substring(2) : key;

export const isEmptyImportValue = (value: unknown) =>
  value === undefined || value === null || value === '';

export const formatImportValue = (value: unknown) =>
  Array.isArray(value) ? value.join(', ') : String(value);

export const toImportReviewRow = (input: ImportParseEntity): ImportReviewRow => {
  const matchType = input.matchType ?? 'none';
  const hasChanges =
    input.isUpdate && input.entity && input.existingEntity
      ? hasActualChanges(input.entity, input.existingEntity)
      : true;
  const hasConstraintViolations = (input.constraintViolations?.length ?? 0) > 0;

  return {
    rowNumber: input.rowNumber,
    errors: input.errors,
    entity: input.entity,
    accepted:
      input.errors.length === 0 &&
      hasChanges &&
      matchType !== 'name' &&
      !hasConstraintViolations,
    expanded: false,
    isUpdate: input.isUpdate,
    hasChanges,
    matchType,
    nameMatches: input.nameMatches ?? [],
    userChoice: undefined,
    existingId: input.existingId,
    existingEntity: input.existingEntity,
    constraintViolations: input.constraintViolations
  };
};

export const buildImportCommitEntities = (
  rows: ImportReviewRow[],
  schemaId: string
): Array<Record<string, unknown>> =>
  rows
    .filter(
      (row): row is ImportReviewRow & { entity: Record<string, unknown> } =>
        !!row.accepted && !!row.entity
    )
    .map(row => {
      const entity: Record<string, unknown> = {
        ...row.entity,
        _schemaId: schemaId
      };

      if (
        row.matchType === 'id' ||
        row.matchType === 'slug' ||
        (row.matchType === 'name' && row.userChoice === 'update')
      ) {
        entity._existingId = row.existingId ?? row.nameMatches[0]?.id;
      }

      return entity;
    });
