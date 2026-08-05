import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { parseCsv } from '../../utils/csvImport';
import { generateCsv } from '../../utils/csv';
import { httpAssert } from '../../utils/httpAssert';
import { requireSchemaRead, requireWorkspaceCapability } from '../auth/authorization';
import { isFieldEditRestricted, isFieldViewRestricted } from '../auth/fieldGroupAccessControl';
import { canEditTypedRelation } from './relationAccessControl';
import { relationRequiresApproval } from './relationHelpers';
import {
  createWorkspaceRelation,
  listAllRelations,
  updateWorkspaceRelation
} from './relationOperations';
import { collectRelationsFromIR } from './entityQueryOperations';
import type { RelationField } from '@arch-register/api-types/relationSchemaContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { EntityDbResult } from './db/catalogDatabase';
import type { RelationDbResult, RelationSchemaDbResult } from './db/relationDatabase';
import { defineOperation } from '../operation';
import { resolveRelationSchemaCatalogAt } from './schemaHistory';

const BASE_COLUMNS = ['_schemaId', '_inEntityId', '_outEntityId'] as const;
const BASE_COLUMN_SET = new Set<string>(BASE_COLUMNS);

type RelationCsvRow = Record<string, string>;

type RelationImportPreviewRow = {
  rowNumber: number;
  errors: string[];
  relation: Record<string, unknown> | null;
  isUpdate: boolean;
  existingId?: string;
  matchType?: 'natural-key' | 'none';
};

const csvResponse = (content: string, filename: string) => ({
  headers: {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': `attachment; filename="${filename}"`
  },
  body: new Blob([content], { type: 'text/csv; charset=utf-8' })
});

const relationSchemaName = (schema: RelationSchemaDbResult) =>
  schema.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const fieldValueForCsv = (value: unknown): unknown => {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
};

const relationFieldsForExport = (
  authCtx: WorkspaceAuthorizationContext,
  schema: RelationSchemaDbResult
) => schema.fields.filter(field => !isFieldViewRestricted(authCtx, schema, field.id));

const relationRowToCsv = (
  relation: RelationRecord,
  fields: RelationField[]
): Record<string, unknown> => {
  const row: Record<string, unknown> = {
    _schemaId: relation._schema.id,
    _inEntityId: relation._in.id,
    _outEntityId: relation._out.id
  };
  for (const field of fields) row[field.name] = fieldValueForCsv(relation[field.id]);
  return row;
};

export const exportRelationsCsv = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: WorkspaceAuthorizationContext,
  relationQuery: Parameters<typeof collectRelationsFromIR>[3]['relationQuery'],
  now = new Date()
) => {
  requireSchemaRead(authCtx);
  const [relationSchemas, schemas] = await Promise.all([
    db.relation.listRelationSchemas(workspace),
    db.catalog.listSchemas(workspace)
  ]);
  const relations = await collectRelationsFromIR(
    db,
    workspace,
    authCtx,
    { relationQuery },
    schemas,
    relationSchemas
  );

  const relationSchemaById = new Map(relationSchemas.map(schema => [schema.id, schema]));
  const responseRelationSchemaById = relationQuery.asOf
    ? await resolveRelationSchemaCatalogAt(
        db,
        workspace,
        relationSchemas,
        new Date(relationQuery.asOf)
      )
    : new Map(relationSchemas.map(schema => [schema.id, schema]));
  const schemaIds = [...new Set(relations.map(relation => relation._schema.id))];
  const currentSingleSchema =
    schemaIds.length === 1 && schemaIds[0] != null
      ? relationSchemaById.get(schemaIds[0])
      : undefined;
  const historicalSingleSchema =
    schemaIds.length === 1 && schemaIds[0] != null
      ? responseRelationSchemaById.get(schemaIds[0])
      : undefined;
  const fields = historicalSingleSchema
    ? relationFieldsForExport(authCtx, historicalSingleSchema)
    : [];
  const columns = [...BASE_COLUMNS, ...fields.map(field => field.name)];
  const rows = relations.map(relation => relationRowToCsv(relation, fields));
  const filename = `${currentSingleSchema ? relationSchemaName(currentSingleSchema) : 'relations'}-${
    now.toISOString().split('T')[0]
  }.csv`;
  return csvResponse(generateCsv(rows, columns), filename);
};

