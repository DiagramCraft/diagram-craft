import {
  MAX_PATH_HOPS,
  type EntityQuery,
  type FilterOp,
  type PathStep,
  type ProjectionField,
  type QueryNode
} from '@arch-register/api-types/entityQueryIR';
import {
  isReferenceOrContainmentField,
  type SchemaField,
  type TypedRelationField
} from '@arch-register/api-types/schemaContract';
import type {
  EntityRelationField,
  RelationField
} from '@arch-register/api-types/relationSchemaContract';
import { ASSESSMENT_FIELD_PREFIX } from '@arch-register/api-types/assessmentFilter';
import {
  relationFieldById,
  schemaFieldById,
  type RelationSchemaCatalog,
  type SchemaCatalog
} from './entityQueryIRResolution';
import { isFieldViewRestricted } from '../auth/fieldGroupAccessControl';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import {
  TextCompileError,
  type EnumCatalog,
  type ResolvedComparator,
  type TextCapture,
  type TextPathStep,
  type TextQueryNode,
  type TextQuerySyntax,
  type TextResolverContext,
  type TextValue
} from './entityQueryTextTypes';

export type { TextResolverContext } from './entityQueryTextTypes';

const PSEUDO_FIELD_IDS = new Set([
  '_id',
  '_schemaId',
  '_lifecycle',
  '_owner',
  '_name',
  '_slug',
  '_description',
  '_namespace',
  '_completeness',
  '_updatedAt',
  '_tags',
  '_conformanceStatus',
  '_conformanceEvaluatedAt',
  '_conformanceStale',
  '_assessment'
]);

const isPseudoFieldId = (fieldId: string): boolean =>
  PSEUDO_FIELD_IDS.has(fieldId) || fieldId.startsWith(ASSESSMENT_FIELD_PREFIX);

const schemaNameMap = (schemas: SchemaCatalog): Map<string, string> => {
  const byName = new Map<string, string>();
  for (const schema of schemas.values()) byName.set(schema.name, schema.id);
  return byName;
};

export const schemaNameById = (schemas: SchemaCatalog, schemaId: string): string =>
  schemas.get(schemaId)?.name ?? schemaId;

const relationSchemaNameMap = (relationSchemas: RelationSchemaCatalog): Map<string, string> => {
  const byName = new Map<string, string>();
  for (const schema of relationSchemas.values()) byName.set(schema.name, schema.id);
  return byName;
};

export const relationSchemaNameById = (
  relationSchemas: RelationSchemaCatalog,
  relationSchemaId: string
): string => relationSchemas.get(relationSchemaId)?.name ?? relationSchemaId;

export const resolveRelationSchemaRef = (
  relationSchemas: RelationSchemaCatalog,
  ref: string,
  offset: number
): string => {
  if (relationSchemas.has(ref)) return ref;
  const id = relationSchemaNameMap(relationSchemas).get(ref);
  if (!id) throw new TextCompileError(`Unknown relation schema '${ref}'`, offset);
  return id;
};

type FieldResolution =
  | { kind: 'pseudo' }
  | { kind: 'scalar'; field: SchemaField }
  | { kind: 'relation'; field: Extract<SchemaField, { type: 'reference' | 'containment' }> }
  | {
      kind: 'typedRelation';
      field: TypedRelationField;
      relationSchemaId: string;
      ownerSchemaIds: string[];
    }
  | { kind: 'unboundTypedRelation'; relationSchemaId: string; direction: 'in' | 'out' }
  | { kind: 'relationScalar'; field: RelationField; relationSchemaId: string }
  | { kind: 'relationEntityRelation'; field: EntityRelationField; relationSchemaId: string }
  | { kind: 'endpointPseudo'; direction: 'in' | 'out' };

