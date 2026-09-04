import type { EntityQuery, ProjectionField } from '@arch-register/api-types/entityQueryIR';
import {
  ASSESSMENT_FIELD_PREFIX,
  ASSESSMENT_PRESENCE_FIELD_ID
} from '@arch-register/api-types/assessmentFilter';
import { ENTITY_ARRAY_COLUMNS, ENTITY_BUILTIN_COLUMNS } from './db/filterBuilder';
import {
  buildEntityQueryProjectionPlan,
  effectiveProjectionAlias,
  type ProjectionBinding
} from './entityQueryIRProjectionPlan';
import { entityQueryPathKey, entityQueryPathStartsWith } from './entityQueryIRPlan';
import {
  addParam,
  RELATION_SCOPE_CTE,
  ROOT_ALIAS,
  SCOPE_CTE,
  type EntityQuerySqlRenderState
} from './entityQueryIRSqlContext';
import {
  assertValidFieldId,
  compileNode,
  compileRelationNode,
  jsonArrayElementPosition,
  jsonArrayLateralElement,
  projectionEntityFieldSchemaClause,
  projectionTargetSchemaClause,
  relationJoinClause,
  relationProjectionColumn,
  relationProjectionDataColumn,
  relationSchemaScopeClause,
  schemaScopeClause,
  typedRelationOwnerSchemaClause,
  unboundTypedRelationOwnerSchemaClause
} from './entityQueryIRSqlPredicates';
import { UnsupportedEntityQueryIRError } from './entityQueryIRErrors';