export const downloadRelationImportTemplate = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: WorkspaceAuthorizationContext,
  schemaId: string
) => {
  requireSchemaRead(authCtx);
  const schema = await db.relation.getRelationSchema(workspace, schemaId);
  httpAssert.present(schema, { status: 404, message: 'Relation schema not found' });
  const fields = relationFieldsForExport(authCtx, schema);
  const columns = [...BASE_COLUMNS, ...fields.map(field => field.name)];
  return csvResponse(
    columns.map(column => `"${column.replace(/"/g, '""')}"`).join(';'),
    `${relationSchemaName(schema)}-import-template.csv`
  );
};

const relationKey = (schemaId: string, inEntityId: string, outEntityId: string) =>
  `${schemaId}\u0000${inEntityId}\u0000${outEntityId}`;

const addEndpointErrors = (
  errors: string[],
  schema: RelationSchemaDbResult,
  inEntity: EntityDbResult | undefined,
  outEntity: EntityDbResult | undefined
) => {
  if (!inEntity) errors.push('In endpoint entity was not found');
  if (!outEntity) errors.push('Out endpoint entity was not found');
  if (inEntity && !schema.in_schema_ids.includes(inEntity.schema_id)) {
    errors.push(`In endpoint entity schema is not allowed by relation schema '${schema.name}'`);
  }
  if (outEntity && !schema.out_schema_ids.includes(outEntity.schema_id)) {
    errors.push(`Out endpoint entity schema is not allowed by relation schema '${schema.name}'`);
  }
  if (inEntity && outEntity && inEntity.id === outEntity.id) {
    errors.push('A relation cannot connect an entity to itself');
  }
};

const isIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const enumOptionValues = (
  field: RelationField,
  enums: Awaited<ReturnType<DatabaseAdapter['catalog']['listEnums']>>
) => {
  if (field.type !== 'select') return null;
  return new Set(
    enums.find(enumeration => enumeration.id === field.enumId)?.options.map(o => o.value)
  );
};

const parseFieldValue = (
  field: RelationField,
  raw: string,
  enums: Awaited<ReturnType<DatabaseAdapter['catalog']['listEnums']>>,
  errors: string[]
): unknown => {
  const value = raw.trim();
  if (!value) return undefined;
  switch (field.type) {
    case 'boolean':
      if (!['true', 'false', 'yes', 'no', '1', '0'].includes(value.toLowerCase())) {
        errors.push(`${field.name} must be a boolean (true/false)`);
        return undefined;
      }
      return ['true', 'yes', '1'].includes(value.toLowerCase());
    case 'date':
      if (!isIsoDate(value)) {
        errors.push(`${field.name} must be a date in YYYY-MM-DD format`);
        return undefined;
      }
      return value;
    case 'number': {
      const number = Number(value);
      if (!Number.isInteger(number)) {
        errors.push(`${field.name} must be a whole number`);
        return undefined;
      }
      if (field.min !== undefined && number < field.min) {
        errors.push(`${field.name} must be at least ${field.min}`);
        return undefined;
      }
      if (field.max !== undefined && number > field.max) {
        errors.push(`${field.name} must be at most ${field.max}`);
        return undefined;
      }
      return number;
    }
    case 'select': {
      const values = enumOptionValues(field, enums);
      if (values && !values.has(value)) {
        errors.push(`${field.name} contains an invalid option`);
        return undefined;
      }
      return value;
    }
    case 'text':
    case 'longtext':
      return value;
  }
};