const resolveField = (
  fieldId: string,
  currentSchemaId: string | undefined,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  offset: number,
  authCtx: WorkspaceAuthorizationContext | null
): FieldResolution => {
  if (isPseudoFieldId(fieldId)) return { kind: 'pseudo' };

  const candidateSchemas = (
    currentSchemaId
      ? [schemas.get(currentSchemaId)].filter((s): s is NonNullable<typeof s> => s != null)
      : [...schemas.values()]
  ).filter(schema => !isFieldViewRestricted(authCtx, schema, fieldId));

  const matches = candidateSchemas
    .map(schema => schemaFieldById(schema, fieldId))
    .filter((f): f is SchemaField => f != null);

  if (matches.length === 0) {
    throw new TextCompileError(
      currentSchemaId
        ? `Schema '${schemaNameById(schemas, currentSchemaId)}' does not define field '${fieldId}'`
        : `Unknown field '${fieldId}'`,
      offset
    );
  }

  const relationMatches = matches.filter(isReferenceOrContainmentField);
  const typedRelationMatches = matches.filter(
    (field): field is TypedRelationField => field.type === 'typedRelation'
  );
  if (typedRelationMatches.length > 0) {
    if (typedRelationMatches.length !== matches.length) {
      throw new TextCompileError(
        `Field '${fieldId}' is a typed relation on some schemas and a scalar on others — use 'schema:' to disambiguate`,
        offset
      );
    }
    const bindings = new Set(
      typedRelationMatches.map(field => `${field.relationSchemaId}:${field.direction}`)
    );
    if (bindings.size > 1) {
      throw new TextCompileError(
        `Field '${fieldId}' binds different typed relations depending on the owning schema — use 'schema:' to disambiguate`,
        offset
      );
    }
    const field = typedRelationMatches[0]!;
    if (!relationSchemas.has(field.relationSchemaId)) {
      throw new TextCompileError(
        `Unknown relation schema '${field.relationSchemaId}' for field '${fieldId}'`,
        offset
      );
    }
    const ownerSchemaIds = candidateSchemas
      .filter(schema => {
        const candidate = schemaFieldById(schema, fieldId);
        return (
          candidate?.type === 'typedRelation' &&
          candidate.relationSchemaId === field.relationSchemaId &&
          candidate.direction === field.direction
        );
      })
      .map(schema => schema.id);
    return {
      kind: 'typedRelation',
      field,
      relationSchemaId: field.relationSchemaId,
      ownerSchemaIds
    };
  }
  if (relationMatches.length > 0) {
    if (relationMatches.length !== matches.length) {
      throw new TextCompileError(
        `Field '${fieldId}' is a relation on some schemas and a scalar on others — use 'schema:' to disambiguate`,
        offset
      );
    }
    const targets = new Set(relationMatches.map(f => f.schemaId));
    if (targets.size > 1) {
      throw new TextCompileError(
        `Field '${fieldId}' targets different schemas depending on the owning schema — use 'schema:' to disambiguate`,
        offset
      );
    }
    return { kind: 'relation', field: relationMatches[0]! };
  }

  const types = new Set(matches.map(f => f.type));
  if (types.size > 1) {
    throw new TextCompileError(
      `Field '${fieldId}' has different types across schemas — use 'schema:' to disambiguate`,
      offset
    );
  }
  return { kind: 'scalar', field: matches[0]! };
};

const resolveRelationField = (
  fieldId: string,
  relationSchemaId: string,
  relationSchemas: RelationSchemaCatalog,
  offset: number,
  authCtx: WorkspaceAuthorizationContext | null
): FieldResolution => {
  const relationSchema = relationSchemas.get(relationSchemaId);
  const field = relationFieldById(relationSchema, fieldId);
  if (!relationSchema) {
    throw new TextCompileError(`Unknown relation schema '${relationSchemaId}'`, offset);
  }
  if (!field || isFieldViewRestricted(authCtx, relationSchema, fieldId)) {
    throw new TextCompileError(
      `Relation schema '${relationSchemaNameById(relationSchemas, relationSchemaId)}' does not define a viewable field '${fieldId}'`,
      offset
    );
  }
  if (field.type === 'entityRelation') {
    return { kind: 'relationEntityRelation', field, relationSchemaId };
  }
  return { kind: 'relationScalar', field, relationSchemaId };
};

type BackwardResolution =
  | { kind: 'backward'; ownerSchemaId: string }
  | { kind: 'relationBackward'; relationSchemaId: string; field: EntityRelationField };

