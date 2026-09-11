import type { PathStep } from '@arch-register/api-types/entityQueryIR';
import type { MetricConfig, MetricTraversalStep } from '@arch-register/api-types/metricContract';
import type { AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import type { RelationDbResult, RelationSchemaDbResult } from '../catalog/db/relationDatabase';
import {
  executeEntityTraversal,
  type EntityTraversalPath,
  type EntityTraversalSourceField,
  type EntityTraversalResult,
  type EntityTraversalTerminal
} from '../catalog/entityTraversal';
import { isFieldViewRestricted } from '../auth/fieldGroupAccessControl';
import type { MetricTerminal, MetricTraversalResult } from './metricTraversal';

const syntheticDate = new Date(0);

const allTypedRelationOwners = (
  step: Extract<MetricTraversalStep, { kind: 'typedRelation' }>,
  schemas: SchemaDbResult[],
  authCtx: AuthorizationContext | null
): string[] =>
  schemas
    .filter(schema =>
      schema.fields.some(
        field =>
          field.type === 'typedRelation' &&
          field.id === step.fieldId &&
          field.relationSchemaId === step.relationSchemaId &&
          field.direction === step.direction &&
          !isFieldViewRestricted(authCtx, schema, field.id)
      )
    )
    .map(schema => schema.id);

const legacyStepToPathStep = (
  step: MetricTraversalStep,
  schemas: SchemaDbResult[],
  authCtx: AuthorizationContext | null
): PathStep => {
  if (step.kind === 'relation') {
    return step.direction === 'forward'
      ? { kind: 'forward', fieldId: step.fieldId }
      : {
          kind: 'backward',
          fieldId: step.fieldId,
          ownerSchemaId: step.ownerSchemaId ?? schemas[0]?.id ?? ''
        };
  }
  if (step.kind === 'typedRelation') {
    return {
      kind: 'typedRelation',
      fieldId: step.fieldId,
      relationSchemaId: step.relationSchemaId,
      direction: step.direction,
      ownerSchemaIds: allTypedRelationOwners(step, schemas, authCtx)
    };
  }
  return {
    kind: 'unboundTypedRelation',
    relationSchemaId: step.relationSchemaId,
    direction: step.direction
  };
};

const metricPathSteps = (
  metric: MetricConfig,
  schemas: SchemaDbResult[],
  authCtx: AuthorizationContext | null
): PathStep[] | null => {
  if (metric.traversalPath) return metric.traversalPath;
  if (metric.path) return metric.path.map(step => legacyStepToPathStep(step, schemas, authCtx));
  return null;
};

const sourceFields = (metric: MetricConfig): EntityTraversalPath['sourceFields'] => {
  const fields: EntityTraversalSourceField[] = [];
  const sourceContext = metric.sourceContext ?? 'entity';
  if (metric.source.kind === 'lifecycle') {
    fields.push({ context: sourceContext, fieldId: '_lifecycle' });
  } else if (metric.source.kind === 'assessmentRating' || metric.source.kind === 'assessmentEnum') {
    fields.push({ context: 'entity', fieldId: `_assessment:${metric.source.fieldId}` });
  } else {
    fields.push({ context: sourceContext, fieldId: metric.source.fieldId });
  }
  if (metric.aggregation === 'leafCount' && sourceContext === 'entity') {
    fields.push({ context: 'entity', fieldId: '_isLeaf' });
  }
  if (metric.aggregation === 'percentage' && metric.numeratorCondition) {
    fields.push({
      context: 'entity',
      fieldId: metric.numeratorCondition.fieldId,
      alias: `__numerator:${metric.numeratorCondition.fieldId}`
    });
  }
  return fields;
};

const pathFor = (id: string, steps: PathStep[], metric: MetricConfig): EntityTraversalPath => ({
  id,
  steps,
  terminalContext: metric.sourceContext ?? 'entity',
  sourceFields: sourceFields(metric)
});

const identity = (terminal: EntityTraversalTerminal): string =>
  `${terminal.context}:${terminal.id}`;

const syntheticEntity = (terminal: EntityTraversalTerminal): EntityDbResult => {
  const source = terminal.source;
  const data = Object.fromEntries(
    Object.entries(source).map(([key, value]) => [
      key.startsWith('_assessment:')
        ? key.slice('_assessment:'.length)
        : key.startsWith('__numerator:')
          ? key.slice('__numerator:'.length)
          : key,
      value
    ])
  );
  const numeratorValue = (fieldId: string): unknown =>
    source[`__numerator:${fieldId}`] ?? source[fieldId];
  return {
    id: terminal.id,
    workspace: '',
    public_id: '',
    slug: String(source._slug ?? numeratorValue('_slug') ?? ''),
    namespace: String(source._namespace ?? numeratorValue('_namespace') ?? ''),
    name: String(source._name ?? numeratorValue('_name') ?? ''),
    description: String(source._description ?? numeratorValue('_description') ?? ''),
    owner: ((source._owner ?? numeratorValue('_owner')) as string | null | undefined) ?? null,
    lifecycle:
      ((source._lifecycle ?? numeratorValue('_lifecycle')) as string | null | undefined) ?? null,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: Array.isArray(source._tags ?? numeratorValue('_tags'))
      ? ((source._tags ?? numeratorValue('_tags')) as string[])
      : [],
    links: Array.isArray(source._links) ? source._links : [],
    schema_id: terminal.schemaId,
    data,
    project_id: null,
    created_at: syntheticDate,
    updated_at: syntheticDate,
    completeness: Number(source._completeness ?? numeratorValue('_completeness') ?? 0),
    owner_name: null,
    lifecycle_label: null,
    target_lifecycle_label: null,
    schema_name: ''
  };
};

const syntheticRelation = (
  terminal: EntityTraversalTerminal,
  relationSchemas: RelationSchemaDbResult[]
): { relation: RelationDbResult; schema: RelationSchemaDbResult } | null => {
  const schema = relationSchemas.find(candidate => candidate.id === terminal.schemaId);
  if (!schema) return null;
  const source = terminal.source;
  return {
    schema,
    relation: {
      id: terminal.id,
      workspace: '',
      schema_id: terminal.schemaId,
      schema_name: schema.name,
      in_entity_id: String(source._inEntityId ?? ''),
      in_entity_name: '',
      out_entity_id: String(source._outEntityId ?? ''),
      out_entity_name: '',
      data: source,
      owner: (source._owner as string | null | undefined) ?? null,
      owner_name: null,
      lifecycle: (source._lifecycle as string | null | undefined) ?? null,
      lifecycle_label: null,
      version: 1,
      approval_policy_override: null,
      created_at: syntheticDate,
      updated_at: syntheticDate
    }
  };
};

const terminalToMetricTerminal = (
  terminal: EntityTraversalTerminal,
  relationSchemas: RelationSchemaDbResult[]
): MetricTerminal | null => {
  if (terminal.context === 'entity') {
    const entity = syntheticEntity(terminal);
    return {
      kind: 'entity',
      entity,
      isLeaf: terminal.source._isLeaf === true || terminal.source._isLeaf === 1
    };
  }
  const relation = syntheticRelation(terminal, relationSchemas);
  return relation ? { kind: 'relation', ...relation } : null;
};

const emptyResult = (): MetricTraversalResult => ({ terminals: [], duplicateCount: 0 });

const selectTerminals = (
  traversal: EntityTraversalResult,
  boxId: string,
  metric: MetricConfig,
  relationSchemas: RelationSchemaDbResult[]
): MetricTraversalResult => {
  const root = traversal.roots.find(candidate => candidate.rootId === boxId);
  if (!root) return emptyResult();
  const pathResults = root.paths;
  const terminals: MetricTerminal[] = [];
  const seen = new Set<string>();
  let occurrenceCount = 0;
  for (const path of pathResults) {
    for (const occurrence of path.occurrences) {
      const terminal = occurrence.terminal;
      if (
        terminal.schemaId !== metric.sourceSchemaId ||
        (metric.traversalPath == null && metric.path == null && terminal.id === boxId)
      ) {
        continue;
      }
      occurrenceCount += 1;
      const converted = terminalToMetricTerminal(terminal, relationSchemas);
      if (!converted) continue;
      const key = identity(terminal);
      if (!seen.has(key)) {
        seen.add(key);
        terminals.push(converted);
      }
    }
  }
  return {
    terminals,
    duplicateCount:
      metric.traversalPath == null && metric.path == null
        ? 0
        : Math.max(0, occurrenceCount - terminals.length)
  };
};

export const buildMetricTraversalPlan = (
  boxEntityIds: string[],
  metric: MetricConfig,
  schemas: SchemaDbResult[],
  authCtx: AuthorizationContext | null,
  scope: Pick<EntityTraversalRootScope, 'assessmentId' | 'projectId' | 'projectScope'>
): {
  root: { kind: 'ids'; entityIds: readonly string[]; scope: typeof scope };
  paths: EntityTraversalPath[];
} => {
  const steps = metricPathSteps(metric, schemas, authCtx);
  const paths: EntityTraversalPath[] = [];
  if (!steps || steps.length === 0) {
    paths.push(
      pathFor(
        '__metric_containment',
        [{ kind: 'containmentSubtree', fieldId: '*', ownerSchemaId: '*' }],
        metric
      )
    );
  } else if (
    (metric.traversalPathMode ?? (metric.traversalPath ? 'exact' : 'suffixes')) === 'suffixes'
  ) {
    steps.forEach((_, index) =>
      paths.push(pathFor(`__metric_path_${index}`, steps.slice(index), metric))
    );
  } else {
    paths.push(pathFor('__metric_path', steps, metric));
  }
  return { root: { kind: 'ids', entityIds: boxEntityIds, scope }, paths };
};

type EntityTraversalRootScope = {
  assessmentId?: string;
  projectId?: string;
  projectScope?: 'project' | 'all';
};

export const collectMetricTraversalResults = async (options: {
  db: DatabaseAdapter;
  workspace: string;
  boxEntityIds: string[];
  metric: MetricConfig;
  schemas: SchemaDbResult[];
  relationSchemas: RelationSchemaDbResult[];
  authCtx: AuthorizationContext | null;
  assessmentId?: string | null;
  projectId?: string | null;
  projectScope?: 'project' | 'all';
}): Promise<Map<string, MetricTraversalResult>> => {
  if (
    options.metric.sourceContext === 'relation' &&
    options.metric.traversalPath == null &&
    options.metric.path == null
  ) {
    return new Map(options.boxEntityIds.map(boxId => [boxId, emptyResult()]));
  }
  const plan = buildMetricTraversalPlan(
    options.boxEntityIds,
    options.metric,
    options.schemas,
    options.authCtx,
    {
      ...(options.assessmentId ? { assessmentId: options.assessmentId } : {}),
      ...(options.projectId ? { projectId: options.projectId } : {}),
      projectScope: options.projectScope
    }
  );
  const traversal = await executeEntityTraversal(
    options.db,
    options.workspace,
    options.authCtx,
    plan
  );
  return new Map(
    options.boxEntityIds.map(boxId => [
      boxId,
      selectTerminals(traversal, boxId, options.metric, options.relationSchemas)
    ])
  );
};
