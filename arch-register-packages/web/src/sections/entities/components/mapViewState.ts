import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { MetricTraversalStep } from '@arch-register/api-types/metricContract';
import type { TreeEdge, TreeNode } from '@arch-register/api-types/entityContract';

export type ContainmentTreeIndex = {
  nodeMap: Map<string, TreeNode>;
  childrenOf: Map<string, string[]>;
};

export const getMapSchemaIds = (cfg: {
  levels: number;
  level1SchemaId: string | null;
  level2SchemaId?: string | null;
  level3SchemaId?: string | null;
}): string[] => [
  ...new Set(
    [cfg.level1SchemaId, cfg.level2SchemaId, cfg.level3SchemaId]
      .slice(0, cfg.levels)
      .filter((id): id is string => !!id)
  )
];

export const getChildSchemas = (
  schemas: EntitySchema[],
  parentSchemaId: string | null,
  relationSchemas: RelationSchema[] = []
): EntitySchema[] => {
  if (!parentSchemaId) return schemas;
  const relationSchemaById = new Map(relationSchemas.map(schema => [schema.id, schema]));
  const parentSchema = schemas.find(schema => schema.id === parentSchemaId);
  const typedRelationTargets = (schema: EntitySchema) =>
    schema.fields.flatMap(field => {
      if (field.type !== 'typedRelation') return [];
      const relationSchema = relationSchemaById.get(field.relationSchemaId);
      return field.direction === 'out'
        ? (relationSchema?.out.schemaIds ?? [])
        : (relationSchema?.in.schemaIds ?? []);
    });
  const parentTypedRelationTargets = parentSchema ? typedRelationTargets(parentSchema) : [];
  return schemas.filter(schema => {
    const hasContainment = schema.fields.some(
      field =>
        (field.type === 'containment' || field.type === 'reference') &&
        field.schemaId === parentSchemaId
    );
    const hasTypedRelation =
      parentTypedRelationTargets.includes(schema.id) ||
      typedRelationTargets(schema).includes(parentSchemaId);
    return hasContainment || hasTypedRelation;
  });
};

export const getChildRelationSchemas = (
  schemas: EntitySchema[],
  parentSchemaId: string | null,
  relationSchemas: RelationSchema[]
): RelationSchema[] => {
  if (!parentSchemaId) return [];
  const parentSchema = schemas.find(schema => schema.id === parentSchemaId);
  if (!parentSchema) return [];
  const relationSchemaIds = new Set(
    parentSchema.fields.flatMap(field =>
      field.type === 'typedRelation' ? [field.relationSchemaId] : []
    )
  );
  return relationSchemas.filter(schema => relationSchemaIds.has(schema.id));
};

const findTraversalStep = (
  parentSchema: EntitySchema | undefined,
  childSchema: EntitySchema,
  relationSchemas: RelationSchema[]
): MetricTraversalStep | null => {
  if (!parentSchema) return null;

  const forwardField = parentSchema.fields.find(
    field =>
      (field.type === 'containment' || field.type === 'reference') &&
      field.schemaId === childSchema.id
  );
  if (forwardField) {
    return { kind: 'relation', fieldId: forwardField.id, direction: 'forward' };
  }

  const backwardField = childSchema.fields.find(
    field =>
      (field.type === 'containment' || field.type === 'reference') &&
      field.schemaId === parentSchema.id
  );
  if (backwardField) {
    return {
      kind: 'relation',
      fieldId: backwardField.id,
      direction: 'backward',
      ownerSchemaId: childSchema.id
    };
  }

  const relationSchemaById = new Map(relationSchemas.map(schema => [schema.id, schema]));
  const typedField = parentSchema.fields.find(field => {
    if (field.type !== 'typedRelation') return false;
    const relationSchema = relationSchemaById.get(field.relationSchemaId);
    const targetSchemaIds =
      field.direction === 'out'
        ? (relationSchema?.out.schemaIds ?? [])
        : (relationSchema?.in.schemaIds ?? []);
    return targetSchemaIds.includes(childSchema.id);
  });
  if (typedField?.type === 'typedRelation') {
    return {
      kind: 'typedRelation',
      fieldId: typedField.id,
      relationSchemaId: typedField.relationSchemaId,
      direction: typedField.direction
    };
  }

  return null;
};

export const getMapTraversalPath = (
  schemaIds: string[],
  schemas: EntitySchema[],
  relationSchemas: RelationSchema[]
): MetricTraversalStep[] => {
  const schemaById = new Map(schemas.map(schema => [schema.id, schema]));
  const relationSchemaById = new Map(relationSchemas.map(schema => [schema.id, schema]));
  const path: MetricTraversalStep[] = [];
  for (let index = 1; index < schemaIds.length; index += 1) {
    const childSchemaId = schemaIds[index]!;
    const parentSchemaId = schemaIds[index - 1]!;
    const childSchema = schemaById.get(childSchemaId);
    const parentSchema = schemaById.get(parentSchemaId);
    if (!parentSchema) return [];
    if (!childSchema && relationSchemaById.has(childSchemaId)) {
      const field = parentSchema.fields.find(
        candidate =>
          candidate.type === 'typedRelation' && candidate.relationSchemaId === childSchemaId
      );
      if (field?.type !== 'typedRelation') return [];
      path.push({
        kind: 'typedRelation',
        fieldId: field.id,
        relationSchemaId: field.relationSchemaId,
        direction: field.direction
      });
      continue;
    }
    if (!childSchema) return [];
    const step = findTraversalStep(parentSchema, childSchema, relationSchemas);
    if (!step) return [];
    path.push(step);
  }
  return path;
};

export const buildContainmentTreeIndex = (
  nodes: TreeNode[],
  edges: TreeEdge[]
): ContainmentTreeIndex => {
  const nodeMap = new Map<string, TreeNode>();
  for (const node of nodes) nodeMap.set(node._uid, node);

  const childrenOf = new Map<string, string[]>();
  for (const { childId, parentId } of edges) {
    const children = childrenOf.get(parentId) ?? [];
    children.push(childId);
    childrenOf.set(parentId, children);
  }
  return { nodeMap, childrenOf };
};

const nodeName = (node: TreeNode) => node._name ?? node._slug;

export const sortContainmentNodes = (nodes: TreeNode[], schemaId: string | null): TreeNode[] =>
  nodes
    .filter(node => node._schema.id === schemaId && node._isMatch)
    .sort((a, b) => nodeName(a).localeCompare(nodeName(b)));

export const getContainmentChildren = (
  parentUid: string,
  schemaId: string | null,
  index: ContainmentTreeIndex
): TreeNode[] => {
  if (!schemaId) return [];
  return sortContainmentNodes(
    (index.childrenOf.get(parentUid) ?? [])
      .map(id => index.nodeMap.get(id))
      .filter((node): node is TreeNode => !!node),
    schemaId
  );
};
