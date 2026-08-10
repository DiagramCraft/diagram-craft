import { bonsai, type ASTNode, type CompiledExpression } from 'bonsai-js';
import { arrays, math } from 'bonsai-js/stdlib';
import type { ValidationRule } from '@arch-register/api-types/schemaContract';
import { httpAssert } from '../../utils/httpAssert';
import type { DatabaseAdapter } from '../../db/database';
import type { RelationDbResult, RelationSchemaDbResult } from './db/relationDatabase';
import { buildEntityProjection } from '../derived/entityProjection';
import { buildEntityDependents } from './dataHelpers';

export type ValidationDiagnostic = {
  ruleId: string;
  entityId: string;
  schemaId: string;
  schemaVersion: number;
  severity: 'error' | 'warning';
  message: string;
  fieldId?: string;
};

export type RelationValidationDiagnostic = Omit<ValidationDiagnostic, 'entityId'> & {
  relationId: string;
};

export type EntityValidationResult = {
  entityId: string;
  schemaId: string;
  schemaVersion: number;
  errors: ValidationDiagnostic[];
  warnings: ValidationDiagnostic[];
};

export type EntityValidationSummary = {
  results: EntityValidationResult[];
  relationResults: RelationValidationResult[];
  errors: Array<ValidationDiagnostic | RelationValidationDiagnostic>;
  warnings: Array<ValidationDiagnostic | RelationValidationDiagnostic>;
};

export type RelationValidationResult = {
  relationId: string;
  schemaId: string;
  schemaVersion: number;
  errors: RelationValidationDiagnostic[];
  warnings: RelationValidationDiagnostic[];
};

type ValidationPlan = {
  rules: ValidationRule[];
  compiled: Map<string, CompiledExpression>;
};

const engine = bonsai<Record<string, unknown>>({ timeout: 50, maxDepth: 50 }).use(arrays).use(math);

const collectObjectLiteralKeys = (node: ASTNode, keys: Set<string>) => {
  const property = node as unknown as {
    type: string;
    computed?: boolean;
    key?: { type: string; name?: string };
  };
  if (
    property.type === 'ObjectProperty' &&
    !property.computed &&
    property.key?.type === 'Identifier' &&
    property.key.name
  ) {
    keys.add(property.key.name);
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      value.forEach(item => {
        if (item && typeof item === 'object' && 'type' in item) {
          collectObjectLiteralKeys(item as ASTNode, keys);
        }
      });
    } else if (value && typeof value === 'object' && 'type' in value) {
      collectObjectLiteralKeys(value as ASTNode, keys);
    }
  }
};

export const normalizeValidationRules = (
  rawRules: unknown,
  fields: readonly unknown[]
): ValidationRule[] => {
  if (rawRules === undefined || rawRules === null) return [];
  httpAssert.true(Array.isArray(rawRules), { message: 'Validation rules must be an array' });

  const fieldIds = new Set(
    fields.flatMap(field =>
      field && typeof field === 'object' && 'id' in field && typeof field.id === 'string'
        ? [field.id]
        : []
    )
  );
  const ids = new Set<string>();
  return (rawRules as unknown[]).map(raw => {
    httpAssert.json(raw, { message: 'Validation rules must be objects' });
    const rule = raw as Record<string, unknown>;
    const id = typeof rule.id === 'string' ? rule.id.trim() : '';
    const name = typeof rule.name === 'string' ? rule.name.trim() : '';
    const expression = typeof rule.expression === 'string' ? rule.expression.trim() : '';
    const message = typeof rule.message === 'string' ? rule.message.trim() : '';
    httpAssert.true(id.length > 0, { message: 'Validation rule id is required' });
    httpAssert.true(name.length > 0, { message: `Validation rule '${id}' name is required` });
    httpAssert.true(expression.length > 0, {
      message: `Validation rule '${id}' expression is required`
    });
    httpAssert.true(message.length > 0, {
      message: `Validation rule '${id}' message is required`
    });
    httpAssert.true(!ids.has(id), { message: `Duplicate validation rule id '${id}'` });
    ids.add(id);

    const severity = rule.severity;
    httpAssert.true(severity === 'error' || severity === 'warning', {
      message: `Validation rule '${id}' severity must be error or warning`
    });
    const fieldId = rule.fieldId;
    httpAssert.true(
      fieldId === undefined || (typeof fieldId === 'string' && fieldIds.has(fieldId)),
      {
        message: `Validation rule '${id}' references an unknown field`
      }
    );
    httpAssert.true(rule.active === undefined || typeof rule.active === 'boolean', {
      message: `Validation rule '${id}' active must be a boolean`
    });

    return {
      id,
      name,
      expression,
      message,
      severity,
      ...(fieldId === undefined ? {} : { fieldId: fieldId as string }),
      active: rule.active !== false
    } as ValidationRule;
  });
};