const resolveBackwardStep = (
  fieldId: string,
  explicitSchemaRef: string | undefined,
  currentSchemaId: string | undefined,
  schemas: SchemaCatalog,
  relationSchemas: RelationSchemaCatalog,
  offset: number,
  authCtx: WorkspaceAuthorizationContext | null
): BackwardResolution => {
  if (explicitSchemaRef) {
    const entitySchemaId = schemaNameMap(schemas).get(explicitSchemaRef);
    const relationSchemaId = relationSchemaNameMap(relationSchemas).get(explicitSchemaRef);
    if (entitySchemaId && relationSchemaId) {
      throw new TextCompileError(
        `'${explicitSchemaRef}' names both an entity schema and a relation schema — rename one to disambiguate`,
        offset
      );
    }
    if (relationSchemaId) {
      const relationSchema = relationSchemas.get(relationSchemaId)!;
      const field = relationFieldById(relationSchema, fieldId);
      if (
        field?.type !== 'entityRelation' ||
        isFieldViewRestricted(authCtx, relationSchema, fieldId)
      ) {
        throw new TextCompileError(
          `Relation schema '${explicitSchemaRef}' does not define a viewable entityRelation field '${fieldId}'`,
          offset
        );
      }
      if (currentSchemaId && field.schemaId !== currentSchemaId) {
        throw new TextCompileError(
          `'<-${explicitSchemaRef}.${fieldId}' does not point at '${schemaNameById(schemas, currentSchemaId)}'`,
          offset
        );
      }
      return { kind: 'relationBackward', relationSchemaId, field };
    }
    if (!entitySchemaId) {
      throw new TextCompileError(`Unknown schema '${explicitSchemaRef}'`, offset);
    }
    const owner = schemas.get(entitySchemaId)!;
    const field = schemaFieldById(owner, fieldId);
    if (
      !field ||
      !isReferenceOrContainmentField(field) ||
      isFieldViewRestricted(authCtx, owner, fieldId)
    ) {
      throw new TextCompileError(
        `Schema '${explicitSchemaRef}' does not define a reference/containment field '${fieldId}'`,
        offset
      );
    }
    if (currentSchemaId && field.schemaId !== currentSchemaId) {
      throw new TextCompileError(
        `'<-${explicitSchemaRef}.${fieldId}' does not point at '${schemaNameById(schemas, currentSchemaId)}'`,
        offset
      );
    }
    return { kind: 'backward', ownerSchemaId: entitySchemaId };
  }

  const entityCandidates = [...schemas.values()].filter(schema => {
    const field = schemaFieldById(schema, fieldId);
    if (!field || !isReferenceOrContainmentField(field)) return false;
    if (isFieldViewRestricted(authCtx, schema, fieldId)) return false;
    return currentSchemaId ? field.schemaId === currentSchemaId : true;
  });
  const relationCandidates = [...relationSchemas.values()].filter(schema => {
    const field = relationFieldById(schema, fieldId);
    if (field?.type !== 'entityRelation') return false;
    if (isFieldViewRestricted(authCtx, schema, fieldId)) return false;
    return currentSchemaId ? field.schemaId === currentSchemaId : true;
  });

  if (entityCandidates.length + relationCandidates.length === 0) {
    throw new TextCompileError(
      `No schema defines a reference/containment or entityRelation field '${fieldId}'`,
      offset
    );
  }
  if (entityCandidates.length + relationCandidates.length > 1) {
    const names = [...entityCandidates, ...relationCandidates].map(s => s.name).join(', ');
    throw new TextCompileError(
      `'<-${fieldId}' is ambiguous between: ${names} — disambiguate with '<-Schema.${fieldId}'`,
      offset
    );
  }
  if (entityCandidates.length === 1) {
    return { kind: 'backward', ownerSchemaId: entityCandidates[0]!.id };
  }
  const relationSchema = relationCandidates[0]!;
  const field = relationFieldById(relationSchema, fieldId) as EntityRelationField;
  return { kind: 'relationBackward', relationSchemaId: relationSchema.id, field };
};

