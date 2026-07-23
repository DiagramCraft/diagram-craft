import { HTTPError } from 'h3';
import type { AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import type { LifecycleStateDbResult } from '../workspace/db/workspaceDatabase';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type {
  MetricConfig,
  MetricDistributionEntry,
  MetricRollupResponse
} from '@arch-register/api-types/metricContract';
import {
  splitAssessmentConditions,
  matchesAssessmentConditions
} from '@arch-register/api-types/assessmentFilter';
import { httpAssert } from '../../utils/httpAssert';
import { computeEntityCompleteness } from '../../utils/completeness';
import { filterVisibleEntities } from '../auth/authorization';
import { filterEntities, matchesFilterCondition } from '../catalog/dataHelpers';
import { resolveJoinedAssessment } from '../catalog/entityQueryOperations';
import { listAllCatalogEntities } from '../catalog/entityLoader';
import { buildContainmentChildrenIndex, collectDescendantIds } from './metricDescendants';

type MetricValue = { value: number; lifecycleId: string | null };
type EnumOption = { value: string; label: string };

const isEnumSourceKind = (kind: MetricConfig['source']['kind']) =>
  kind === 'enum' || kind === 'assessmentEnum';

const extractValue = (
  entity: EntityDbResult,
  source: MetricConfig['source'],
  lifecycleSortOrder: Map<string, number>,
  responsesByEntity: Map<string, Record<string, string | number>> | null
): MetricValue | null => {
  if (source.kind === 'lifecycle') {
    if (entity.lifecycle == null) return null;
    const sortOrder = lifecycleSortOrder.get(entity.lifecycle);
    return sortOrder == null ? null : { value: sortOrder, lifecycleId: entity.lifecycle };
  }

  const raw =
    source.kind === 'assessmentRating'
      ? (responsesByEntity?.get(entity.id)?.[source.fieldId] ?? null)
      : (entity.data[source.fieldId] ?? null);
  if (raw == null || raw === '') return null;
  const num = Number(raw);
  return Number.isNaN(num) ? null : { value: num, lifecycleId: null };
};

const extractEnumValue = (
  entity: EntityDbResult,
  source: Extract<MetricConfig['source'], { kind: 'enum' | 'assessmentEnum' }>,
  responsesByEntity: Map<string, Record<string, string | number>> | null
): string | null => {
  const raw =
    source.kind === 'assessmentEnum'
      ? (responsesByEntity?.get(entity.id)?.[source.fieldId] ?? null)
      : (entity.data[source.fieldId] ?? null);
  if (raw == null || raw === '') return null;
  return String(raw);
};

const aggregate = (
  values: MetricValue[],
  aggregation: MetricConfig['aggregation'],
  worstDirection: 'low' | 'high'
): { value: number | null; lifecycleId: string | null } => {
  if (values.length === 0) return { value: null, lifecycleId: null };
  switch (aggregation) {
    case 'sum':
      return { value: values.reduce((sum, v) => sum + v.value, 0), lifecycleId: null };
    case 'average':
      return {
        value: values.reduce((sum, v) => sum + v.value, 0) / values.length,
        lifecycleId: null
      };
    case 'minimum': {
      const min = values.reduce((a, b) => (b.value < a.value ? b : a));
      return { value: min.value, lifecycleId: min.lifecycleId };
    }
    case 'maximum': {
      const max = values.reduce((a, b) => (b.value > a.value ? b : a));
      return { value: max.value, lifecycleId: max.lifecycleId };
    }
    case 'worst': {
      const picked =
        worstDirection === 'low'
          ? values.reduce((a, b) => (b.value < a.value ? b : a))
          : values.reduce((a, b) => (b.value > a.value ? b : a));
      return { value: picked.value, lifecycleId: picked.lifecycleId };
    }
    case 'count':
      return { value: values.length, lifecycleId: null };
  }
};

/**
 * Dominant option (highest count) among `values`, with ties broken toward whichever option
 * appears first in `enumOptions` - a deterministic rule independent of iteration/insertion
 * order. Unknown values (not present in `enumOptions`) sort last for tie-break purposes.
 */
const computeDistribution = (
  values: string[],
  enumOptions: EnumOption[]
): {
  dominantValue: string | null;
  dominantLabel: string | null;
  distribution: MetricDistributionEntry[];
} => {
  const optionIndex = new Map(enumOptions.map((o, i) => [o.value, i]));
  const labelByValue = new Map(enumOptions.map(o => [o.value, o.label]));
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);

  let dominantValue: string | null = null;
  let dominantCount = -1;
  let dominantIndex = Number.POSITIVE_INFINITY;
  for (const [value, count] of counts) {
    const index = optionIndex.get(value) ?? Number.POSITIVE_INFINITY;
    if (count > dominantCount || (count === dominantCount && index < dominantIndex)) {
      dominantValue = value;
      dominantCount = count;
      dominantIndex = index;
    }
  }

  const distribution = [...counts.entries()]
    .map(([value, count]) => ({ value, label: labelByValue.get(value) ?? value, count }))
    .sort(
      (a, b) =>
        (optionIndex.get(a.value) ?? Number.POSITIVE_INFINITY) -
        (optionIndex.get(b.value) ?? Number.POSITIVE_INFINITY)
    );

  return {
    dominantValue,
    dominantLabel:
      dominantValue == null ? null : (labelByValue.get(dominantValue) ?? dominantValue),
    distribution
  };
};

