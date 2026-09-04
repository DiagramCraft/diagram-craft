import {
  type EntityQuery,
  type FilterOp,
  type PathStep,
  type ProjectionField,
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
import { isNowDateLiteral } from '@arch-register/api-types/nowDateLiteral';
import { relationSchemaNameById, schemaNameById } from './entityQueryTextResolver';
import { collectRootPathOccurrences, entityQueryPathStartsWith } from './entityQueryIRPlan';

// Pre-rendered `columns` capture entries, keyed by the identity of the `PathStep` in `query.root`
// that a projection binds to. Populated per `printEntityQueryText` call, read by `printScope`.
type ColumnEntry = { includePath: boolean; tail: string; alias?: string };
let activeColumnsByStep: WeakMap<PathStep, ColumnEntry[]> | null = null;

export type EntityQueryTextPrintOptions = {
  /** Render nested boolean expressions and scoped filters on multiple indented lines. */
  pretty?: boolean;
  /** Indentation string used for each nesting level in pretty output. */
  indent?: string;
  /** Maximum preferred line length before a flat expression is wrapped. */
  maxLineLength?: number;
};

type NormalizedPrintOptions = {
  pretty: boolean;
  indent: string;
  maxLineLength: number;
};

const COMPACT_PRINT_OPTIONS: NormalizedPrintOptions = {
  pretty: false,
  indent: '  ',
  maxLineLength: 100
};

const normalizePrintOptions = (
  options: EntityQueryTextPrintOptions = {}
): NormalizedPrintOptions => ({
  pretty: options.pretty ?? false,
  indent: options.indent ?? '  ',
  maxLineLength: options.maxLineLength ?? 100
});

const indentAt = (options: NormalizedPrintOptions, level: number): string =>
  options.indent.repeat(Math.max(0, level));

const appendToLastLine = (text: string, suffix: string): string => {
  const lines = text.split('\n');
  lines[lines.length - 1] = `${lines[lines.length - 1]} ${suffix}`;
  return lines.join('\n');
};

const removeFirstLineIndent = (
  text: string,
  options: NormalizedPrintOptions,
  level: number
): string => {
  const prefix = indentAt(options, level);
  return text.startsWith(prefix) ? text.slice(prefix.length) : text;
};

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
  if (fieldType === 'date' && isNowDateLiteral(value)) {
    return value.offsetDays ? `now(${value.offsetDays})` : 'now()';
  }
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

type NodePrinter = (
  node: QueryNode,
  schemaId: string | undefined,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  relationSchemaId: string | undefined,
  options: NormalizedPrintOptions,
  level: number,
  isRoot: boolean
) => string;

const stepName = (
  step: PathStep,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog
): string => {
  switch (step.kind) {
    case 'forward':
    case 'relationForward':
    case 'typedRelation':
      return step.fieldId;
    case 'backward':
      return `<-${printSchemaRef(schemaNameById(schemas, step.ownerSchemaId))}.${step.fieldId}`;
    case 'relationBackward':
      return `<-${printSchemaRef(relationSchemaNameById(relationSchemas, step.relationSchemaId))}.${step.fieldId}`;
    case 'unboundTypedRelation':
      return `${step.direction === 'in' ? '->' : '<-'}${printSchemaRef(
        relationSchemaNameById(relationSchemas, step.relationSchemaId)
      )}`;
    case 'endpoint':
      return step.direction === 'in' ? '_in' : '_out';
  }
};

// Renders a `capture_path` (traversal + optional terminal field) as it appears inside `columns`.
const renderCaptureTail = (
  steps: PathStep[],
  terminalFieldId: string | null,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog
): string => {
  const parts = steps.map(step => stepName(step, schemas, relationSchemas));
  if (terminalFieldId !== null) parts.push(terminalFieldId);
  return parts.join('.');
};

const renderColumnsClause = (entries: ColumnEntry[]): string =>
  `columns ${entries
    .map(
      entry =>
        `${entry.includePath ? 'path ' : ''}${entry.tail}${
          entry.alias !== undefined ? ` as ${quoteString(entry.alias)}` : ''
        }`
    )
    .join(', ')}`;

// Emit a segment's `[...]` scope: its `[filter]` predicate, its `columns` capture clause, or both.
const printScope = (
  step: PathStep,
  schemaId: string | undefined,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  relationSchemaId: string | undefined,
  nodePrinter: NodePrinter,
  options: NormalizedPrintOptions,
  level: number
): string => {
  const columnEntries = step.kind === 'endpoint' ? undefined : activeColumnsByStep?.get(step);
  const columnsText = columnEntries?.length ? renderColumnsClause(columnEntries) : undefined;
  const filter = step.kind === 'endpoint' ? undefined : step.filter;
  if (!filter && !columnsText) return '';
  if (!filter) return `[${columnsText}]`;

  const filterText = nodePrinter(
    filter,
    schemaId,
    schemas,
    relationSchemas,
    relationSchemaId,
    options,
    level,
    false
  );
  if (!options.pretty || !filterText.includes('\n')) {
    const inline = options.pretty ? removeFirstLineIndent(filterText, options, level) : filterText;
    return `[${inline}${columnsText ? ` ${columnsText}` : ''}]`;
  }
  return `[
${filterText}${columnsText ? `\n${indentAt(options, level)}${columnsText}` : ''}
${indentAt(options, level)}]`;
};

const printPathSteps = (
  steps: PathStep[],
  startSchemaId: string | undefined,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  startRelationSchemaId: string | undefined,
  nodePrinter: NodePrinter,
  options: NormalizedPrintOptions,
  level: number
): PrintedPath => {
  let schemaId = startSchemaId;
  let relationSchemaId = startRelationSchemaId;
  const parts = steps.map(step => {
    if (step.kind === 'forward') {
      const field = schemaFieldById(schemas.get(schemaId ?? ''), step.fieldId);
      if (field && isReferenceOrContainmentField(field)) schemaId = field.schemaId;
      relationSchemaId = undefined;
      const filterText = printScope(
        step,
        schemaId,
        schemas,
        relationSchemas,
        undefined,
        nodePrinter,
        options,
        level
      );
      return `${step.fieldId}${filterText}`;
    }
    if (step.kind === 'backward') {
      const ownerName = printSchemaRef(schemaNameById(schemas, step.ownerSchemaId));
      schemaId = step.ownerSchemaId;
      relationSchemaId = undefined;
      const filterText = printScope(
        step,
        schemaId,
        schemas,
        relationSchemas,
        undefined,
        nodePrinter,
        options,
        level
      );
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
      const filterText = printScope(
        step,
        schemaId,
        schemas,
        relationSchemas,
        undefined,
        nodePrinter,
        options,
        level
      );
      return `${step.fieldId}${filterText}`;
    }
    if (step.kind === 'relationBackward') {
      const relationName = printSchemaRef(
        relationSchemaNameById(relationSchemas, step.relationSchemaId)
      );
      relationSchemaId = step.relationSchemaId;
      schemaId = undefined;
      const filterText = printScope(
        step,
        undefined,
        schemas,
        relationSchemas,
        step.relationSchemaId,
        nodePrinter,
        options,
        level
      );
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
      const filterText = printScope(
        step,
        undefined,
        schemas,
        relationSchemas,
        step.relationSchemaId,
        nodePrinter,
        options,
        level
      );
      return `${step.direction === 'in' ? '->' : '<-'}${relationName}${filterText}`;
    }
    const relationSchema = relationSchemas.get(step.relationSchemaId);
    const targetSchemaIds =
      step.direction === 'in' ? relationSchema?.out_schema_ids : relationSchema?.in_schema_ids;
    schemaId = targetSchemaIds?.length === 1 ? targetSchemaIds[0] : undefined;
    relationSchemaId = undefined;
    const filterText = printScope(
      step,
      undefined,
      schemas,
      relationSchemas,
      step.relationSchemaId,
      nodePrinter,
      options,
      level
    );
    return `${step.fieldId}${filterText}`;
  });
  return { text: parts.join('.'), endSchemaId: schemaId, endRelationSchemaId: relationSchemaId };
};

const printPredicateOrRelationExists = (
  node: QueryNode,
  schemaId: string | undefined,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  relationSchemaId: string | undefined,
  nodePrinter: NodePrinter,
  options: NormalizedPrintOptions,
  level: number
): string => {
  if (node.kind === 'relationExists') {
    return printPathSteps(
      node.path,
      schemaId,
      schemas,
      relationSchemas,
      relationSchemaId,
      nodePrinter,
      options,
      level
    ).text;
  }
  if (node.kind !== 'predicate') throw new Error('unreachable');

  if (node.path.length === 0 && node.fieldId === '_schemaId' && node.op === 'equals') {
    // A path-less `_schemaId` predicate names whatever schema kind the *current* row is — an
    // entity schema normally, but a relation schema for a relation-rooted query's own root-level
    // type filter (or, mid-query, a relation row reached via a relationBackward/typedRelation
    // step — `relationSchemaId` is already threaded through for that case). Printing this via the
    // entity-only `schemaNameById` for a relation id previously fell through to the raw UUID.
    return relationSchemaId
      ? `schema:${printSchemaRef(relationSchemaNameById(relationSchemas, node.value as string))}`
      : `schema:${printSchemaRef(schemaNameById(schemas, node.value as string))}`;
  }

  const {
    text: pathText,
    endSchemaId,
    endRelationSchemaId
  } = printPathSteps(
    node.path,
    schemaId,
    schemas,
    relationSchemas,
    relationSchemaId,
    nodePrinter,
    options,
    level
  );
  const fieldType = endRelationSchemaId
    ? relationFieldTypeAt(node.fieldId, endRelationSchemaId, relationSchemas)
    : fieldTypeAt(node.fieldId, endSchemaId, schemas);
  const fullPath = pathText ? `${pathText}.${node.fieldId}` : node.fieldId;
  if (node.op === 'not_empty') return fullPath;
  return `${fullPath} ${printComparatorAndValue(node.op, node.value, fieldType)}`;
};

const printCompactNode: NodePrinter = (
  node,
  schemaId,
  schemas,
  relationSchemas,
  relationSchemaId,
  options,
  level
) => {
  switch (node.kind) {
    case 'and':
      return node.children
        .map(c =>
          printCompactUnary(c, schemaId, schemas, relationSchemas, relationSchemaId, options)
        )
        .join(' AND ');
    case 'or':
      return node.children
        .map(c =>
          printCompactUnary(c, schemaId, schemas, relationSchemas, relationSchemaId, options)
        )
        .join(' OR ');
    case 'not':
      return `NOT ${printCompactUnary(
        node.child,
        schemaId,
        schemas,
        relationSchemas,
        relationSchemaId,
        options
      )}`;
    case 'freeText':
      return `text:${quoteString(node.value)}`;
    case 'predicate':
    case 'relationExists':
      return printPredicateOrRelationExists(
        node,
        schemaId,
        schemas,
        relationSchemas,
        relationSchemaId,
        printCompactNode,
        options,
        level
      );
  }
};

const printCompactUnary = (
  node: QueryNode,
  schemaId: string | undefined,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  relationSchemaId: string | undefined,
  options: NormalizedPrintOptions
): string => {
  if (node.kind === 'and' || node.kind === 'or') {
    return `(${printCompactNode(
      node,
      schemaId,
      schemas,
      relationSchemas,
      relationSchemaId,
      options,
      0,
      false
    )})`;
  }
  return printCompactNode(
    node,
    schemaId,
    schemas,
    relationSchemas,
    relationSchemaId,
    options,
    0,
    false
  );
};

export const printTextQueryNode = (
  node: QueryNode,
  schemaId: string | undefined,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  relationSchemaId?: string
): string =>
  printCompactNode(
    node,
    schemaId,
    schemas,
    relationSchemas,
    relationSchemaId,
    COMPACT_PRINT_OPTIONS,
    0,
    true
  );

const isRootSchemaPredicate = (
  node: QueryNode
): node is Extract<QueryNode, { kind: 'predicate' }> =>
  node.kind === 'predicate' && node.path.length === 0 && node.fieldId === '_schemaId';

const deriveRootSchemaIdFromIR = (node: QueryNode): string | undefined => {
  if (isRootSchemaPredicate(node)) return node.value as string;
  if (node.kind !== 'and') return undefined;
  for (const child of node.children) {
    if (isRootSchemaPredicate(child)) return child.value as string;
  }
  return undefined;
};

const shouldPrettyBreak = (
  node: QueryNode,
  schemaId: string | undefined,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  relationSchemaId: string | undefined,
  options: NormalizedPrintOptions,
  isRoot: boolean,
  inScopedFilter: boolean
): boolean => {
  const compact = printCompactNode(
    node,
    schemaId,
    schemas,
    relationSchemas,
    relationSchemaId,
    COMPACT_PRINT_OPTIONS,
    0,
    isRoot
  );
  if (compact.length > options.maxLineLength) return true;

  switch (node.kind) {
    case 'and':
    case 'or':
      if (node.children.length > 1 && (inScopedFilter || node.kind === 'or' || !isRoot)) {
        return true;
      }
      return node.children.some(child =>
        shouldPrettyBreak(
          child,
          schemaId,
          schemas,
          relationSchemas,
          relationSchemaId,
          options,
          false,
          inScopedFilter
        )
      );
    case 'not':
      return shouldPrettyBreak(
        node.child,
        schemaId,
        schemas,
        relationSchemas,
        relationSchemaId,
        options,
        false,
        inScopedFilter
      );
    case 'freeText':
      return false;
    case 'predicate':
    case 'relationExists':
      return node.path.some(step => {
        if (!('filter' in step) || !step.filter) return false;
        return shouldPrettyBreak(
          step.filter,
          schemaId,
          schemas,
          relationSchemas,
          'relationSchemaId' in step ? step.relationSchemaId : undefined,
          options,
          false,
          true
        );
      });
  }
};

const printPrettyUnary = (
  node: QueryNode,
  schemaId: string | undefined,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  relationSchemaId: string | undefined,
  options: NormalizedPrintOptions,
  level: number
): string => {
  if (node.kind !== 'and' && node.kind !== 'or') {
    return printPrettyNode(
      node,
      schemaId,
      schemas,
      relationSchemas,
      relationSchemaId,
      options,
      level,
      false
    );
  }

  const inner = printPrettyNode(
    node,
    schemaId,
    schemas,
    relationSchemas,
    relationSchemaId,
    options,
    level,
    false
  );
  if (!inner.includes('\n')) {
    return `(${removeFirstLineIndent(inner, options, level)})`;
  }
  return `(
${inner}
${indentAt(options, level)})`;
};

const printPrettyNode: NodePrinter = (
  node,
  schemaId,
  schemas,
  relationSchemas,
  relationSchemaId,
  options,
  level,
  isRoot
) => {
  if (
    !shouldPrettyBreak(
      node,
      schemaId,
      schemas,
      relationSchemas,
      relationSchemaId,
      options,
      isRoot,
      false
    )
  ) {
    return `${indentAt(options, level)}${printCompactNode(
      node,
      schemaId,
      schemas,
      relationSchemas,
      relationSchemaId,
      COMPACT_PRINT_OPTIONS,
      0,
      isRoot
    )}`;
  }

  switch (node.kind) {
    case 'and':
    case 'or': {
      const operator = node.kind === 'and' ? 'AND' : 'OR';
      const childLevel = isRoot ? level : level + 1;
      return node.children
        .map((child, index) => {
          const childText = printPrettyUnary(
            child,
            schemaId,
            schemas,
            relationSchemas,
            relationSchemaId,
            options,
            childLevel
          );
          const withOperator =
            index < node.children.length - 1 ? appendToLastLine(childText, operator) : childText;
          return withOperator;
        })
        .join('\n');
    }
    case 'not': {
      const childText = printPrettyUnary(
        node.child,
        schemaId,
        schemas,
        relationSchemas,
        relationSchemaId,
        options,
        level
      );
      return `${indentAt(options, level)}NOT ${removeFirstLineIndent(childText, options, level)}`;
    }
    case 'freeText':
      return `${indentAt(options, level)}text:${quoteString(node.value)}`;
    case 'predicate':
    case 'relationExists':
      return printPredicateOrRelationExists(
        node,
        schemaId,
        schemas,
        relationSchemas,
        relationSchemaId,
        printPrettyNode,
        options,
        level
      ).replace(/^/, indentAt(options, level));
  }
};

export const printEntityQueryText = (
  query: EntityQuery,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog = new Map(),
  options: EntityQueryTextPrintOptions = {}
): string => {
  const rootId = deriveRootSchemaIdFromIR(query.root);
  const printOptions = normalizePrintOptions(options);
  // `root_kind` (independent of any `_schemaId` predicate that may also appear in `root` — see
  // entityQueryIR.ts's own doc comment) says whether the current row is an entity or a relation;
  // seed the correct side so nested field-type lookups and the `_schemaId` print branch above
  // resolve against the right schema catalog from the very first step.
  const schemaId = query.root_kind === 'relation' ? undefined : rootId;
  const relationSchemaId = query.root_kind === 'relation' ? rootId : undefined;

  const { byStep, synthesized } = planProjectionColumns(query, schemas, relationSchemas);
  activeColumnsByStep = byStep;
  try {
    const rootText = printOptions.pretty
      ? printPrettyNode(
          query.root,
          schemaId,
          schemas,
          relationSchemas,
          relationSchemaId,
          printOptions,
          0,
          true
        )
      : printCompactNode(
          query.root,
          schemaId,
          schemas,
          relationSchemas,
          relationSchemaId,
          COMPACT_PRINT_OPTIONS,
          0,
          true
        );
    if (synthesized.length === 0) return rootText;
    const extra = synthesized.join(printOptions.pretty ? '\nAND ' : ' AND ');
    return rootText ? `${rootText}${printOptions.pretty ? '\nAND ' : ' AND '}${extra}` : extra;
  } finally {
    activeColumnsByStep = null;
  }
};

// Decide, for each `ProjectionField`, which `[...]` scope in `query.root` carries its `columns`
// entry (bound by a longest-prefix match on the resolved path, filters included). A projection
// whose path has no matching scope becomes a standalone capture-only bracket; one that cannot be
// represented at all (e.g. a path-less projection) is omitted — the query UI carries it out of band.
const planProjectionColumns = (
  query: EntityQuery,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog
): { byStep: WeakMap<PathStep, ColumnEntry[]>; synthesized: string[] } => {
  const byStep = new WeakMap<PathStep, ColumnEntry[]>();
  const synthesized: string[] = [];
  const projections = query.projections ?? [];
  if (projections.length === 0) return { byStep, synthesized };

  const occurrences: PathStep[][] = [];
  collectRootPathOccurrences(query.root, occurrences);

  for (const projection of projections) {
    const anchor = pickAnchorOccurrence(occurrences, projection);
    if (anchor && anchor.length > 0) {
      const tailSteps = projection.path.slice(anchor.length);
      const entry: ColumnEntry = {
        includePath: projection.includePath === true,
        tail: renderCaptureTail(
          tailSteps,
          projection.includePath ? null : projection.fieldId,
          schemas,
          relationSchemas
        ),
        ...(projection.alias !== undefined ? { alias: projection.alias } : {})
      };
      const step = anchor[anchor.length - 1]!;
      const list = byStep.get(step) ?? [];
      list.push(entry);
      byStep.set(step, list);
    } else if (projection.path.length > 0 && !projection.includePath) {
      const pathText = projection.path
        .map(step => stepName(step, schemas, relationSchemas))
        .join('.');
      const alias = projection.alias !== undefined ? ` as ${quoteString(projection.alias)}` : '';
      synthesized.push(`${pathText}[columns ${projection.fieldId}${alias}]`);
    }
  }
  return { byStep, synthesized };
};

const pickAnchorOccurrence = (
  occurrences: PathStep[][],
  projection: ProjectionField
): PathStep[] | undefined => {
  let best: PathStep[] | undefined;
  for (const occurrence of occurrences) {
    if (
      occurrence.length <= projection.path.length &&
      entityQueryPathStartsWith(projection.path, occurrence) &&
      (!best || occurrence.length > best.length)
    ) {
      best = occurrence;
    }
  }
  return best;
};