const resolveOpAndValue = (
  comparatorToken: string,
  parsed: TextValue,
  resolution: FieldResolution,
  enums: EnumCatalog,
  offset: number
): ResolvedComparator => {
  if (parsed.kind === 'empty' || parsed.kind === 'notEmpty') {
    if (comparatorToken !== ':' && comparatorToken !== '=') {
      throw new TextCompileError(
        `Comparator '${comparatorToken}' cannot be combined with '${parsed.kind === 'empty' ? 'empty' : 'not_empty'}'`,
        offset
      );
    }
    return { op: parsed.kind === 'empty' ? 'empty' : 'not_empty', value: null };
  }

  const isScalarLike = resolution.kind === 'scalar' || resolution.kind === 'relationScalar';
  const isSelectField = isScalarLike && resolution.field.type === 'select';
  const isDateField = isScalarLike && resolution.field.type === 'date';
  const isCurrencyField = isScalarLike && resolution.field.type === 'currency';

  if ((parsed.kind === 'enumValue' || parsed.kind === 'enumLabel') && !isSelectField) {
    throw new TextCompileError(
      `'${parsed.kind}(...)' is only valid against a select field`,
      offset
    );
  }
  if (parsed.kind === 'now' && !isDateField) {
    throw new TextCompileError(`'now(...)' is only valid against a date field`, offset);
  }

  let value: unknown;
  if (parsed.kind === 'date') {
    value = parsed.value;
  } else if (parsed.kind === 'now') {
    value = { $now: true, ...(parsed.offsetDays ? { offsetDays: parsed.offsetDays } : {}) };
  } else if (parsed.kind === 'enumValue') {
    value = parsed.value;
  } else if (parsed.kind === 'enumLabel') {
    const enumDef = enums.get(
      (resolution as { field: Extract<SchemaField | RelationField, { type: 'select' }> }).field
        .enumId
    );
    const option = enumDef?.options.find(o => o.label === parsed.value);
    if (!option) {
      throw new TextCompileError(`Unrecognized enum label '${parsed.value}'`, offset);
    }
    value = option.value;
  } else {
    value = parsed.value;
  }

  if (isSelectField && ['<', '>', '<=', '>='].includes(comparatorToken)) {
    throw new TextCompileError(
      `Comparator '${comparatorToken}' has no meaning against a select field`,
      offset
    );
  }

  if (
    isCurrencyField &&
    (parsed.kind === 'date' || parsed.kind === 'enumValue' || parsed.kind === 'enumLabel')
  ) {
    throw new TextCompileError(`Currency fields only support numeric amount comparisons`, offset);
  }

  let op: FilterOp;
  switch (comparatorToken) {
    case ':':
    case '=':
      op = isDateField ? 'on' : 'equals';
      break;
    case '!=':
      op = 'not_equals';
      break;
    case '~':
      op = 'contains';
      break;
    case '^=':
      op = 'starts_with';
      break;
    case '$=':
      op = 'ends_with';
      break;
    case '>':
      op = isDateField ? 'after' : 'gt';
      break;
    case '>=':
      op = 'gte';
      break;
    case '<':
      op = isDateField ? 'before' : 'lt';
      break;
    case '<=':
      op = 'lte';
      break;
    default:
      throw new TextCompileError(`Unknown comparator '${comparatorToken}'`, offset);
  }
  return { op, value };
};

type ResolvedStep = {
  step: PathStep;
  fieldId: string;
  resolution: FieldResolution;
  nextSchemaId: string | undefined;
  nextRelationSchemaId: string | undefined;
};

type ResolutionState = TextResolverContext & {
  hopsUsed: number;
  // Projections accumulated from `columns` sub-clauses across every `[...]` scope in the query,
  // in source order; attached to `EntityQuery.projections` once at the end of resolution.
  projections: ProjectionField[];
};

const relationTargetSchemaId = (
  relationSchemas: RelationSchemaCatalog,
  relationSchemaId: string,
  direction: 'in' | 'out'
): string | undefined => {
  const relationSchema = relationSchemas.get(relationSchemaId);
  const targetSchemaIds =
    direction === 'in' ? relationSchema?.out_schema_ids : relationSchema?.in_schema_ids;
  return targetSchemaIds?.length === 1 ? targetSchemaIds[0] : undefined;
};

const incrementHop = (state: ResolutionState, offset: number): void => {
  state.hopsUsed += 1;
  if (state.hopsUsed > MAX_PATH_HOPS) {
    throw new TextCompileError(`Path exceeds MAX_PATH_HOPS (${MAX_PATH_HOPS})`, offset);
  }
};