/**
 * Worst-ranked option among `values`, using each option's position in `enumOptions` (its
 * admin-configured top-to-bottom order, see #2168) as the severity ranking - `worstDirection
 * 'low'` treats the first option as worst, `'high'` treats the last option as worst. Values
 * not present in `enumOptions` are ignored, since they have no defined rank.
 */
const pickWorstEnumOption = (
  values: string[],
  enumOptions: EnumOption[],
  worstDirection: 'low' | 'high'
): { dominantValue: string | null; dominantLabel: string | null } => {
  const optionIndex = new Map(enumOptions.map((o, i) => [o.value, i]));
  const labelByValue = new Map(enumOptions.map(o => [o.value, o.label]));

  let worstValue: string | null = null;
  let worstIndex: number | null = null;
  for (const value of values) {
    const index = optionIndex.get(value);
    if (index == null) continue;
    const isWorse =
      worstIndex == null || (worstDirection === 'low' ? index < worstIndex : index > worstIndex);
    if (isWorse) {
      worstValue = value;
      worstIndex = index;
    }
  }

  return {
    dominantValue: worstValue,
    dominantLabel: worstValue == null ? null : (labelByValue.get(worstValue) ?? worstValue)
  };
};

/**
 * Pure metric aggregation over an already permission- and project-scope-filtered entity pool.
 * `isFilterMatch` additionally gates which descendants *contribute* to the aggregation (current
 * browser filters/conditions), while `entities` (and the containment index built from it)
 * determines structural reachability - matching `getEntityTree`'s split between "included for
 * connectivity" and "matches the active filters". `enumOptions` is only consulted for
 * enum/assessmentEnum sources.
 */
export const computeBoxMetrics = (
  boxEntityIds: string[],
  metric: MetricConfig,
  entities: EntityDbResult[],
  schemas: SchemaDbResult[],
  lifecycleStates: LifecycleStateDbResult[],
  responsesByEntity: Map<string, Record<string, string | number>> | null,
  isFilterMatch: (entity: EntityDbResult) => boolean,
  enumOptions: EnumOption[] | null = null
): MetricRollupResponse => {
  const childrenOf = buildContainmentChildrenIndex(schemas, entities);
  const entityById = new Map(entities.map(e => [e.id, e]));
  const lifecycleSortOrder = new Map(lifecycleStates.map(s => [s.id, s.sort_order]));
  const worstDirection = metric.worstDirection ?? 'high';

  const results = boxEntityIds.map(boxEntityId => {
    const sourceEntities = collectDescendantIds(boxEntityId, childrenOf)
      .map(id => entityById.get(id))
      .filter(
        (entity): entity is EntityDbResult =>
          entity != null && entity.schema_id === metric.sourceSchemaId && isFilterMatch(entity)
      );

    if (isEnumSourceKind(metric.source.kind)) {
      const source = metric.source as Extract<
        MetricConfig['source'],
        { kind: 'enum' | 'assessmentEnum' }
      >;
      const values = sourceEntities
        .map(entity => extractEnumValue(entity, source, responsesByEntity))
        .filter((v): v is string => v != null);
      const {
        dominantValue: modeValue,
        dominantLabel: modeLabel,
        distribution
      } = computeDistribution(values, enumOptions ?? []);
      const { dominantValue, dominantLabel } =
        metric.aggregation === 'worst'
          ? pickWorstEnumOption(values, enumOptions ?? [], worstDirection)
          : { dominantValue: modeValue, dominantLabel: modeLabel };
      return {
        boxEntityId,
        value: sourceEntities.length,
        lifecycleId: null,
        dominantValue,
        dominantLabel,
        distribution,
        sourceCount: sourceEntities.length,
        populatedCount: values.length
      };
    }

    if (metric.aggregation === 'count') {
      return {
        boxEntityId,
        value: sourceEntities.length,
        lifecycleId: null,
        dominantValue: null,
        dominantLabel: null,
        distribution: [],
        sourceCount: sourceEntities.length,
        populatedCount: sourceEntities.length
      };
    }

    const populated = sourceEntities
      .map(entity => extractValue(entity, metric.source, lifecycleSortOrder, responsesByEntity))
      .filter((v): v is MetricValue => v != null);
    const { value, lifecycleId } = aggregate(populated, metric.aggregation, worstDirection);

    return {
      boxEntityId,
      value,
      lifecycleId,
      dominantValue: null,
      dominantLabel: null,
      distribution: [],
      sourceCount: sourceEntities.length,
      populatedCount: populated.length
    };
  });

  const numericValues = results.map(r => r.value).filter((v): v is number => v != null);
  return {
    results,
    legend: {
      min: numericValues.length > 0 ? Math.min(...numericValues) : null,
      max: numericValues.length > 0 ? Math.max(...numericValues) : null,
      ...(enumOptions ? { categories: enumOptions } : {})
    }
  };
};