const relationImportContext = async (db: DatabaseAdapter, workspace: string) => {
  const [relationSchemas, entities, entitySchemas, enums, existingRelations] = await Promise.all([
    db.relation.listRelationSchemas(workspace),
    db.catalog.listEntities(workspace),
    db.catalog.listSchemas(workspace),
    db.catalog.listEnums(workspace),
    listAllRelations(db, workspace, {})
  ]);
  return {
    relationSchemas,
    entities,
    entityById: new Map(entities.map(entity => [entity.id, entity])),
    entitySchemaById: new Map(entitySchemas.map(schema => [schema.id, schema])),
    relationSchemaById: new Map(relationSchemas.map(schema => [schema.id, schema])),
    enums,
    existingRelations
  };
};

const validateCsvRelationRow = (
  row: RelationCsvRow,
  headers: string[],
  authCtx: WorkspaceAuthorizationContext,
  context: Awaited<ReturnType<typeof relationImportContext>>
): RelationImportPreviewRow => {
  const errors: string[] = [];
  const schemaId = row._schemaId?.trim() ?? '';
  const inEntityId = row._inEntityId?.trim() ?? '';
  const outEntityId = row._outEntityId?.trim() ?? '';
  const schema = context.relationSchemaById.get(schemaId);
  const inEntity = context.entityById.get(inEntityId);
  const outEntity = context.entityById.get(outEntityId);
  const relation: Record<string, unknown> = {
    _schemaId: schemaId,
    _inEntityId: inEntityId,
    _outEntityId: outEntityId
  };

  if (!schema) {
    errors.push('Relation schema was not found');
  } else {
    addEndpointErrors(errors, schema, inEntity, outEntity);
    const inSchema = inEntity ? context.entitySchemaById.get(inEntity.schema_id) : undefined;
    const outSchema = outEntity ? context.entitySchemaById.get(outEntity.schema_id) : undefined;
    if (
      inEntity &&
      outEntity &&
      !canEditTypedRelation(
        authCtx,
        [
          { schema: inSchema, direction: 'in' },
          { schema: outSchema, direction: 'out' }
        ],
        schema.id
      )
    ) {
      errors.push('You do not have permission to edit this typed relation');
    }

    const fieldsByName = new Map(schema.fields.map(field => [field.name, field]));
    for (const header of headers) {
      if (BASE_COLUMN_SET.has(header)) continue;
      const field = fieldsByName.get(header);
      if (!field) {
        errors.push(`Unknown relation field: ${header}`);
        continue;
      }
      if (isFieldEditRestricted(authCtx, schema, field.id)) {
        errors.push(`You do not have permission to set field '${field.name}'`);
        continue;
      }
      const value = parseFieldValue(field, row[header] ?? '', context.enums, errors);
      if (value !== undefined) relation[field.id] = value;
    }
  }

  const matches = context.existingRelations.filter(
    existing =>
      existing.schema_id === schemaId &&
      existing.in_entity_id === inEntityId &&
      existing.out_entity_id === outEntityId
  );
  if (matches.length > 1) {
    errors.push('Multiple existing relations match this schema and endpoint pair');
  }
  const existing = matches[0];
  if (existing && schema && relationRequiresApproval(schema, existing)) {
    errors.push(
      `Relation '${existing.id}' requires an approved change proposal before it can be edited`
    );
  }
  if (existing && schema) {
    const declaredFieldIds = new Set(schema.fields.map(field => field.id));
    const visibleData = Object.fromEntries(
      Object.entries(existing.data).filter(
        ([fieldId]) =>
          declaredFieldIds.has(fieldId) && !isFieldViewRestricted(authCtx, schema, fieldId)
      )
    );
    relation._existingId = existing.id;
    for (const [fieldId, value] of Object.entries(visibleData)) {
      if (!(fieldId in relation)) relation[fieldId] = value;
    }
  }

  return {
    rowNumber: 0,
    errors,
    relation: errors.length === 0 ? relation : null,
    isUpdate: existing != null && errors.length === 0,
    existingId: existing?.id,
    matchType: existing ? 'natural-key' : 'none'
  };
};