function resolveStep(
  syntaxStep: TextPathStep,
  currentSchemaId: string | undefined,
  currentRelationSchemaId: string | undefined,
  state: ResolutionState,
  // Absolute path prefix of already-resolved steps leading to this one, used to give any nested
  // `columns` captures the correct witness-binding path (empty except inside a scoped filter).
  pathPrefix: PathStep[] = []
): ResolvedStep {
  const { schemas, relationSchemas, authCtx } = state;
  if (currentRelationSchemaId) {
    const fieldId =
      syntaxStep.kind === 'typedRelation' ? syntaxStep.relationRef.value : syntaxStep.field.value;
    if (syntaxStep.kind === 'typedRelation') {
      throw new TextCompileError(
        `Relation schema '${relationSchemaNameById(relationSchemas, currentRelationSchemaId)}' does not define a viewable field '${fieldId}'`,
        syntaxStep.offset
      );
    }
    if (fieldId === '_in' || fieldId === '_out') {
      const direction = fieldId === '_in' ? 'in' : 'out';
      const relationSchema = relationSchemas.get(currentRelationSchemaId);
      const targetSchemaIds =
        direction === 'in' ? relationSchema?.in_schema_ids : relationSchema?.out_schema_ids;
      return {
        step: { kind: 'endpoint', direction },
        fieldId,
        resolution: { kind: 'endpointPseudo', direction },
        nextSchemaId: targetSchemaIds?.length === 1 ? targetSchemaIds[0] : undefined,
        nextRelationSchemaId: undefined
      };
    }
    const resolution = resolveRelationField(
      fieldId,
      currentRelationSchemaId,
      relationSchemas,
      syntaxStep.offset,
      authCtx
    );
    if (resolution.kind === 'relationEntityRelation') {
      return {
        step: { kind: 'relationForward', fieldId },
        fieldId,
        resolution,
        nextSchemaId: resolution.field.schemaId,
        nextRelationSchemaId: undefined
      };
    }
    return {
      step: { kind: 'forward', fieldId },
      fieldId,
      resolution,
      nextSchemaId: undefined,
      nextRelationSchemaId: undefined
    };
  }

  if (syntaxStep.kind === 'typedRelation') {
    const relationSchemaId = resolveRelationSchemaRef(
      relationSchemas,
      syntaxStep.relationRef.value,
      syntaxStep.relationRef.offset
    );
    incrementHop(state, syntaxStep.offset);
    const filter = syntaxStep.filter
      ? resolveNode(syntaxStep.filter, undefined, relationSchemaId, state, false, pathPrefix)
      : undefined;
    return {
      step: {
        kind: 'unboundTypedRelation',
        relationSchemaId,
        direction: syntaxStep.direction,
        ...(filter ? { filter } : {})
      },
      fieldId: `${syntaxStep.direction === 'in' ? '->' : '<-'}${syntaxStep.relationRef.value}`,
      resolution: {
        kind: 'unboundTypedRelation',
        relationSchemaId,
        direction: syntaxStep.direction
      },
      nextSchemaId: relationTargetSchemaId(relationSchemas, relationSchemaId, syntaxStep.direction),
      nextRelationSchemaId: undefined
    };
  }

  incrementHop(state, syntaxStep.offset);
  if (syntaxStep.kind === 'backward') {
    const backwardResolution = resolveBackwardStep(
      syntaxStep.field.value,
      syntaxStep.schemaRef?.value,
      currentSchemaId,
      schemas,
      relationSchemas,
      syntaxStep.offset,
      authCtx
    );
    if (backwardResolution.kind === 'relationBackward') {
      const { relationSchemaId } = backwardResolution;
      const filter = syntaxStep.filter
        ? resolveNode(syntaxStep.filter, undefined, relationSchemaId, state, false, pathPrefix)
        : undefined;
      return {
        step: {
          kind: 'relationBackward',
          fieldId: syntaxStep.field.value,
          relationSchemaId,
          ...(filter ? { filter } : {})
        },
        fieldId: syntaxStep.field.value,
        resolution: {
          kind: 'relationEntityRelation',
          field: backwardResolution.field,
          relationSchemaId
        },
        nextSchemaId: undefined,
        nextRelationSchemaId: relationSchemaId
      };
    }
    const { ownerSchemaId } = backwardResolution;
    const filter = syntaxStep.filter
      ? resolveNode(syntaxStep.filter, ownerSchemaId, undefined, state, false, pathPrefix)
      : undefined;
    return {
      step: {
        kind: 'backward',
        fieldId: syntaxStep.field.value,
        ownerSchemaId,
        ...(filter ? { filter } : {})
      },
      fieldId: syntaxStep.field.value,
      resolution: {
        kind: 'relation',
        field: schemaFieldById(schemas.get(ownerSchemaId), syntaxStep.field.value) as Extract<
          SchemaField,
          { type: 'reference' | 'containment' }
        >
      },
      nextSchemaId: ownerSchemaId,
      nextRelationSchemaId: undefined
    };
  }

  const resolution = resolveField(
    syntaxStep.field.value,
    currentSchemaId,
    schemas,
    relationSchemas,
    syntaxStep.field.offset,
    authCtx
  );
  const nextSchemaId =
    resolution.kind === 'relation'
      ? resolution.field.schemaId
      : resolution.kind === 'typedRelation'
        ? relationTargetSchemaId(
            relationSchemas,
            resolution.relationSchemaId,
            resolution.field.direction
          )
        : currentSchemaId;

  let filter: QueryNode | undefined;
  if (syntaxStep.filter) {
    if (resolution.kind !== 'relation' && resolution.kind !== 'typedRelation') {
      throw new TextCompileError(
        `'[...]' can only scope a relation field, not '${syntaxStep.field.value}'`,
        syntaxStep.field.offset
      );
    }
    filter =
      resolution.kind === 'typedRelation'
        ? resolveNode(
            syntaxStep.filter,
            undefined,
            resolution.relationSchemaId,
            state,
            false,
            pathPrefix
          )
        : resolveNode(syntaxStep.filter, nextSchemaId, undefined, state, false, pathPrefix);
  }

  return {
    step:
      resolution.kind === 'typedRelation'
        ? {
            kind: 'typedRelation',
            fieldId: syntaxStep.field.value,
            relationSchemaId: resolution.relationSchemaId,
            direction: resolution.field.direction,
            ownerSchemaIds: resolution.ownerSchemaIds,
            ...(filter ? { filter } : {})
          }
        : { kind: 'forward', fieldId: syntaxStep.field.value, ...(filter ? { filter } : {}) },
    fieldId: syntaxStep.field.value,
    resolution,
    nextSchemaId,
    nextRelationSchemaId: undefined
  };
}