export const buildProjectionBindings = (
  query: EntityQuery,
  state: EntityQuerySqlRenderState
): string[] => {
  const projectionPlan = buildEntityQueryProjectionPlan(
    query,
    state.semanticPlan,
    state.schemas,
    state.relationSchemas
  );
  state.projectionBindings = [...projectionPlan.bindings];
  state.bindingByPath = new Map(projectionPlan.bindingByPath);
  state.projectionPathSchemas = new Map(projectionPlan.projectionPathSchemas);

  return state.projectionBindings.map(binding => {
    const rootAlias = `pb_root_${binding.name}`;
    let currentAlias = rootAlias;
    const pathSchemaInfo = state.projectionPathSchemas.get(entityQueryPathKey(binding.path));
    if (!pathSchemaInfo) {
      throw new UnsupportedEntityQueryIRError(
        `Missing projection path plan for '${entityQueryPathKey(binding.path)}'`
      );
    }
    const selectParts = [`${rootAlias}.id AS root_id`];
    // A binding's root row is always the query root, so it's drawn from whichever scope CTE
    // ROOT_ALIAS itself binds to (relation root paths always start with an endpoint step).
    let from = `FROM ${state.rootKind === 'relation' ? RELATION_SCOPE_CTE : SCOPE_CTE} ${rootAlias}`;

    state.compilingBinding = true;
    binding.path.forEach((step, stepIndex) => {
      if (step.kind === 'endpoint') {
        const targetAlias = `pb_${binding.name}_${stepIndex + 1}`;
        const targetId =
          step.direction === 'in'
            ? `${currentAlias}.in_record_id`
            : `${currentAlias}.out_record_id`;
        const targetSchemaClause = projectionTargetSchemaClause(
          targetAlias,
          pathSchemaInfo.entitySchemaIdsByStep[stepIndex] ?? [],
          state
        );
        from +=
          `\n      JOIN ${SCOPE_CTE} ${targetAlias} ON ${targetAlias}.id = ${targetId}` +
          (targetSchemaClause ? ` AND ${targetSchemaClause}` : '');
        selectParts.push(
          `${targetAlias}.id AS hop_${stepIndex + 1}_id`,
          `${targetAlias}.name AS hop_${stepIndex + 1}_name`,
          `${targetAlias}.schema_id AS hop_${stepIndex + 1}_schema_id`,
          `${targetAlias}.id AS hop_${stepIndex + 1}_order`
        );
        currentAlias = targetAlias;
        return;
      }
      if (step.kind === 'typedRelation' || step.kind === 'unboundTypedRelation') {
        const relationAlias = `pb_rel_${binding.name}_${stepIndex + 1}`;
        const targetAlias = `pb_${binding.name}_${stepIndex + 1}`;
        const ownerId =
          step.direction === 'in'
            ? `${relationAlias}.in_record_id`
            : `${relationAlias}.out_record_id`;
        const targetId =
          step.direction === 'in'
            ? `${relationAlias}.out_record_id`
            : `${relationAlias}.in_record_id`;
        const relationSchema = addParam(state, step.relationSchemaId);
        const ownerSchemaClause =
          step.kind === 'typedRelation'
            ? typedRelationOwnerSchemaClause(currentAlias, step.ownerSchemaIds, state)
            : unboundTypedRelationOwnerSchemaClause(
                currentAlias,
                step.relationSchemaId,
                step.direction,
                state
              );
        const filter = step.filter
          ? ` AND ${compileRelationNode(step.filter, relationAlias, step.relationSchemaId, state)}`
          : '';
        const targetSchemaClause = projectionTargetSchemaClause(
          targetAlias,
          pathSchemaInfo.entitySchemaIdsByStep[stepIndex] ?? [],
          state
        );
        from +=
          `\n      JOIN ${RELATION_SCOPE_CTE} ${relationAlias} ON ${relationAlias}.workspace = ${currentAlias}.workspace` +
          ` AND ${relationAlias}.schema_id = ${relationSchema}` +
          ` AND ${ownerSchemaClause}` +
          ` AND ${ownerId} = ${currentAlias}.id${filter}` +
          `\n      JOIN ${SCOPE_CTE} ${targetAlias} ON ${targetAlias}.id = ${targetId}` +
          (targetSchemaClause ? ` AND ${targetSchemaClause}` : '');
        selectParts.push(
          `${relationAlias}.id AS relation_${stepIndex + 1}_id`,
          `${relationAlias}.data AS relation_${stepIndex + 1}_data`,
          `${targetAlias}.id AS hop_${stepIndex + 1}_id`,
          `${targetAlias}.name AS hop_${stepIndex + 1}_name`,
          `${targetAlias}.schema_id AS hop_${stepIndex + 1}_schema_id`,
          `${relationAlias}.created_at AS hop_${stepIndex + 1}_order`
        );
        currentAlias = targetAlias;
        return;
      }
      if (step.kind === 'relationForward') {
        const targetAlias = `pb_${binding.name}_${stepIndex + 1}`;
        const elementAlias = `${targetAlias}_arr`;
        const element = jsonArrayLateralElement(currentAlias, step.fieldId, elementAlias, state);
        const fieldScope = (() => {
          const scope = relationSchemaScopeClause(currentAlias, step.fieldId, state);
          return scope ? ` AND ${scope}` : '';
        })();
        const filter = step.filter
          ? ` AND ${compileNode(step.filter, targetAlias, state, false)}`
          : '';
        const targetSchemaClause = projectionTargetSchemaClause(
          targetAlias,
          pathSchemaInfo.entitySchemaIdsByStep[stepIndex] ?? [],
          state
        );
        from +=
          `\n      ${element.joinClause}` +
          `\n      JOIN ${SCOPE_CTE} ${targetAlias} ON ${targetAlias}.id = ${element.valueColumn}${fieldScope}` +
          `${targetSchemaClause ? ` AND ${targetSchemaClause}` : ''}${filter}`;
        selectParts.push(
          `${targetAlias}.id AS hop_${stepIndex + 1}_id`,
          `${targetAlias}.name AS hop_${stepIndex + 1}_name`,
          `${targetAlias}.schema_id AS hop_${stepIndex + 1}_schema_id`,
          `${element.ordinalColumn} AS hop_${stepIndex + 1}_order`
        );
        currentAlias = targetAlias;
        return;
      }
      if (step.kind === 'relationBackward') {
        const relationAlias = `pb_rel_${binding.name}_${stepIndex + 1}`;
        const relation = relationJoinClause(relationAlias, step.fieldId, currentAlias, state);
        const relationSchemaParam = addParam(state, step.relationSchemaId);
        const filter = step.filter
          ? ` AND ${compileRelationNode(step.filter, relationAlias, step.relationSchemaId, state)}`
          : '';
        from += `\n      JOIN ${RELATION_SCOPE_CTE} ${relationAlias} ON ${relationAlias}.schema_id = ${relationSchemaParam} AND ${relation}${filter}`;
        selectParts.push(
          `${relationAlias}.id AS relation_${stepIndex + 1}_id`,
          `${relationAlias}.data AS relation_${stepIndex + 1}_data`,
          `${jsonArrayElementPosition(
            relationAlias,
            step.fieldId,
            `${currentAlias}.id`,
            state
          )} AS hop_${stepIndex + 1}_order`
        );
        currentAlias = relationAlias;
        return;
      }
      const targetAlias = `pb_${binding.name}_${stepIndex + 1}`;
      const filter = step.filter
        ? ` AND ${compileNode(step.filter, targetAlias, state, false)}`
        : '';
      const targetSchemaClause = projectionTargetSchemaClause(
        targetAlias,
        pathSchemaInfo.entitySchemaIdsByStep[stepIndex] ?? [],
        state
      );
      if (step.kind === 'forward') {
        // The owner (currentAlias) is already known, so the array carrying the target id can be
        // unnested once — matching the target and recovering its position in the same pass.
        const elementAlias = `${targetAlias}_arr`;
        const element = jsonArrayLateralElement(currentAlias, step.fieldId, elementAlias, state);
        const forwardScope = (() => {
          const scope = schemaScopeClause(currentAlias, step.fieldId, state);
          return scope ? ` AND ${scope}` : '';
        })();
        from +=
          `\n      ${element.joinClause}` +
          `\n      JOIN ${SCOPE_CTE} ${targetAlias} ON ${targetAlias}.id = ${element.valueColumn}${forwardScope}` +
          `${targetSchemaClause ? ` AND ${targetSchemaClause}` : ''}${filter}`;
        selectParts.push(
          `${targetAlias}.id AS hop_${stepIndex + 1}_id`,
          `${targetAlias}.name AS hop_${stepIndex + 1}_name`,
          `${targetAlias}.schema_id AS hop_${stepIndex + 1}_schema_id`,
          `${element.ordinalColumn} AS hop_${stepIndex + 1}_order`
        );
        currentAlias = targetAlias;
        return;
      }
      const relation = relationJoinClause(targetAlias, step.fieldId, currentAlias, state);
      const ownerSchema = ` AND ${targetAlias}.schema_id = ${addParam(state, step.ownerSchemaId)}`;
      from +=
        `\n      JOIN ${SCOPE_CTE} ${targetAlias} ON ${relation}${ownerSchema}` +
        `${targetSchemaClause ? ` AND ${targetSchemaClause}` : ''}${filter}`;
      selectParts.push(
        `${targetAlias}.id AS hop_${stepIndex + 1}_id`,
        `${targetAlias}.name AS hop_${stepIndex + 1}_name`,
        `${targetAlias}.schema_id AS hop_${stepIndex + 1}_schema_id`,
        `${jsonArrayElementPosition(
          targetAlias,
          step.fieldId,
          `${currentAlias}.id`,
          state
        )} AS hop_${stepIndex + 1}_order`
      );
      currentAlias = targetAlias;
    });
    state.compilingBinding = false;

    return `${binding.name} AS (SELECT ${selectParts.join(', ')} ${from})`;
  });
};