export const parseRelationsImport = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: WorkspaceAuthorizationContext,
  csvContent: string
) => {
  requireSchemaRead(authCtx);
  const parsed = parseCsv(csvContent, { requiredFields: [...BASE_COLUMNS] });
  const context = await relationImportContext(db, workspace);
  const rows = parsed.rows.map(row => {
    const result = validateCsvRelationRow(row.data, parsed.headers, authCtx, context);
    return { ...result, rowNumber: row.rowNumber, errors: [...row.errors, ...result.errors] };
  });
  const seenKeys = new Set<string>();
  for (const row of rows) {
    const relation = row.relation;
    const schemaId = typeof relation?._schemaId === 'string' ? relation._schemaId : '';
    const inEntityId = typeof relation?._inEntityId === 'string' ? relation._inEntityId : '';
    const outEntityId = typeof relation?._outEntityId === 'string' ? relation._outEntityId : '';
    if (!schemaId || !inEntityId || !outEntityId) continue;
    const key = relationKey(schemaId, inEntityId, outEntityId);
    if (seenKeys.has(key)) {
      row.errors.push('Multiple imported rows use the same relation natural key');
      row.relation = null;
      row.isUpdate = false;
    } else {
      seenKeys.add(key);
    }
  }
  return {
    totalRows: rows.length,
    validRows: rows.filter(row => row.errors.length === 0).length,
    relations: rows
  };
};

const normalizeCommitRelation = (
  input: Record<string, unknown>,
  authCtx: WorkspaceAuthorizationContext,
  context: Awaited<ReturnType<typeof relationImportContext>>
) => {
  const schemaId = typeof input._schemaId === 'string' ? input._schemaId : '';
  const inEntityId = typeof input._inEntityId === 'string' ? input._inEntityId : '';
  const outEntityId = typeof input._outEntityId === 'string' ? input._outEntityId : '';
  const schema = context.relationSchemaById.get(schemaId);
  const errors: string[] = [];
  if (!schema) errors.push('Relation schema was not found');
  if (schema) {
    addEndpointErrors(
      errors,
      schema,
      context.entityById.get(inEntityId),
      context.entityById.get(outEntityId)
    );
    const inEntity = context.entityById.get(inEntityId);
    const outEntity = context.entityById.get(outEntityId);
    const inSchema = inEntity ? context.entitySchemaById.get(inEntity.schema_id) : undefined;
    const outSchema = outEntity ? context.entitySchemaById.get(outEntity.schema_id) : undefined;
    if (
      !canEditTypedRelation(
        authCtx,
        [
          { schema: inSchema, direction: 'in' },
          { schema: outSchema, direction: 'out' }
        ],
        schema.id
      )
    ) {
      errors.push('You do not have permission to edit this typed relation');
    }
  }
  const data: Record<string, unknown> = {};
  if (schema) {
    const fieldsById = new Map(schema.fields.map(field => [field.id, field]));
    for (const [fieldId, raw] of Object.entries(input)) {
      if (fieldId.startsWith('_')) continue;
      const field = fieldsById.get(fieldId);
      if (!field) {
        errors.push(`Unknown relation field: ${fieldId}`);
        continue;
      }
      if (isFieldEditRestricted(authCtx, schema, field.id)) {
        errors.push(`You do not have permission to set field '${field.name}'`);
        continue;
      }
      const serialized = raw == null ? '' : String(raw);
      const value = parseFieldValue(field, serialized, context.enums, errors);
      if (value !== undefined) data[field.id] = value;
    }
  }
  return { schemaId, inEntityId, outEntityId, data, errors };
};