const isRelationLike = (resolution: FieldResolution): boolean =>
  resolution.kind === 'relation' ||
  resolution.kind === 'typedRelation' ||
  resolution.kind === 'unboundTypedRelation' ||
  resolution.kind === 'relationEntityRelation' ||
  resolution.kind === 'endpointPseudo';

const assertProjectionHopBudget = (path: PathStep[], offset: number): void => {
  if (path.length > MAX_PATH_HOPS) {
    throw new TextCompileError(`Projection path exceeds MAX_PATH_HOPS (${MAX_PATH_HOPS})`, offset);
  }
};

// Resolve one `columns` capture against the record its enclosing segment traversed to, and push the
// resulting `ProjectionField` onto `state.projections`. `segmentPrefix` is the absolute resolved
// path up to and including that segment (with its `[...]` filter), so join reuse in the projection
// planner binds the column to the same existential witness the filter matched.
function emitCapture(
  capture: TextCapture,
  segment: ResolvedStep,
  segmentPrefix: PathStep[],
  state: ResolutionState
): void {
  const segStep = segment.step;
  const scopesRelationInstance =
    segStep.kind === 'typedRelation' || segStep.kind === 'unboundTypedRelation';
  const relationSchemaId = scopesRelationInstance
    ? (segStep as Extract<PathStep, { kind: 'typedRelation' } | { kind: 'unboundTypedRelation' }>)
        .relationSchemaId
    : segment.nextRelationSchemaId;

  const savedHops = state.hopsUsed;
  const captureSteps: ResolvedStep[] = [];
  let sId = scopesRelationInstance ? undefined : segment.nextSchemaId;
  let rId = scopesRelationInstance ? relationSchemaId : segment.nextRelationSchemaId;
  for (const cs of capture.steps) {
    const resolved = resolveStep(cs, sId, rId, state);
    captureSteps.push(resolved);
    sId = resolved.nextSchemaId;
    rId = resolved.nextRelationSchemaId;
  }
  // A projection path is budgeted independently of the filter tree (§4.6 / §7).
  state.hopsUsed = savedHops;

  const terminal = captureSteps[captureSteps.length - 1]!;

  if (capture.includePath) {
    const includePathHops = [...segmentPrefix, ...captureSteps.map(s => s.step)];
    const badStep = includePathHops.find(
      s =>
        s.kind !== 'forward' &&
        s.kind !== 'backward' &&
        s.kind !== 'typedRelation' &&
        s.kind !== 'unboundTypedRelation'
    );
    if (badStep) {
      throw new TextCompileError(
        `'path' columns only traverse forward/backward/typedRelation hops, not '${badStep.kind}'`,
        capture.offset
      );
    }
    assertProjectionHopBudget(includePathHops, capture.offset);
    state.projections.push({
      path: includePathHops,
      fieldId: terminal.fieldId,
      includePath: true,
      ...(capture.alias !== undefined ? { alias: capture.alias } : {})
    });
    return;
  }

  if (isRelationLike(terminal.resolution)) {
    throw new TextCompileError(
      `A 'columns' capture must end on a scalar field, not '${terminal.fieldId}'`,
      capture.offset
    );
  }

  // A bare scalar read directly off the matched relation row (no further hop) is `source:'relation'`.
  const terminalOffRelationRow =
    scopesRelationInstance &&
    captureSteps.length === 1 &&
    terminal.resolution.kind === 'relationScalar';

  const projectionPath = terminalOffRelationRow
    ? [...segmentPrefix]
    : [...segmentPrefix, ...captureSteps.slice(0, -1).map(s => s.step)];

  assertProjectionHopBudget(projectionPath, capture.offset);
  state.projections.push({
    path: projectionPath,
    fieldId: terminal.fieldId,
    ...(terminalOffRelationRow ? { source: 'relation' as const } : {}),
    ...(capture.alias !== undefined ? { alias: capture.alias } : {})
  });
}