const resolveEnumOptions = async (
  db: DatabaseAdapter,
  workspace: string,
  metric: MetricConfig,
  schemas: SchemaDbResult[],
  joinedAssessment: Awaited<ReturnType<typeof resolveJoinedAssessment>>
): Promise<EnumOption[] | null> => {
  const source = metric.source;
  if (!isEnumSourceKind(source.kind)) return null;

  let enumId: string;
  if (source.kind === 'enum') {
    const fieldId = source.fieldId;
    const schema = schemas.find(s => s.id === metric.sourceSchemaId);
    const field = schema?.fields.find(f => f.id === fieldId);
    if (field?.type !== 'select') {
      throw new HTTPError({
        status: 400,
        message: `Field '${fieldId}' on schema '${metric.sourceSchemaId}' is not a select field`
      });
    }
    enumId = field.enumId;
  } else if (source.kind === 'assessmentEnum') {
    httpAssert.present(joinedAssessment, {
      status: 400,
      message: 'Metric requires an assessment source, but no assessment is joined'
    });
    const fieldId = source.fieldId;
    const field = joinedAssessment.assessment.fields.find(f => f.id === fieldId);
    if (field?.type !== 'enum') {
      throw new HTTPError({
        status: 400,
        message: `Assessment field '${fieldId}' is not an enum field`
      });
    }
    enumId = field.enumId;
  } else {
    return null;
  }

  const enumDef = await db.catalog.getEnum(workspace, enumId);
  httpAssert.present(enumDef, { status: 404, message: `Enum '${enumId}' not found` });
  return enumDef.options;
};

export const getBoxMetrics = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  options: {
    boxEntityIds: string[];
    metric: MetricConfig;
    schemaId?: string | null;
    owner?: string | null;
    lifecycle?: string | null;
    q?: string | null;
    conditions?: FilterCondition[];
    assessmentId?: string | null;
    projectId?: string | null;
    projectScope?: 'project' | 'all';
  }
): Promise<MetricRollupResponse> => {
  const {
    boxEntityIds,
    metric,
    schemaId = null,
    owner = null,
    lifecycle = null,
    q = '',
    conditions = [],
    assessmentId = null,
    projectId = null,
    projectScope = 'all'
  } = options;

  if (metric.aggregation === 'worst') {
    httpAssert.present(metric.worstDirection, {
      status: 400,
      message: '"worst" aggregation requires worstDirection'
    });
  }
  if (isEnumSourceKind(metric.source.kind)) {
    httpAssert.true(metric.aggregation === 'count' || metric.aggregation === 'worst', {
      status: 400,
      message: 'Enum-sourced metrics only support "count" or "worst" aggregation'
    });
  }

  const { assessmentConditions, otherConditions } = splitAssessmentConditions(conditions);
  const needsAssessment =
    assessmentConditions.length > 0 ||
    metric.source.kind === 'assessmentRating' ||
    metric.source.kind === 'assessmentEnum';

  const [schemas, allEntities, lifecycleStates, joinedAssessment] = await Promise.all([
    db.catalog.listSchemas(workspace),
    listAllCatalogEntities(db, workspace, projectId ? { projectId, projectScope } : undefined),
    db.workspace.listLifecycleStates(workspace),
    resolveJoinedAssessment(db, workspace, authCtx, assessmentId, needsAssessment)
  ]);

  if (metric.source.kind === 'assessmentRating') {
    httpAssert.present(joinedAssessment, {
      status: 400,
      message: 'Metric requires an assessment source, but no assessment is joined'
    });
  }

  const enumOptions = await resolveEnumOptions(db, workspace, metric, schemas, joinedAssessment);

  const visibleEntities = filterVisibleEntities(authCtx, allEntities);
  const scopedEntities = visibleEntities;

  const schemaMap = new Map(schemas.map(s => [s.id, s]));
  const hasCompletenessCondition = otherConditions.some(c => c.fieldId === '_completeness');
  const quickFilterMatchIds = new Set(
    filterEntities(scopedEntities, { schemaId, owner, lifecycle, q: q ?? '' }).map(e => e.id)
  );

  const isFilterMatch = (entity: EntityDbResult): boolean => {
    if (!quickFilterMatchIds.has(entity.id)) return false;
    if (otherConditions.length > 0) {
      const schema = hasCompletenessCondition ? (schemaMap.get(entity.schema_id) ?? null) : null;
      const completeness = schema != null ? computeEntityCompleteness(entity, schema) : null;
      if (!otherConditions.every(c => matchesFilterCondition(entity, c, completeness)))
        return false;
    }
    if (
      joinedAssessment &&
      assessmentConditions.length > 0 &&
      !matchesAssessmentConditions(
        joinedAssessment.responsesByEntity.get(entity.id),
        assessmentConditions,
        joinedAssessment.assessment.fields
      )
    ) {
      return false;
    }
    return true;
  };

  return computeBoxMetrics(
    boxEntityIds,
    metric,
    scopedEntities,
    schemas,
    lifecycleStates,
    joinedAssessment?.responsesByEntity ?? null,
    isFilterMatch,
    enumOptions
  );
};
