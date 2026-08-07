import type { AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import type { RelationDbResult, RelationSchemaDbResult } from '../catalog/db/relationDatabase';
import type { LifecycleStateDbResult } from '../workspace/db/workspaceDatabase';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { currencyValueSchema } from '@arch-register/api-types/common';
import type {
  MetricConfig,
  MetricDistributionEntry,
  MetricRollupResponse
} from '@arch-register/api-types/metricContract';
import { getInlineAssessmentEnumOptions } from '@arch-register/api-types/assessmentFieldOptions';
import { httpAssert } from '../../utils/httpAssert';
import { filterVisibleEntities } from '../auth/authorization';
import { isFieldViewRestricted } from '../auth/fieldGroupAccessControl';
import {
  resolveJoinedAssessment,
  collectEntitiesFromIR,
  normalizeEntityQueryOptions
} from '../catalog/entityQueryOperations';
import { parseEntityQuery, buildEntityQueryForExecution } from '../catalog/entityQuery';
import { listAllCatalogEntities } from '../catalog/entityLoader';
import { buildContainmentChildrenIndex, collectDescendantIds } from './metricDescendants';
import {
  collectMetricTerminals,
  type MetricTerminal,
  type MetricTraversalResult
} from './metricTraversal';
import type { CurrencyRateSnapshotDbResult } from '../currencyRates/db/currencyRatesDatabase';

type MetricValue = { value: number; lifecycleId: string | null; currencyCode: string | null };
type CurrencyConversion = {
  targetCurrency: string;
  rateDate: string;
  rates: Record<string, number>;
};
type EnumOption = { value: string; label: string };
type MetricSourceSchema = SchemaDbResult | RelationSchemaDbResult;

const isEnumSourceKind = (kind: MetricConfig['source']['kind']) =>
  kind === 'enum' || kind === 'assessmentEnum';

const isMetricSourceAvailable = (
  metric: MetricConfig,
  schemas: SchemaDbResult[],
  assessmentFields?: readonly { id: string; type: string }[],
  relationSchemas: RelationSchemaDbResult[] = []
): boolean => {
  const sourceSchema =
    metric.sourceContext === 'relation'
      ? relationSchemas.find(schema => schema.id === metric.sourceSchemaId)
      : schemas.find(schema => schema.id === metric.sourceSchemaId);
  if (!sourceSchema) return false;
  const source = metric.source;

  if (source.kind === 'field') {
    return sourceSchema.fields.some(
      field => field.id === source.fieldId && (field.type === 'number' || field.type === 'currency')
    );
  }

  if (source.kind === 'enum') {
    return sourceSchema.fields.some(
      field => field.id === source.fieldId && field.type === 'select'
    );
  }

  if (source.kind === 'assessmentRating') {
    if (metric.sourceContext === 'relation') return false;
    return (
      assessmentFields == null ||
      assessmentFields.some(field => field.id === source.fieldId && field.type === 'rating')
    );
  }

  if (source.kind === 'assessmentEnum') {
    if (metric.sourceContext === 'relation') return false;
    return (
      assessmentFields == null ||
      assessmentFields.some(field => field.id === source.fieldId && field.type === 'enum')
    );
  }

  return true;
};

const extractValue = (
  entity: EntityDbResult | RelationDbResult,
  source: MetricConfig['source'],
  lifecycleSortOrder: Map<string, number>,
  responsesByEntity: Map<string, Record<string, string | number | boolean>> | null,
  sourceSchema: MetricSourceSchema | undefined,
  authCtx: AuthorizationContext | null
): MetricValue | null => {
  if (source.kind === 'lifecycle') {
    if (entity.lifecycle == null) return null;
    const sortOrder = lifecycleSortOrder.get(entity.lifecycle);
    return sortOrder == null
      ? null
      : { value: sortOrder, lifecycleId: entity.lifecycle, currencyCode: null };
  }

  if (
    source.kind !== 'assessmentRating' &&
    isFieldViewRestricted(authCtx, sourceSchema, source.fieldId)
  ) {
    return null;
  }

  const raw =
    source.kind === 'assessmentRating'
      ? (responsesByEntity?.get(entity.id)?.[source.fieldId] ?? null)
      : (entity.data[source.fieldId] ?? null);
  if (raw == null || raw === '') return null;
  const field =
    source.kind === 'field'
      ? sourceSchema?.fields.find(candidate => candidate.id === source.fieldId)
      : undefined;
  if (field?.type === 'currency') {
    const parsed = currencyValueSchema.safeParse(raw);
    return parsed.success
      ? { value: parsed.data.amount, lifecycleId: null, currencyCode: parsed.data.currency }
      : null;
  }
  const num = Number(raw);
  return Number.isNaN(num) ? null : { value: num, lifecycleId: null, currencyCode: null };
};

const isCurrencyFieldSource = (
  metric: MetricConfig,
  sourceSchema: MetricSourceSchema | undefined
): boolean => {
  if (metric.source.kind !== 'field') return false;
  const fieldId = metric.source.fieldId;
  return (
    sourceSchema?.fields.some(field => field.id === fieldId && field.type === 'currency') === true
  );
};

const getCurrencyMetadata = (
  values: MetricValue[]
): { currencyCode: string | null; currencyMixed: boolean } => {
  const currencies = new Set(
    values
      .map(value => value.currencyCode)
      .filter((currency): currency is string => currency != null)
  );
  return {
    currencyCode: currencies.size === 1 ? [...currencies][0]! : null,
    currencyMixed: currencies.size > 1
  };
};

const extractEnumValue = (
  entity: EntityDbResult | RelationDbResult,
  source: Extract<MetricConfig['source'], { kind: 'enum' | 'assessmentEnum' }>,
  responsesByEntity: Map<string, Record<string, string | number | boolean>> | null,
  sourceSchema: MetricSourceSchema | undefined,
  authCtx: AuthorizationContext | null
): string | null => {
  if (source.kind === 'enum' && isFieldViewRestricted(authCtx, sourceSchema, source.fieldId)) {
    return null;
  }

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
  responsesByEntity: Map<string, Record<string, string | number | boolean>> | null,
  isFilterMatch: (entity: EntityDbResult) => boolean,
  enumOptions: EnumOption[] | null = null,
  authCtx: AuthorizationContext | null = null,
  sourceAvailableOverride?: boolean,
  currencyConversion: CurrencyConversion | null = null,
  traversalResults?: Map<string, MetricTraversalResult>
): MetricRollupResponse => {
  const entityById = new Map(entities.map(e => [e.id, e]));
  const lifecycleSortOrder = new Map(lifecycleStates.map(s => [s.id, s.sort_order]));
  const worstDirection = metric.worstDirection ?? 'high';
  const sourceSchema =
    metric.sourceContext === 'relation'
      ? undefined
      : schemas.find(s => s.id === metric.sourceSchemaId);
  const sourceAvailable =
    (metric.sourceContext === 'relation' || isMetricSourceAvailable(metric, schemas)) &&
    sourceAvailableOverride !== false;
  const childrenOf =
    sourceAvailable && metric.sourceContext !== 'relation'
      ? buildContainmentChildrenIndex(schemas, entities, authCtx)
      : new Map<string, string[]>();

  const results: MetricRollupResponse['results'] = boxEntityIds.map(boxEntityId => {
    const traversal = traversalResults?.get(boxEntityId);
    const sourceTerminals: MetricTerminal[] = traversal
      ? traversal.terminals
      : metric.sourceContext !== 'relation'
        ? (sourceAvailable ? collectDescendantIds(boxEntityId, childrenOf) : [])
            .map(id => entityById.get(id))
            .filter(
              (entity): entity is EntityDbResult =>
                entity != null && entity.schema_id === metric.sourceSchemaId
            )
            .map(entity => ({ kind: 'entity' as const, entity }))
        : [];
    const sourceTerminalsFiltered = sourceTerminals.filter(terminal =>
      terminal.kind === 'entity' ? isFilterMatch(terminal.entity) : true
    );
    const sourceCount = sourceTerminalsFiltered.length;
    const duplicateCount = traversal?.duplicateCount ?? 0;

    if (isEnumSourceKind(metric.source.kind)) {
      const source = metric.source as Extract<
        MetricConfig['source'],
        { kind: 'enum' | 'assessmentEnum' }
      >;
      const values = sourceTerminalsFiltered
        .map(terminal =>
          extractEnumValue(
            terminal.kind === 'entity' ? terminal.entity : terminal.relation,
            source,
            responsesByEntity,
            terminal.kind === 'entity' ? sourceSchema : terminal.schema,
            authCtx
          )
        )
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
        value: sourceCount,
        lifecycleId: null,
        dominantValue,
        dominantLabel,
        distribution,
        sourceCount,
        populatedCount: values.length,
        duplicateCount
      };
    }

    if (metric.aggregation === 'count') {
      return {
        boxEntityId,
        value: sourceCount,
        lifecycleId: null,
        dominantValue: null,
        dominantLabel: null,
        distribution: [],
        sourceCount,
        populatedCount: sourceCount,
        duplicateCount
      };
    }

    const populated = sourceTerminalsFiltered
      .map(terminal =>
        extractValue(
          terminal.kind === 'entity' ? terminal.entity : terminal.relation,
          metric.source,
          lifecycleSortOrder,
          responsesByEntity,
          terminal.kind === 'entity' ? sourceSchema : terminal.schema,
          authCtx
        )
      )
      .filter((v): v is MetricValue => v != null);
    const isCurrency = isCurrencyFieldSource(metric, sourceSchema);
    const normalized =
      isCurrency && currencyConversion
        ? populated.map(value => {
            const sourceCurrency = value.currencyCode?.toUpperCase();
            const sourceRate =
              sourceCurrency == null ? undefined : currencyConversion.rates[sourceCurrency];
            const targetRate = currencyConversion.rates[currencyConversion.targetCurrency];
            httpAssert.true(sourceRate != null && sourceRate > 0, {
              status: 422,
              message: `No exchange rate is available for '${sourceCurrency ?? 'unknown'}'`
            });
            httpAssert.true(targetRate != null && targetRate > 0, {
              status: 422,
              message: `No exchange rate is available for '${currencyConversion.targetCurrency}'`
            });
            const resolvedSourceRate = sourceRate as number;
            const resolvedTargetRate = targetRate as number;
            return {
              ...value,
              value: (value.value * resolvedTargetRate) / resolvedSourceRate,
              currencyCode: currencyConversion.targetCurrency
            };
          })
        : populated;
    const { value, lifecycleId } = aggregate(normalized, metric.aggregation, worstDirection);
    const currencyMetadata = isCurrency
      ? currencyConversion
        ? {
            currencyCode: currencyConversion.targetCurrency,
            currencyMixed: false,
            currencyRateDate: currencyConversion.rateDate
          }
        : getCurrencyMetadata(populated)
      : null;

    return {
      boxEntityId,
      value,
      lifecycleId,
      dominantValue: null,
      dominantLabel: null,
      distribution: [],
      sourceCount,
      populatedCount: populated.length,
      duplicateCount,
      ...(currencyMetadata ?? {})
    };
  });

  const numericValues = results.map(r => r.value).filter((v): v is number => v != null);
  const currencyResults = results.filter(
    result => result.currencyCode !== undefined || result.currencyMixed !== undefined
  );
  const currencyCodes = new Set(
    currencyResults
      .map(result => result.currencyCode)
      .filter((currency): currency is string => currency != null)
  );
  const currencyMetadata =
    currencyResults.length > 0
      ? {
          currencyCode:
            currencyResults.some(result => result.currencyMixed) || currencyCodes.size !== 1
              ? null
              : [...currencyCodes][0]!,
          currencyMixed:
            currencyResults.some(result => result.currencyMixed) || currencyCodes.size > 1,
          currencyRateDate:
            currencyResults.find(result => result.currencyRateDate != null)?.currencyRateDate ??
            null
        }
      : null;
  return {
    results,
    legend: {
      min: numericValues.length > 0 ? Math.min(...numericValues) : null,
      max: numericValues.length > 0 ? Math.max(...numericValues) : null,
      ...(currencyMetadata ?? {}),
      ...(enumOptions ? { categories: enumOptions } : {})
    }
  };
};