function resolvePathExpression(
  node: Extract<TextQueryNode, { kind: 'path' }>,
  currentSchemaId: string | undefined,
  currentRelationSchemaId: string | undefined,
  state: ResolutionState,
  pathPrefix: PathStep[] = []
): QueryNode {
  const steps: ResolvedStep[] = [];
  let schemaIdCursor = currentSchemaId;
  let relationSchemaIdCursor = currentRelationSchemaId;
  for (const syntaxStep of node.steps) {
    const prefixSoFar = [...pathPrefix, ...steps.map(s => s.step)];
    const resolved = resolveStep(
      syntaxStep,
      schemaIdCursor,
      relationSchemaIdCursor,
      state,
      prefixSoFar
    );
    steps.push(resolved);
    schemaIdCursor = resolved.nextSchemaId;
    relationSchemaIdCursor = resolved.nextRelationSchemaId;
  }

  // `columns` captures on any segment become `ProjectionField`s bound to that segment's witness:
  // the projection path is the absolute prefix up to and including the segment (carrying its
  // resolved `[...]` filter), plus the capture's own traversal.
  node.steps.forEach((syntaxStep, index) => {
    if (!syntaxStep.captures || syntaxStep.captures.length === 0) return;
    if (node.comparator && index === node.steps.length - 1) {
      throw new TextCompileError(
        "'columns' cannot be combined with a trailing comparator on the same segment",
        node.comparator.offset
      );
    }
    const segmentPrefix = [...pathPrefix, ...steps.slice(0, index + 1).map(s => s.step)];
    for (const capture of syntaxStep.captures) {
      emitCapture(capture, steps[index]!, segmentPrefix, state);
    }
  });

  const last = steps[steps.length - 1]!;
  if (node.comparator) {
    if (last.step.kind !== 'endpoint' && last.step.filter) {
      throw new TextCompileError(
        `'[...]' cannot be combined with a trailing comparator on the same segment`,
        node.comparator.offset
      );
    }
    if (isRelationLike(last.resolution)) {
      throw new TextCompileError(
        `'${last.fieldId}' is a relation field — compare a scalar field reached through it, or use '[...]' to scope a relationExists`,
        node.comparator.offset
      );
    }
    const resolved = resolveOpAndValue(
      node.comparator.text,
      node.value!,
      last.resolution,
      state.enums,
      node.comparator.offset
    );
    return {
      kind: 'predicate',
      path: steps.slice(0, -1).map(step => step.step),
      fieldId: last.fieldId,
      op: resolved.op,
      value: resolved.value
    };
  }

  if (last.resolution.kind === 'endpointPseudo') {
    throw new TextCompileError(
      `'${last.fieldId}' must be followed by a field, e.g. '${last.fieldId}._id'`,
      node.endOffset
    );
  }
  if (isRelationLike(last.resolution)) {
    return { kind: 'relationExists', path: steps.map(step => step.step) };
  }
  return {
    kind: 'predicate',
    path: steps.slice(0, -1).map(step => step.step),
    fieldId: last.fieldId,
    op: 'not_empty',
    value: null
  };
}

