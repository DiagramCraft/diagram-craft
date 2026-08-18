import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type {
  MetricAggregation,
  MetricConfig,
  MetricSource,
  MetricTraversalStep
} from '@arch-register/api-types/metricContract';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import type { FieldGroupAccess, FieldGroupAccessControl } from '@arch-register/permissions';
import type { JoinedAssessmentContext } from './entityFieldSources';

const FILTER_OPS = [
  'equals',
  'not_equals',
  'contains',
  'starts_with',
  'ends_with',
  'empty',
  'not_empty',
  'before',
  'after',
  'on',
  'gt',
  'lt',
  'gte',
  'lte'
];

const parseFilterCondition = (raw: unknown): FilterCondition | undefined => {
  if (raw == null || typeof raw !== 'object') return undefined;
  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.fieldId !== 'string' || typeof candidate.op !== 'string') return undefined;
  if (!FILTER_OPS.includes(candidate.op)) return undefined;
  return {
    fieldId: candidate.fieldId,
    op: candidate.op,
    value: candidate.value
  } as FilterCondition;
};

// `MapConfig.metricConfig` is stored as `unknown` in the saved-view config schema (the web app
// doesn't depend on zod directly - see entityViewConfig.ts), so it's parsed structurally here
// rather than via a shared zod schema, matching that established pattern.
export const parseMetricConfig = (raw: unknown): MetricConfig | null => {
  if (raw == null || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;
  const sourceSchemaId = candidate.sourceSchemaId;
  const sourceContext = candidate.sourceContext;
  const path = candidate.path;
  const aggregation = candidate.aggregation;
  const source = candidate.source as Record<string, unknown> | undefined;
  if (typeof sourceSchemaId !== 'string' || typeof aggregation !== 'string' || !source) {
    return null;
  }
  if (
    !['count', 'sum', 'average', 'minimum', 'maximum', 'worst', 'percentage'].includes(
      aggregation
    ) ||
    typeof source.kind !== 'string' ||
    !['field', 'assessmentRating', 'lifecycle', 'enum', 'assessmentEnum'].includes(source.kind)
  ) {
    return null;
  }
  if (source.kind !== 'lifecycle' && typeof source.fieldId !== 'string') return null;
  const worstDirection = candidate.worstDirection;
  const targetCurrency = candidate.targetCurrency;
  const numeratorCondition = parseFilterCondition(candidate.numeratorCondition);
  const parsedPath = Array.isArray(path)
    ? (path.filter(step => {
        if (step == null || typeof step !== 'object') return false;
        const candidateStep = step as Record<string, unknown>;
        if (candidateStep.kind === 'relation') {
          return (
            typeof candidateStep.fieldId === 'string' &&
            (candidateStep.direction === 'forward' || candidateStep.direction === 'backward')
          );
        }
        return (
          (candidateStep.kind === 'typedRelation' &&
            typeof candidateStep.fieldId === 'string' &&
            typeof candidateStep.relationSchemaId === 'string' &&
            (candidateStep.direction === 'in' || candidateStep.direction === 'out')) ||
          (candidateStep.kind === 'unboundTypedRelation' &&
            typeof candidateStep.relationSchemaId === 'string' &&
            (candidateStep.direction === 'in' ||
              candidateStep.direction === 'out' ||
              candidateStep.direction === 'both'))
        );
      }) as MetricTraversalStep[])
    : undefined;
  return {
    sourceSchemaId,
    source: source as MetricSource,
    aggregation: aggregation as MetricAggregation,
    ...(sourceContext === 'entity' || sourceContext === 'relation' ? { sourceContext } : {}),
    ...(parsedPath ? { path: parsedPath } : {}),
    ...(worstDirection === 'low' || worstDirection === 'high' ? { worstDirection } : {}),
    ...(typeof targetCurrency === 'string' && /^[A-Z]{3}$/.test(targetCurrency)
      ? { targetCurrency }
      : {}),
    ...(numeratorCondition ? { numeratorCondition } : {})
  };
};

export type MetricSourceOption = {
  source: MetricSource;
  label: string;
};

export type MetricPathOption = {
  step: MetricTraversalStep;
  label: string;
  targetSchemaIds: string[];
};

/**
 * Selectable metric sources for `schema`'s descendants: numeric/currency/select fields, lifecycle,
 * and (if joined) assessment rating/enum fields. Fields in a group the caller cannot view are
 * omitted - pass `useWorkspaceAuthorization(workspaceId).getFieldGroupAccess`, matching
 * `FilterBuilder`.
 */
export const getMetricSourceOptions = (
  schema: EntitySchema | RelationSchema | undefined,
  joinedAssessment?: JoinedAssessmentContext | null,
  getFieldGroupAccess: (
    accessControl: FieldGroupAccessControl | undefined
  ) => FieldGroupAccess = () => 'edit',
  sourceContext: 'entity' | 'relation' = 'entity'
): MetricSourceOption[] => {
  if (!schema) return [];
  const options: MetricSourceOption[] = [{ source: { kind: 'lifecycle' }, label: 'Lifecycle' }];
  for (const field of schema.fields) {
    if (field.groupId) {
      const group = schema.groups?.find(g => g.id === field.groupId);
      if (getFieldGroupAccess(group?.accessControl) === 'none') continue;
    }
    if (
      field.type === 'number' ||
      field.type === 'currency' ||
      (field.type === 'derived' &&
        (field.resultType === 'number' || field.resultType === 'currency'))
    ) {
      options.push({ source: { kind: 'field', fieldId: field.id }, label: field.name });
    } else if (field.type === 'select') {
      options.push({ source: { kind: 'enum', fieldId: field.id }, label: field.name });
    }
  }
  if (joinedAssessment && sourceContext === 'entity') {
    for (const field of joinedAssessment.assessment.fields) {
      if (field.type === 'rating') {
        options.push({
          source: { kind: 'assessmentRating', fieldId: field.id },
          label: `${field.label} (assessment)`
        });
      } else if (field.type === 'enum') {
        options.push({
          source: { kind: 'assessmentEnum', fieldId: field.id },
          label: `${field.label} (assessment)`
        });
      }
    }
  }
  return options;
};

export const getMetricPathOptions = (
  schema: EntitySchema | undefined,
  relationSchemas: RelationSchema[],
  getFieldGroupAccess: (
    accessControl: FieldGroupAccessControl | undefined
  ) => FieldGroupAccess = () => 'edit',
  entitySchemas: EntitySchema[] = schema ? [schema] : []
): MetricPathOption[] => {
  if (!schema) return [];
  const relationSchemaById = new Map(relationSchemas.map(candidate => [candidate.id, candidate]));
  const options: MetricPathOption[] = [];

  const addGenericRelationOption = (
    field: Extract<EntitySchema['fields'][number], { type: 'reference' | 'containment' }>,
    direction: 'forward' | 'backward',
    ownerSchemaId?: string
  ) => {
    options.push({
      step: {
        kind: 'relation',
        fieldId: field.id,
        direction,
        ...(ownerSchemaId == null ? {} : { ownerSchemaId })
      },
      label:
        direction === 'forward'
          ? `${field.name} → ${field.schemaId}`
          : `${field.name} ← ${ownerSchemaId ?? 'related schema'}`,
      targetSchemaIds: direction === 'forward' ? [field.schemaId] : [ownerSchemaId ?? '']
    });
  };

  for (const field of schema.fields) {
    if (field.groupId) {
      const group = schema.groups?.find(candidate => candidate.id === field.groupId);
      if (getFieldGroupAccess(group?.accessControl) === 'none') continue;
    }
    if (field.type === 'reference' || field.type === 'containment') {
      addGenericRelationOption(field, 'forward');
    } else if (field.type === 'typedRelation') {
      const relationSchema = relationSchemaById.get(field.relationSchemaId);
      const endpointSchemaIds =
        field.direction === 'in' ? relationSchema?.out.schemaIds : relationSchema?.in.schemaIds;
      const targetSchemaIds =
        endpointSchemaIds === 'any'
          ? entitySchemas.map(candidate => candidate.id)
          : (endpointSchemaIds ?? []);
      options.push({
        step: {
          kind: 'typedRelation',
          fieldId: field.id,
          relationSchemaId: field.relationSchemaId,
          direction: field.direction
        },
        label: `${field.name} → ${relationSchema?.name ?? field.relationSchemaId}`,
        targetSchemaIds
      });
    }
  }

  // A relation schema can be traversed even when the current endpoint has no typed-relation
  // projection field. Keep this as an explicit relation-schema hop so similarly-shaped relation
  // schemas are never guessed or merged together.
  for (const relationSchema of relationSchemas) {
    const directions = (['in', 'out'] as const).filter(direction => {
      const endpoint = direction === 'in' ? relationSchema.in : relationSchema.out;
      const endpointSchemaIds =
        endpoint.schemaIds === 'any'
          ? entitySchemas.map(candidate => candidate.id)
          : endpoint.schemaIds;
      if (!endpointSchemaIds.includes(schema.id)) return false;
      const matchingFields = schema.fields.filter(
        field =>
          field.type === 'typedRelation' &&
          field.relationSchemaId === relationSchema.id &&
          field.direction === direction
      );
      if (matchingFields.length === 0) return true;
      return matchingFields.some(field => {
        const group = field.groupId
          ? schema.groups?.find(candidate => candidate.id === field.groupId)
          : undefined;
        return getFieldGroupAccess(group?.accessControl) !== 'none';
      });
    });
    if (directions.length === 0) continue;
    const direction = directions.length === 2 ? 'both' : directions[0]!;
    const targetSchemaIds = [
      ...new Set(
        directions.flatMap(currentDirection => {
          const endpoint = currentDirection === 'in' ? relationSchema.out : relationSchema.in;
          return endpoint.schemaIds === 'any'
            ? entitySchemas.map(candidate => candidate.id)
            : endpoint.schemaIds;
        })
      )
    ];
    options.push({
      step: {
        kind: 'unboundTypedRelation',
        relationSchemaId: relationSchema.id,
        direction
      },
      label: `${relationSchema.name} → related schema`,
      targetSchemaIds
    });
  }

  // Reference and containment fields are stored on the related schema in the common
  // child-to-parent shape. Offer the reverse hop so a Domain map can reach its Systems and
  // continue along a typed relation to Contracts.
  for (const ownerSchema of entitySchemas) {
    for (const field of ownerSchema.fields) {
      if (
        (field.type === 'reference' || field.type === 'containment') &&
        field.schemaId === schema.id
      ) {
        if (field.groupId) {
          const group = ownerSchema.groups?.find(candidate => candidate.id === field.groupId);
          if (getFieldGroupAccess(group?.accessControl) === 'none') continue;
        }
        addGenericRelationOption(field, 'backward', ownerSchema.id);
      }
    }
  }
  return options.sort((a, b) => a.label.localeCompare(b.label));
};

export const sourceKey = (source: MetricSource): string =>
  source.kind === 'lifecycle' ? 'lifecycle' : `${source.kind}:${source.fieldId}`;

export const isEnumSource = (source: MetricSource): boolean =>
  source.kind === 'enum' || source.kind === 'assessmentEnum';

export const isCurrencyMetric = (
  metric: MetricConfig,
  schema: EntitySchema | RelationSchema | undefined
): boolean => {
  if (metric.source.kind !== 'field' || metric.aggregation === 'count') return false;
  const fieldId = metric.source.fieldId;
  return (
    schema?.fields.some(
      field =>
        field.id === fieldId &&
        (field.type === 'currency' || (field.type === 'derived' && field.resultType === 'currency'))
    ) === true
  );
};

export const AGGREGATION_OPTIONS: { value: MetricAggregation; label: string }[] = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'average', label: 'Average' },
  { value: 'minimum', label: 'Minimum' },
  { value: 'maximum', label: 'Maximum' },
  { value: 'worst', label: 'Worst' },
  { value: 'percentage', label: 'Percentage' }
];
