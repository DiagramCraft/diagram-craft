import {
  type EntityQuery,
  type FilterOp,
  type PathStep,
  type QueryNode
} from '@arch-register/api-types/entityQueryIR';
import {
  isReferenceOrContainmentField,
  relationFieldById,
  schemaFieldById,
  type RelationSchemaCatalog,
  type SchemaCatalog
} from './entityQueryIRResolution';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import type { RelationField } from '@arch-register/api-types/relationSchemaContract';
import { relationSchemaNameById, schemaNameById } from './entityQueryTextResolver';

const quoteString = (value: string): string =>
  `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

const printSchemaRef = (name: string): string =>
  /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : quoteString(name);

const fieldTypeAt = (
  fieldId: string,
  schemaId: string | undefined,
  schemas: SchemaCatalog
): SchemaField['type'] | undefined => {
  if (!schemaId) return undefined;
  return schemaFieldById(schemas.get(schemaId), fieldId)?.type;
};

const relationFieldTypeAt = (
  fieldId: string,
  relationSchemaId: string | undefined,
  relationSchemas: RelationSchemaCatalog
): RelationField['type'] | undefined => {
  if (!relationSchemaId) return undefined;
  return relationFieldById(relationSchemas.get(relationSchemaId), fieldId)?.type;
};

const printValueLiteral = (
  value: unknown,
  fieldType: SchemaField['type'] | RelationField['type'] | undefined
): string => {
  if (fieldType === 'date') return `date(${quoteString(String(value))})`;
  if (typeof value === 'number') return String(value);
  return quoteString(String(value));
};

const printComparatorAndValue = (
  op: FilterOp,
  value: unknown,
  fieldType: SchemaField['type'] | RelationField['type'] | undefined
): string => {
  switch (op) {
    case 'equals':
    case 'on':
      return `= ${printValueLiteral(value, fieldType)}`;
    case 'not_equals':
      return `!= ${printValueLiteral(value, fieldType)}`;
    case 'contains':
      return `~ ${printValueLiteral(value, fieldType)}`;
    case 'starts_with':
      return `^= ${printValueLiteral(value, fieldType)}`;
    case 'ends_with':
      return `$= ${printValueLiteral(value, fieldType)}`;
    case 'before':
    case 'lt':
      return `< ${printValueLiteral(value, fieldType)}`;
    case 'after':
    case 'gt':
      return `> ${printValueLiteral(value, fieldType)}`;
    case 'gte':
      return `>= ${printValueLiteral(value, fieldType)}`;
    case 'lte':
      return `<= ${printValueLiteral(value, fieldType)}`;
    case 'empty':
      return '= empty';
    case 'not_empty':
      return '= not_empty';
    case 'in':
      return `in (${(Array.isArray(value) ? value : [value])
        .map(v => printValueLiteral(v, fieldType))
        .join(', ')})`;
  }
};

type PrintedPath = {
  text: string;
  endSchemaId: string | undefined;
  endRelationSchemaId: string | undefined;
};

const printPathSteps = (
  steps: PathStep[],
  startSchemaId: string | undefined,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  startRelationSchemaId?: string
): PrintedPath => {
  let schemaId = startSchemaId;
  let relationSchemaId = startRelationSchemaId;
  const parts = steps.map(step => {
    if (step.kind === 'forward') {
      const field = schemaFieldById(schemas.get(schemaId ?? ''), step.fieldId);
      if (field && isReferenceOrContainmentField(field)) schemaId = field.schemaId;
      relationSchemaId = undefined;
      const filterText = step.filter
        ? `[${printTextQueryNode(step.filter, schemaId, schemas, relationSchemas)}]`
        : '';
      return `${step.fieldId}${filterText}`;
    }
    if (step.kind === 'backward') {
      const ownerName = printSchemaRef(schemaNameById(schemas, step.ownerSchemaId));
      schemaId = step.ownerSchemaId;
      relationSchemaId = undefined;
      const filterText = step.filter
        ? `[${printTextQueryNode(step.filter, schemaId, schemas, relationSchemas)}]`
        : '';
      return `<-${ownerName}.${step.fieldId}${filterText}`;
    }
    if (step.kind === 'endpoint') {
      const relationSchema = relationSchemaId ? relationSchemas.get(relationSchemaId) : undefined;
      const targetSchemaIds =
        step.direction === 'in' ? relationSchema?.in_schema_ids : relationSchema?.out_schema_ids;
      schemaId = targetSchemaIds?.length === 1 ? targetSchemaIds[0] : undefined;
      relationSchemaId = undefined;
      return step.direction === 'in' ? '_in' : '_out';
    }
    if (step.kind === 'relationForward') {
      const relationSchema = relationSchemaId ? relationSchemas.get(relationSchemaId) : undefined;
      const field = relationFieldById(relationSchema, step.fieldId);
      schemaId = field && field.type === 'entityRelation' ? field.schemaId : undefined;
      relationSchemaId = undefined;
      const filterText = step.filter
        ? `[${printTextQueryNode(step.filter, schemaId, schemas, relationSchemas)}]`
        : '';
      return `${step.fieldId}${filterText}`;
    }
    if (step.kind === 'relationBackward') {
      const relationName = printSchemaRef(
        relationSchemaNameById(relationSchemas, step.relationSchemaId)
      );
      relationSchemaId = step.relationSchemaId;
      schemaId = undefined;
      const filterText = step.filter
        ? `[${printTextQueryNode(step.filter, undefined, schemas, relationSchemas, step.relationSchemaId)}]`
        : '';
      return `<-${relationName}.${step.fieldId}${filterText}`;
    }
    if (step.kind === 'unboundTypedRelation') {
      const relationName = printSchemaRef(
        relationSchemaNameById(relationSchemas, step.relationSchemaId)
      );
      const relationSchema = relationSchemas.get(step.relationSchemaId);
      const targetSchemaIds =
        step.direction === 'in' ? relationSchema?.out_schema_ids : relationSchema?.in_schema_ids;
      schemaId =
        Array.isArray(targetSchemaIds) && targetSchemaIds.length === 1
          ? targetSchemaIds[0]
          : undefined;
      relationSchemaId = undefined;
      const filterText = step.filter
        ? `[${printTextQueryNode(step.filter, undefined, schemas, relationSchemas, step.relationSchemaId)}]`
        : '';
      return `${step.direction === 'in' ? '->' : '<-'}${relationName}${filterText}`;
    }
    const relationSchema = relationSchemas.get(step.relationSchemaId);
    const targetSchemaIds =
      step.direction === 'in' ? relationSchema?.out_schema_ids : relationSchema?.in_schema_ids;
    schemaId = targetSchemaIds?.length === 1 ? targetSchemaIds[0] : undefined;
    relationSchemaId = undefined;
    const filterText = step.filter
      ? `[${printTextQueryNode(step.filter, undefined, schemas, relationSchemas, step.relationSchemaId)}]`
      : '';
    return `${step.fieldId}${filterText}`;
  });
  return { text: parts.join('.'), endSchemaId: schemaId, endRelationSchemaId: relationSchemaId };
};

const printPredicateOrRelationExists = (
  node: QueryNode,
  schemaId: string | undefined,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  relationSchemaId?: string
): string => {
  if (node.kind === 'relationExists') {
    return printPathSteps(node.path, schemaId, schemas, relationSchemas, relationSchemaId).text;
  }
  if (node.kind !== 'predicate') throw new Error('unreachable');

  if (node.path.length === 0 && node.fieldId === '_schemaId' && node.op === 'equals') {
    return `schema:${printSchemaRef(schemaNameById(schemas, node.value as string))}`;
  }

  const { text: pathText, endSchemaId, endRelationSchemaId } = printPathSteps(
    node.path,
    schemaId,
    schemas,
    relationSchemas,
    relationSchemaId
  );
  const fieldType = endRelationSchemaId
    ? relationFieldTypeAt(node.fieldId, endRelationSchemaId, relationSchemas)
    : fieldTypeAt(node.fieldId, endSchemaId, schemas);
  const fullPath = pathText ? `${pathText}.${node.fieldId}` : node.fieldId;
  if (node.op === 'not_empty') return fullPath;
  return `${fullPath} ${printComparatorAndValue(node.op, node.value, fieldType)}`;
};

const printUnary = (
  node: QueryNode,
  schemaId: string | undefined,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  relationSchemaId?: string
): string => {
  if (node.kind === 'and' || node.kind === 'or') {
    return `(${printTextQueryNode(node, schemaId, schemas, relationSchemas, relationSchemaId)})`;
  }
  return printTextQueryNode(node, schemaId, schemas, relationSchemas, relationSchemaId);
};

export const printTextQueryNode = (
  node: QueryNode,
  schemaId: string | undefined,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  relationSchemaId?: string
): string => {
  switch (node.kind) {
    case 'and':
      return node.children
        .map(c => printUnary(c, schemaId, schemas, relationSchemas, relationSchemaId))
        .join(' AND ');
    case 'or':
      return node.children
        .map(c => printUnary(c, schemaId, schemas, relationSchemas, relationSchemaId))
        .join(' OR ');
    case 'not':
      return `NOT ${printUnary(node.child, schemaId, schemas, relationSchemas, relationSchemaId)}`;
    case 'freeText':
      return `text:${quoteString(node.value)}`;
    case 'predicate':
    case 'relationExists':
      return printPredicateOrRelationExists(
        node,
        schemaId,
        schemas,
        relationSchemas,
        relationSchemaId
      );
  }
};

const deriveRootSchemaIdFromIR = (node: QueryNode): string | undefined => {
  if (node.kind !== 'and') return undefined;
  for (const child of node.children) {
    if (child.kind === 'predicate' && child.path.length === 0 && child.fieldId === '_schemaId') {
      return child.value as string;
    }
  }
  return undefined;
};

export const printEntityQueryText = (
  query: EntityQuery,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog = new Map()
): string =>
  printTextQueryNode(
    query.root,
    deriveRootSchemaIdFromIR(query.root),
    schemas,
    relationSchemas
  );