function resolveNode(
  node: TextQueryNode,
  currentSchemaId: string | undefined,
  currentRelationSchemaId: string | undefined,
  state: ResolutionState,
  allowFreeText: boolean,
  pathPrefix: PathStep[] = []
): QueryNode {
  switch (node.kind) {
    case 'and':
      return {
        kind: 'and',
        children: node.children.map(child =>
          resolveNode(
            child,
            currentSchemaId,
            currentRelationSchemaId,
            state,
            allowFreeText,
            pathPrefix
          )
        )
      };
    case 'or':
      return {
        kind: 'or',
        children: node.children.map(child =>
          resolveNode(
            child,
            currentSchemaId,
            currentRelationSchemaId,
            state,
            allowFreeText,
            pathPrefix
          )
        )
      };
    case 'not':
      return {
        kind: 'not',
        child: resolveNode(
          node.child,
          currentSchemaId,
          currentRelationSchemaId,
          state,
          allowFreeText,
          pathPrefix
        )
      };
    case 'freeText':
      if (!allowFreeText) {
        throw new TextCompileError(
          "'text' free-text search is only valid for the starting entity list",
          node.offset
        );
      }
      if (node.value.trim() === '') {
        throw new TextCompileError('Free-text search value must not be empty', node.valueOffset);
      }
      return { kind: 'freeText', value: node.value };
    case 'schema': {
      // Blocked only when nested inside an already-scoped relation row (a relationBackward/
      // typedRelation step's own bracketed filter — always resolved with allowFreeText=false —
      // where the schema was already fixed by that step, making a further `schema:` redundant).
      // At the outermost query tree (allowFreeText=true) `currentRelationSchemaId` instead means
      // "this query is itself relation-rooted" (see the root_kind:'relation' branch below), where
      // its own `schema:` qualifier is the primary, valid declaration of that fact.
      if (currentRelationSchemaId && !allowFreeText) {
        throw new TextCompileError(
          `Relation schema '${relationSchemaNameById(state.relationSchemas, currentRelationSchemaId)}' does not define a viewable field 'schema'`,
          node.offset
        );
      }
      const entitySchemaId = schemaNameMap(state.schemas).get(node.schemaRef.value);
      if (entitySchemaId) {
        return {
          kind: 'predicate',
          path: [],
          fieldId: '_schemaId',
          op: 'equals',
          value: entitySchemaId
        };
      }
      // A root-level `schema:` qualifier naming a relation (not entity) schema is how a
      // relation-rooted query expresses its own type filter (see #3066's Relations browser
      // saved views) — only meaningful at the true top level, not on an entity reached via
      // traversal, which `allowFreeText` (true only for the outermost query tree) also gates.
      const relationSchemaId = allowFreeText
        ? relationSchemaNameMap(state.relationSchemas).get(node.schemaRef.value)
        : undefined;
      if (relationSchemaId) {
        return {
          kind: 'predicate',
          path: [],
          fieldId: '_schemaId',
          op: 'equals',
          value: relationSchemaId
        };
      }
      throw new TextCompileError(`Unknown schema '${node.schemaRef.value}'`, node.schemaRef.offset);
    }
    case 'path':
      return resolvePathExpression(
        node,
        currentSchemaId,
        currentRelationSchemaId,
        state,
        pathPrefix
      );
  }
}

const deriveRootSchemaId = (
  syntax: TextQuerySyntax,
  schemas: SchemaCatalog
): string | undefined => {
  for (const ref of syntax.topLevelSchemaRefs) {
    const id = schemaNameMap(schemas).get(ref.value);
    if (id) return id;
  }
  return undefined;
};

// Counterpart to deriveRootSchemaId for a query rooted at a relation instead of an entity (#3066):
// a top-level `schema:` qualifier naming a relation schema — not reachable via any entity schema
// name — means the whole query is relation-rooted, mirroring how `schema:` inside a
// relationBackward/typedRelation step's own bracketed filter already fixes that step's relation
// context.
const deriveRootRelationSchemaId = (
  syntax: TextQuerySyntax,
  relationSchemas: RelationSchemaCatalog
): string | undefined => {
  for (const ref of syntax.topLevelSchemaRefs) {
    const id = relationSchemaNameMap(relationSchemas).get(ref.value);
    if (id) return id;
  }
  return undefined;
};

export const resolveTextQuery = (
  syntax: TextQuerySyntax,
  context: TextResolverContext
): EntityQuery => {
  const state: ResolutionState = { ...context, hopsUsed: 0, projections: [] };
  const withProjections = (query: EntityQuery): EntityQuery =>
    state.projections.length > 0 ? { ...query, projections: state.projections } : query;

  const rootSchemaId = deriveRootSchemaId(syntax, context.schemas);
  if (rootSchemaId) {
    return withProjections({
      root: resolveNode(syntax.root, rootSchemaId, undefined, state, true)
    });
  }
  const rootRelationSchemaId = deriveRootRelationSchemaId(syntax, context.relationSchemas);
  if (rootRelationSchemaId) {
    return withProjections({
      root_kind: 'relation',
      root: resolveNode(syntax.root, undefined, rootRelationSchemaId, state, true)
    });
  }
  return withProjections({
    root: resolveNode(syntax.root, undefined, undefined, state, true)
  });
};