export const commitRelationsImport = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: WorkspaceAuthorizationContext,
  event: AuthenticatedEvent,
  relations: Array<Record<string, unknown>>,
  workspaceReference = workspace
) => {
  requireWorkspaceCapability(authCtx, 'ent.edit');
  const context = await relationImportContext(db, workspace);
  const normalized = relations.map(input => ({
    input,
    ...normalizeCommitRelation(input, authCtx, context)
  }));
  const existingById = new Map(context.existingRelations.map(relation => [relation.id, relation]));
  const existingByKey = new Map<string, RelationDbResult[]>();
  for (const relation of context.existingRelations) {
    const key = relationKey(relation.schema_id, relation.in_entity_id, relation.out_entity_id);
    const matches = existingByKey.get(key) ?? [];
    matches.push(relation);
    existingByKey.set(key, matches);
  }

  const importKeys = new Set<string>();
  for (const row of normalized) {
    const key = relationKey(row.schemaId, row.inEntityId, row.outEntityId);
    if (importKeys.has(key))
      row.errors.push('Multiple imported rows use the same relation natural key');
    importKeys.add(key);
    const requestedExistingId =
      typeof row.input._existingId === 'string' ? row.input._existingId : undefined;
    let existing: RelationDbResult | undefined;
    if (requestedExistingId) {
      existing = existingById.get(requestedExistingId);
      if (!existing) {
        row.errors.push(`Existing relation '${requestedExistingId}' was not found`);
      } else if (
        relationKey(existing.schema_id, existing.in_entity_id, existing.out_entity_id) !== key
      ) {
        row.errors.push('Existing relation does not match the imported natural key');
      }
    } else {
      const matches = existingByKey.get(key) ?? [];
      if (matches.length > 1) {
        row.errors.push('Multiple existing relations match the imported natural key');
      } else {
        existing = matches[0];
      }
    }
    const schema = context.relationSchemaById.get(row.schemaId);
    if (existing && schema && relationRequiresApproval(schema, existing)) {
      row.errors.push(
        `Relation '${existing.id}' requires an approved change proposal before it can be edited`
      );
    }
  }
  const invalid = normalized.filter(row => row.errors.length > 0);
  httpAssert.true(invalid.length === 0, {
    status: 400,
    message: invalid
      .map(row => row.errors.join('; '))
      .filter(Boolean)
      .join(' | ')
  });

  return db.core.transaction(async tx => {
    let created = 0;
    let updated = 0;
    const ids: string[] = [];
    for (const row of normalized) {
      const key = relationKey(row.schemaId, row.inEntityId, row.outEntityId);
      const matches = existingByKey.get(key) ?? [];
      httpAssert.true(matches.length <= 1, {
        status: 400,
        message: 'Multiple existing relations match the imported natural key'
      });
      const existingId =
        typeof row.input._existingId === 'string' ? row.input._existingId : matches[0]?.id;
      if (existingId) {
        const result = await updateWorkspaceRelation(
          tx,
          workspaceReference,
          existingId,
          row.data,
          event
        );
        ids.push(result._uid);
        updated++;
      } else {
        const result = await createWorkspaceRelation(
          tx,
          workspaceReference,
          {
            _schemaId: row.schemaId,
            _inEntityId: row.inEntityId,
            _outEntityId: row.outEntityId,
            ...row.data
          },
          event
        );
        ids.push(result._uid);
        created++;
      }
    }
    return { created, updated, ids };
  });
};

export const exportRelationsCsvOperation = (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent,
  relationQuery: Parameters<typeof collectRelationsFromIR>[3]['relationQuery']
) =>
  defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to export relations' },
    async ({ ws, authCtx }) => exportRelationsCsv(db, ws, authCtx, relationQuery)
  );

export const downloadRelationImportTemplateOperation = (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent,
  schemaId: string
) =>
  defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to download relation import template' },
    async ({ ws, authCtx }) => downloadRelationImportTemplate(db, ws, authCtx, schemaId)
  );

export const parseRelationsImportOperation = (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent,
  csvContent: string
) =>
  defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to parse relation import' },
    async ({ ws, authCtx }) => parseRelationsImport(db, ws, authCtx, csvContent)
  );

export const commitRelationsImportOperation = (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent,
  relations: Array<Record<string, unknown>>
) =>
  defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to import relations' },
    async ({ ws, authCtx }) => commitRelationsImport(db, ws, authCtx, event, relations, workspace)
  );