const resolveEnumOptions = async (
  db: DatabaseAdapter,
  workspace: string,
  metric: MetricConfig,
  schemas: SchemaDbResult[],
  relationSchemas: RelationSchemaDbResult[],
  joinedAssessment: Awaited<ReturnType<typeof resolveJoinedAssessment>>
): Promise<EnumOption[] | null> => {
  const source = metric.source;
  if (!isEnumSourceKind(source.kind)) return null;

  let enumId: string | undefined;
  let inlineOptions: EnumOption[] | undefined;
  if (source.kind === 'enum') {
    const fieldId = source.fieldId;
    const schema =
      metric.sourceContext === 'relation'
        ? relationSchemas.find(s => s.id === metric.sourceSchemaId)
        : schemas.find(s => s.id === metric.sourceSchemaId);
    const field = schema?.fields.find(f => f.id === fieldId);
    if (field?.type !== 'select') return null;
    enumId = field.enumId;
  } else if (source.kind === 'assessmentEnum') {
    httpAssert.present(joinedAssessment, {
      status: 400,
      message: 'Metric requires an assessment source, but no assessment is joined'
    });
    const fieldId = source.fieldId;
    const field = joinedAssessment.assessment.fields.find(f => f.id === fieldId);
    if (field?.type !== 'enum') return null;
    inlineOptions = getInlineAssessmentEnumOptions(field);
    enumId = 'enumId' in field ? field.enumId : undefined;
  } else {
    return null;
  }

  if (inlineOptions) return inlineOptions;
  httpAssert.present(enumId, {
    status: 400,
    message: 'Assessment enum field has no option source'
  });
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
    entityQuery?: EntityQuery | null;
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
    entityQuery = null,
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

  const requestParams = {
    entityQuery: entityQuery ?? undefined,
    _schemaId: schemaId ?? undefined,
    owner: owner ?? undefined,
    lifecycle: lifecycle ?? undefined,
    q: q ?? undefined,
    conditions,
    assessmentId: assessmentId ?? undefined,
    projectId: projectId ?? undefined,
    projectScope
  };
  const parsed = parseEntityQuery(requestParams);
  const query = buildEntityQueryForExecution(requestParams, parsed);
  httpAssert.present(query, { status: 400, message: 'Unable to build entity query' });

  const needsAssessment =
    metric.source.kind === 'assessmentRating' || metric.source.kind === 'assessmentEnum';

  const relationSchemasPromise = db.relation?.listRelationSchemas
    ? db.relation.listRelationSchemas(workspace)
    : Promise.resolve<RelationSchemaDbResult[]>([]);
  const [
    schemas,
    relationSchemas,
    allEntities,
    lifecycleStates,
    joinedAssessment,
    projectEntities
  ] = await Promise.all([
    db.catalog.listSchemas(workspace),
    relationSchemasPromise,
    listAllCatalogEntities(db, workspace, projectId ? { projectId, projectScope } : undefined),
    db.workspace.listLifecycleStates(workspace),
    resolveJoinedAssessment(db, workspace, authCtx, parsed.assessmentId, needsAssessment),
    projectId ? db.project.listProjectEntities(workspace, projectId) : Promise.resolve([])
  ]);

  if (metric.source.kind === 'assessmentRating') {
    httpAssert.present(joinedAssessment, {
      status: 400,
      message: 'Metric requires an assessment source, but no assessment is joined'
    });
  }

  if (metric.source.kind === 'assessmentEnum') {
    httpAssert.present(joinedAssessment, {
      status: 400,
      message: 'Metric requires an assessment source, but no assessment is joined'
    });
  }

  const sourceAvailable = isMetricSourceAvailable(
    metric,
    schemas,
    joinedAssessment?.assessment.fields,
    relationSchemas
  );
  const sourceSchema =
    metric.sourceContext === 'relation'
      ? relationSchemas.find(schema => schema.id === metric.sourceSchemaId)
      : schemas.find(schema => schema.id === metric.sourceSchemaId);
  const currencySource = isCurrencyFieldSource(metric, sourceSchema);
  httpAssert.true(
    metric.targetCurrency == null || (currencySource && metric.aggregation !== 'count'),
    {
      status: 400,
      message: 'targetCurrency is only valid for non-count currency field metrics'
    }
  );
  const enumOptions = sourceAvailable
    ? await resolveEnumOptions(db, workspace, metric, schemas, relationSchemas, joinedAssessment)
    : null;

  const visibleEntities = filterVisibleEntities(authCtx, allEntities);
  const scopedEntities = visibleEntities;
  let currencyConversion: CurrencyConversion | null = null;
  if (currencySource && metric.aggregation !== 'count') {
    const currencyConfig = await db.workspace.getSupportedCurrencies(workspace);
    const targetCurrency = metric.targetCurrency ?? currencyConfig.default_currency;
    httpAssert.true(
      currencyConfig.currencies.some(currency => currency.code === targetCurrency),
      { status: 400, message: `Currency '${targetCurrency}' is not supported by this workspace` }
    );
    const snapshot: CurrencyRateSnapshotDbResult | null =
      await db.currencyRates.getLatestSnapshot();
    httpAssert.present(snapshot, {
      status: 503,
      message: 'Currency rates are not available yet; please try again after the daily refresh'
    });
    currencyConversion = {
      targetCurrency,
      rateDate: snapshot.rate_date,
      rates: snapshot.rates
    };
  }

  const matchIds = new Set(
    (
      await collectEntitiesFromIR(
        db,
        workspace,
        authCtx,
        normalizeEntityQueryOptions({
          entityQuery: query,
          projectId,
          projectScope,
          view: 'summary'
        }),
        schemas,
        projectEntities,
        null
      )
    ).map(row => row.entity._uid)
  );

  const isFilterMatch = (entity: EntityDbResult): boolean => matchIds.has(entity.id);

  const traversalResults = sourceAvailable
    ? await collectMetricTerminals({
        db,
        workspace,
        boxEntityIds,
        metric,
        entities: scopedEntities,
        schemas,
        relationSchemas,
        authCtx
      })
    : new Map<string, MetricTraversalResult>();

  return computeBoxMetrics(
    boxEntityIds,
    metric,
    scopedEntities,
    schemas,
    lifecycleStates,
    joinedAssessment?.responsesByEntity ?? null,
    isFilterMatch,
    enumOptions,
    authCtx,
    sourceAvailable,
    currencyConversion,
    traversalResults
  );
};