export const buildValidationPlan = (
  rules: ValidationRule[],
  root: 'entity' | 'relation' = 'entity'
): ValidationPlan => {
  const compiled = new Map<string, CompiledExpression>();
  for (const rule of rules) {
    const validation = engine.validate(rule.expression);
    if (!validation.valid) {
      throw new Error(
        `Invalid expression for validation rule '${rule.id}': ${validation.errors
          .map(error => error.formatted ?? error.message)
          .join('; ')}`
      );
    }
    const objectLiteralKeys = new Set<string>();
    collectObjectLiteralKeys(validation.ast, objectLiteralKeys);
    const unsupportedIdentifiers = validation.references.identifiers.filter(
      identifier => identifier !== root && !objectLiteralKeys.has(identifier)
    );
    if (unsupportedIdentifiers.length > 0) {
      throw new Error(
        `Validation rule '${rule.id}' may only reference fields through ${root} — found ${unsupportedIdentifiers.join(', ')}`
      );
    }
    compiled.set(rule.id, engine.compile(rule.expression));
  }
  return { rules, compiled };
};

export const evaluateValidationRules = (
  rules: ValidationRule[],
  projection: Record<string, unknown>,
  record: { id: string; schemaId: string; schemaVersion: number },
  root: 'entity' | 'relation' = 'entity'
): EntityValidationResult | RelationValidationResult => {
  const plan = buildValidationPlan(rules, root);
  const errors: Array<ValidationDiagnostic | RelationValidationDiagnostic> = [];
  const warnings: Array<ValidationDiagnostic | RelationValidationDiagnostic> = [];

  for (const rule of plan.rules) {
    if (!rule.active) continue;
    let passed: unknown;
    let message = rule.message;
    let severity = rule.severity;
    try {
      passed = plan.compiled.get(rule.id)!.evaluateSync({ [root]: projection });
    } catch {
      passed = false;
      message = `Validation rule '${rule.name}' could not be evaluated`;
      severity = 'error';
    }

    if (passed !== true && passed !== false) {
      message = `Validation rule '${rule.name}' did not return a boolean`;
      severity = 'error';
      passed = false;
    }

    const diagnostic = {
      ruleId: rule.id,
      ...(root === 'entity' ? { entityId: record.id } : { relationId: record.id }),
      schemaId: record.schemaId,
      schemaVersion: record.schemaVersion,
      severity,
      message,
      ...(rule.fieldId ? { fieldId: rule.fieldId } : {})
    } as ValidationDiagnostic | RelationValidationDiagnostic;
    if (passed === true) continue;
    if (severity === 'error') errors.push(diagnostic);
    else warnings.push(diagnostic);
  }

  return {
    ...(root === 'entity' ? { entityId: record.id } : { relationId: record.id }),
    schemaId: record.schemaId,
    schemaVersion: record.schemaVersion,
    errors,
    warnings
  } as EntityValidationResult | RelationValidationResult;
};

export const assertValidationRulesValid = (
  rules: ValidationRule[],
  root: 'entity' | 'relation' = 'entity'
) => {
  try {
    buildValidationPlan(rules, root);
  } catch (error) {
    httpAssert.true(false, {
      status: 400,
      message: error instanceof Error ? error.message : String(error)
    });
  }
};

const relationProjection = (
  relation: RelationDbResult,
  entities: Awaited<ReturnType<DatabaseAdapter['catalog']['listEntities']>>,
  schemas: Awaited<ReturnType<DatabaseAdapter['catalog']['listSchemas']>>,
  relations: RelationDbResult[],
  relationSchemas: RelationSchemaDbResult[]
): Record<string, unknown> => ({
  ...relation.data,
  metadata: {
    id: relation.id,
    schemaId: relation.schema_id,
    inEntityId: relation.in_entity_id,
    outEntityId: relation.out_entity_id
  },
  in: buildEntityProjection(relation.in_entity_id, entities, schemas, relations, relationSchemas, {
    depth: 0
  }),
  out: buildEntityProjection(
    relation.out_entity_id,
    entities,
    schemas,
    relations,
    relationSchemas,
    { depth: 0 }
  )
});