const projectionBindingFor = (
  projection: ProjectionField,
  state: EntityQuerySqlRenderState
): ProjectionBinding | null => {
  if (projection.path.length === 0) return null;
  const exact = state.bindingByPath.get(entityQueryPathKey(projection.path));
  if (exact) return exact;
  return (
    state.projectionBindings.find(binding =>
      entityQueryPathStartsWith(binding.path, projection.path)
    ) ?? null
  );
};

const projectionRawValue = (
  alias: string,
  fieldId: string,
  state: EntityQuerySqlRenderState
): string => {
  if (fieldId === '_conformanceStatus') {
    return state.dialectAdapter.toJson(`${alias}.conformance_status`);
  }
  if (fieldId === '_conformanceEvaluatedAt') {
    return state.dialectAdapter.toJson(`${alias}.conformance_evaluated_at`);
  }
  if (fieldId === '_conformanceStale') {
    return state.dialectAdapter.toJson(`${alias}.conformance_stale`);
  }
  if (fieldId === ASSESSMENT_PRESENCE_FIELD_ID) {
    return state.dialectAdapter.toJson(`${alias}.assessment_values IS NOT NULL`);
  }
  if (fieldId.startsWith(ASSESSMENT_FIELD_PREFIX)) {
    assertValidFieldId(fieldId.slice(ASSESSMENT_FIELD_PREFIX.length));
    return state.dialectAdapter.jsonFieldValue(
      `${alias}.assessment_values`,
      fieldId.slice(ASSESSMENT_FIELD_PREFIX.length)
    );
  }
  if (fieldId === '_id') {
    return state.dialectAdapter.toJson(`${alias}.id`);
  }
  if (Object.hasOwn(ENTITY_ARRAY_COLUMNS, fieldId)) {
    const column = ENTITY_ARRAY_COLUMNS[fieldId]!.replace(/^e\./, `${alias}.`);
    return state.dialectAdapter.wrapJson(column);
  }
  if (Object.hasOwn(ENTITY_BUILTIN_COLUMNS, fieldId)) {
    const column = ENTITY_BUILTIN_COLUMNS[fieldId]!.replace(/^e\./, `${alias}.`);
    return state.dialectAdapter.toJson(column);
  }
  assertValidFieldId(fieldId);
  return state.dialectAdapter.jsonFieldValue(`${alias}.data`, fieldId);
};

const projectionBindingOrderBy = (binding: ProjectionBinding, bindingAlias: string): string =>
  binding.path.map((_, index) => `${bindingAlias}.hop_${index + 1}_order`).join(', ');