export const validateEntityGraph = async (
  db: DatabaseAdapter,
  workspace: string,
  changedEntityIds: string[]
): Promise<EntityValidationSummary> => {
  if (
    typeof db.catalog.listEntities !== 'function' ||
    typeof db.catalog.listSchemas !== 'function' ||
    !db.relation ||
    typeof db.relation.listRelationsForEntities !== 'function'
  ) {
    return { results: [], relationResults: [], errors: [], warnings: [] };
  }
  const [entities, schemas] = await Promise.all([
    db.catalog.listEntities(workspace),
    db.catalog.listSchemas(workspace)
  ]);
  const relationRows = await db.relation.listRelationsForEntities(
    workspace,
    entities.map(entity => entity.id)
  );
  const relations: RelationDbResult[] = [...relationRows.outgoing, ...relationRows.incoming].filter(
    (row, index, rows) => rows.findIndex(candidate => candidate.id === row.id) === index
  );
  const relationSchemas: RelationSchemaDbResult[] =
    typeof db.relation.listRelationSchemas === 'function'
      ? await db.relation.listRelationSchemas(workspace)
      : [];
  const entityById = new Map(entities.map(entity => [entity.id, entity]));
  const schemaById = new Map(schemas.map(schema => [schema.id, schema]));
  const targets = new Set<string>();

  for (const entityId of new Set(changedEntityIds)) {
    if (!entityById.has(entityId)) continue;
    targets.add(entityId);
    const dependents = buildEntityDependents(
      entityId,
      entities,
      schemas,
      { transitive: false },
      null,
      relations,
      relationSchemas
    );
    dependents.dependents.forEach(dependent => targets.add(dependent.entityId));
  }

  const results: EntityValidationResult[] = [];
  for (const entityId of [...targets].sort()) {
    const entity = entityById.get(entityId);
    const schema = entity ? schemaById.get(entity.schema_id) : undefined;
    if (!entity || !schema || (schema.validation_rules ?? []).length === 0) continue;
    const projection = buildEntityProjection(
      entity.id,
      entities,
      schemas,
      relations,
      relationSchemas,
      { depth: 1 }
    );
    if (!projection) continue;
    results.push(
      evaluateValidationRules(schema.validation_rules ?? [], projection, {
        id: entity.id,
        schemaId: schema.id,
        schemaVersion: schema.version ?? 1
      }) as EntityValidationResult
    );
  }

  const relationResults: RelationValidationResult[] = [];
  const changedIds = new Set(changedEntityIds);
  for (const relation of relations.filter(
    candidate => changedIds.has(candidate.in_entity_id) || changedIds.has(candidate.out_entity_id)
  )) {
    const schema = relationSchemas.find(candidate => candidate.id === relation.schema_id);
    if (!schema || (schema.validation_rules ?? []).length === 0) continue;
    const projection = relationProjection(relation, entities, schemas, relations, relationSchemas);
    relationResults.push(
      evaluateValidationRules(
        schema.validation_rules ?? [],
        projection,
        { id: relation.id, schemaId: schema.id, schemaVersion: schema.version ?? 1 },
        'relation'
      ) as RelationValidationResult
    );
  }

  return {
    results,
    relationResults,
    errors: [...results, ...relationResults].flatMap(
      result => result.errors as Array<ValidationDiagnostic | RelationValidationDiagnostic>
    ),
    warnings: [...results, ...relationResults].flatMap(
      result => result.warnings as Array<ValidationDiagnostic | RelationValidationDiagnostic>
    )
  };
};

export const assertEntityGraphValid = (summary: EntityValidationSummary) => {
  if (summary.errors.length === 0) return;
  httpAssert.true(false, {
    status: 400,
    message: summary.errors.map(error => error.message).join('; '),
    data: { validation: summary }
  });
};

export const previewEntityValidation = async (
  db: DatabaseAdapter,
  workspace: string,
  schemaId: string,
  rules: ValidationRule[],
  entityIds?: string[]
): Promise<EntityValidationResult[]> => {
  const [entities, schemas] = await Promise.all([
    db.catalog.listEntities(workspace),
    db.catalog.listSchemas(workspace)
  ]);
  const schema = schemas.find(candidate => candidate.id === schemaId);
  httpAssert.present(schema, { status: 404, message: `Schema '${schemaId}' not found` });
  const relationRows = await db.relation.listRelationsForEntities(
    workspace,
    entities.map(entity => entity.id)
  );
  const relations: RelationDbResult[] = [...relationRows.outgoing, ...relationRows.incoming].filter(
    (row, index, rows) => rows.findIndex(candidate => candidate.id === row.id) === index
  );
  const relationSchemas: RelationSchemaDbResult[] =
    typeof db.relation.listRelationSchemas === 'function'
      ? await db.relation.listRelationSchemas(workspace)
      : [];
  const selectedIds = entityIds ? new Set(entityIds) : undefined;
  const plan = buildValidationPlan(rules);
  return entities
    .filter(entity => entity.schema_id === schemaId && (!selectedIds || selectedIds.has(entity.id)))
    .map(entity => {
      const projection = buildEntityProjection(
        entity.id,
        entities,
        schemas,
        relations,
        relationSchemas,
        { depth: 1 }
      );
      return projection
        ? (evaluateValidationRules(plan.rules, projection, {
            id: entity.id,
            schemaId,
            schemaVersion: (schema.version ?? 1) + 1
          }) as EntityValidationResult)
        : {
            entityId: entity.id,
            schemaId,
            schemaVersion: (schema.version ?? 1) + 1,
            errors: [],
            warnings: []
          };
    });
};