const projectionValue = (
  projection: ProjectionField,
  state: EntityQuerySqlRenderState
): { value: string; isArray: boolean } => {
  const isArray =
    state.semanticPlan.projectionPathCardinality.get(entityQueryPathKey(projection.path)) ?? false;
  const binding = projectionBindingFor(projection, state);
  if (!binding) {
    if (state.rootKind === 'relation' && projection.path.length === 0) {
      const raw = relationProjectionColumn(ROOT_ALIAS, projection.fieldId, state);
      const scope = relationSchemaScopeClause(ROOT_ALIAS, projection.fieldId, state);
      return {
        value: scope ? `(CASE WHEN ${scope} THEN ${raw} ELSE NULL END)` : raw,
        isArray: false
      };
    }
    const raw = projectionRawValue(ROOT_ALIAS, projection.fieldId, state);
    const scope = schemaScopeClause(ROOT_ALIAS, projection.fieldId, state);
    return {
      value: scope ? `(CASE WHEN ${scope} THEN ${raw} ELSE NULL END)` : raw,
      isArray: false
    };
  }

  if (projection.includePath) {
    const includePathBindingAlias = `pv_${binding.name}`;
    const hopObject = (hopIndex: number) =>
      state.dialectAdapter.jsonObject([
        "'id'",
        `${includePathBindingAlias}.hop_${hopIndex}_id`,
        "'name'",
        `${includePathBindingAlias}.hop_${hopIndex}_name`,
        "'schemaId'",
        `${includePathBindingAlias}.hop_${hopIndex}_schema_id`
      ]);
    const includePathArrayEntries = Array.from({ length: projection.path.length }, (_, index) =>
      hopObject(index + 1)
    );
    const includePathArray = state.dialectAdapter.jsonArray(includePathArrayEntries);
    const aggregate = state.dialectAdapter.orderedJsonAggregate(
      includePathArray,
      `FROM ${binding.name} ${includePathBindingAlias} WHERE ${includePathBindingAlias}.root_id = ${ROOT_ALIAS}.id`,
      projectionBindingOrderBy(binding, includePathBindingAlias),
      true
    );
    return {
      value: `(SELECT ${aggregate})`,
      isArray: true
    };
  }

  const bindingAlias = `pv_${binding.name}`;
  const terminalStep = projection.path[projection.path.length - 1];
  if (
    projection.source === 'relation' &&
    terminalStep?.kind !== 'typedRelation' &&
    terminalStep?.kind !== 'unboundTypedRelation'
  ) {
    throw new UnsupportedEntityQueryIRError(
      'Relation projections must terminate at a typed relation hop'
    );
  }
  const targetAlias = `pv_target_${binding.name}`;
  const targetId = `${bindingAlias}.hop_${projection.path.length}_id`;
  const raw =
    projection.source === 'relation'
      ? relationProjectionDataColumn(
          `${bindingAlias}.relation_${projection.path.length}_data`,
          projection.fieldId,
          state
        )
      : projectionRawValue(targetAlias, projection.fieldId, state);
  const scope =
    projection.source === 'relation'
      ? null
      : projectionEntityFieldSchemaClause(
          targetAlias,
          projection.fieldId,
          state.projectionPathSchemas.get(entityQueryPathKey(projection.path))
            ?.terminalEntitySchemaIds ?? [],
          state
        );
  const source =
    `FROM ${binding.name} ${bindingAlias} ` +
    (projection.source === 'relation'
      ? ''
      : `JOIN ${SCOPE_CTE} ${targetAlias} ON ${targetAlias}.id = ${targetId} `) +
    `WHERE ${bindingAlias}.root_id = ${ROOT_ALIAS}.id${scope ? ` AND ${scope}` : ''}`;

  if (!isArray) {
    return { value: `(SELECT ${raw} ${source} LIMIT 1)`, isArray: false };
  }

  return {
    value: `(SELECT ${state.dialectAdapter.orderedJsonAggregate(
      raw,
      source,
      projectionBindingOrderBy(binding, bindingAlias)
    )})`,
    isArray: true
  };
};

export const compileProjectionObject = (
  projections: ProjectionField[],
  state: EntityQuerySqlRenderState
): string => {
  if (projections.length === 0) return state.dialectAdapter.jsonObject([]);

  const entries = projections.flatMap(projection => {
    const keyParam = addParam(state, effectiveProjectionAlias(projection));
    const key = state.dialectAdapter.textCast(keyParam);
    const projected = projectionValue(projection, state);
    const value = projected.isArray
      ? state.dialectAdapter.wrapJson(projected.value)
      : projected.value;
    return [key, value];
  });
  return state.dialectAdapter.jsonObject(entries);
};
