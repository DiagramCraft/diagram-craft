import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type {
  RelationEndpoint,
  RelationSchema
} from '@arch-register/api-types/relationSchemaContract';
import type { MetricTraversalStep } from '@arch-register/api-types/metricContract';
import type { TreeEdge, TreeNode } from '@arch-register/api-types/entityContract';
import type { FieldGroupAccessControl } from '@arch-register/permissions';

type FieldGroupAccessResolver = (
  accessControl: FieldGroupAccessControl | undefined
) => 'none' | 'view' | 'edit';

/** A wildcard ('any') endpoint resolves to every known entity schema id. */
const resolveEndpointSchemaIds = (endpoint: RelationEndpoint, schemas: EntitySchema[]): string[] =>
  endpoint.schemaIds === 'any' ? schemas.map(schema => schema.id) : endpoint.schemaIds;

export type ContainmentTreeIndex = {
  nodeMap: Map<string, TreeNode>;
  childrenOf: Map<string, string[]>;
};

export type MapLevelConfig = {
  schemaId: string | null;
  columns: number;
  hidden?: boolean;
};

export const getMapSchemaIds = (cfg: {
  levelConfigs?: MapLevelConfig[];
  levels?: number;
  level1SchemaId?: string | null;
  level2SchemaId?: string | null;
  level3SchemaId?: string | null;
}): string[] => {
  const ids = cfg.levelConfigs
    ? cfg.levelConfigs.map(level => level.schemaId)
    : [cfg.level1SchemaId, cfg.level2SchemaId, cfg.level3SchemaId].slice(0, cfg.levels ?? 3);
  return [...new Set(ids.filter((id): id is string => !!id))];
};

export const getChildSchemas = (
  schemas: EntitySchema[],
  parentSchemaId: string | null,
  relationSchemas: RelationSchema[] = [],
  getFieldGroupAccess: FieldGroupAccessResolver = () => 'edit'
): EntitySchema[] => {
  if (!parentSchemaId) return schemas;
  const relationSchemaById = new Map(relationSchemas.map(schema => [schema.id, schema]));
  const parentSchema = schemas.find(schema => schema.id === parentSchemaId);
  const parentTypedRelationTargets = parentSchema
    ? parentSchema.fields.flatMap(field => {
        if (field.type !== 'typedRelation') return [];
        const group = field.groupId
          ? parentSchema.groups?.find(candidate => candidate.id === field.groupId)
          : undefined;
        if (getFieldGroupAccess(group?.accessControl) === 'none') return [];
        const relationSchema = relationSchemaById.get(field.relationSchemaId);
        const endpoint = field.direction === 'in' ? relationSchema?.out : relationSchema?.in;
        return endpoint ? resolveEndpointSchemaIds(endpoint, schemas) : [];
      })
    : [];
  return schemas.filter(schema => {
    const hasContainment = schema.fields.some(
      field =>
        (field.type === 'containment' || field.type === 'reference') &&
        field.schemaId === parentSchemaId
    );
    const hasTypedRelation = parentTypedRelationTargets.includes(schema.id);
    return hasContainment || hasTypedRelation;
  });
};

export const getChildRelationSchemas = (
  schemas: EntitySchema[],
  parentSchemaId: string | null,
  relationSchemas: RelationSchema[],
  getFieldGroupAccess: FieldGroupAccessResolver = () => 'edit'
): RelationSchema[] => {
  if (!parentSchemaId) return [];
  const parentSchema = schemas.find(schema => schema.id === parentSchemaId);
  if (!parentSchema) return [];
  return relationSchemas.filter(relationSchema =>
    (['in', 'out'] as const).some(direction => {
      const endpoint = direction === 'in' ? relationSchema.in : relationSchema.out;
      if (!(endpoint.schemaIds === 'any' || endpoint.schemaIds.includes(parentSchema.id))) {
        return false;
      }
      const fields = parentSchema.fields.filter(
        field =>
          field.type === 'typedRelation' &&
          field.relationSchemaId === relationSchema.id &&
          field.direction === direction
      );
      if (fields.length === 0) return true;
      return fields.some(field => {
        const group = field.groupId
          ? parentSchema.groups?.find(candidate => candidate.id === field.groupId)
          : undefined;
        return getFieldGroupAccess(group?.accessControl) !== 'none';
      });
    })
  );
};

export const getChildLevelOptions = (
  schemas: EntitySchema[],
  parentSchemaId: string | null,
  relationSchemas: RelationSchema[] = [],
  previousEntitySchemaId?: string | null,
  getFieldGroupAccess: FieldGroupAccessResolver = () => 'edit'
): Array<{ id: string; name: string }> => {
  if (!parentSchemaId) return [];
  const relationSchema = relationSchemas.find(schema => schema.id === parentSchemaId);
  if (relationSchema) {
    const previousEntity = schemas.find(schema => schema.id === previousEntitySchemaId);
    const previousDirections = previousEntity
      ? relationDirectionsForEntity(previousEntity, relationSchema, getFieldGroupAccess)
      : (['in', 'out'] as const);
    const endpointIds = new Set(
      previousDirections.flatMap(direction =>
        resolveEndpointSchemaIds(
          direction === 'in' ? relationSchema.out : relationSchema.in,
          schemas
        )
      )
    );
    return schemas.filter(schema => endpointIds.has(schema.id));
  }
  return [
    ...getChildSchemas(schemas, parentSchemaId, relationSchemas, getFieldGroupAccess),
    ...getChildRelationSchemas(schemas, parentSchemaId, relationSchemas, getFieldGroupAccess)
  ];
};

export type MapTraversalResolution = {
  path: MetricTraversalStep[];
  error?: string;
};

const accessibleTypedFields = (
  schema: EntitySchema,
  relationSchemaId: string,
  direction: 'in' | 'out',
  getFieldGroupAccess: FieldGroupAccessResolver
) =>
  schema.fields.filter(field => {
    if (
      field.type !== 'typedRelation' ||
      field.relationSchemaId !== relationSchemaId ||
      field.direction !== direction
    ) {
      return false;
    }
    const group = field.groupId
      ? schema.groups?.find(candidate => candidate.id === field.groupId)
      : undefined;
    return getFieldGroupAccess(group?.accessControl) !== 'none';
  });

const endpointAllows = (endpoint: RelationEndpoint, schemaId: string) =>
  endpoint.schemaIds === 'any' || endpoint.schemaIds.includes(schemaId);

const relationDirectionsForEntity = (
  schema: EntitySchema,
  relationSchema: RelationSchema,
  getFieldGroupAccess: FieldGroupAccessResolver
) =>
  (['in', 'out'] as const).filter(direction => {
    const endpoint = direction === 'in' ? relationSchema.in : relationSchema.out;
    if (!endpointAllows(endpoint, schema.id)) return false;
    const fields = accessibleTypedFields(schema, relationSchema.id, direction, getFieldGroupAccess);
    const allFields = schema.fields.filter(
      field =>
        field.type === 'typedRelation' &&
        field.relationSchemaId === relationSchema.id &&
        field.direction === direction
    );
    return allFields.length === 0 || fields.length > 0;
  });

const findTraversalStep = (
  parentSchema: EntitySchema | undefined,
  childSchema: EntitySchema,
  relationSchemas: RelationSchema[],
  getFieldGroupAccess: FieldGroupAccessResolver
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
    const group = field.groupId
      ? parentSchema.groups?.find(candidate => candidate.id === field.groupId)
      : undefined;
    if (getFieldGroupAccess(group?.accessControl) === 'none') return false;
    const relationSchema = relationSchemaById.get(field.relationSchemaId);
    const targetSchemaIds =
      field.direction === 'in' ? relationSchema?.out.schemaIds : relationSchema?.in.schemaIds;
    return targetSchemaIds === 'any' || (targetSchemaIds?.includes(childSchema.id) ?? false);
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
  relationSchemas: RelationSchema[],
  getFieldGroupAccess: FieldGroupAccessResolver = () => 'edit'
): MetricTraversalStep[] =>
  resolveMapTraversalPath(schemaIds, schemas, relationSchemas, getFieldGroupAccess).path;

export const resolveMapTraversalPath = (
  schemaIds: string[],
  schemas: EntitySchema[],
  relationSchemas: RelationSchema[],
  getFieldGroupAccess: FieldGroupAccessResolver = () => 'edit'
): MapTraversalResolution => {
  const schemaById = new Map(schemas.map(schema => [schema.id, schema]));
  const relationSchemaById = new Map(relationSchemas.map(schema => [schema.id, schema]));
  const path: MetricTraversalStep[] = [];
  for (let index = 1; index < schemaIds.length; index += 1) {
    const childSchemaId = schemaIds[index]!;
    const parentSchemaId = schemaIds[index - 1]!;
    const childSchema = schemaById.get(childSchemaId);
    const parentSchema = schemaById.get(parentSchemaId);
    const parentRelationSchema = relationSchemaById.get(parentSchemaId);
    if (!parentSchema && !parentRelationSchema) {
      return { path: [], error: `Unknown map level schema: ${parentSchemaId}` };
    }
    if (!childSchema && relationSchemaById.has(childSchemaId)) {
      if (!parentSchema) return { path: [], error: 'A relation level must follow an entity level' };
      const relationSchema = relationSchemaById.get(childSchemaId)!;
      const directions = relationDirectionsForEntity(
        parentSchema,
        relationSchema,
        getFieldGroupAccess
      );
      if (directions.length === 0) {
        return {
          path: [],
          error: `The relation “${relationSchema.name}” is not available from “${parentSchema.name}”`
        };
      }
      const hasBoundFieldForEveryDirection = directions.every(
        direction =>
          accessibleTypedFields(parentSchema, relationSchema.id, direction, getFieldGroupAccess)
            .length > 0
      );
      const boundField = hasBoundFieldForEveryDirection
        ? directions
            .flatMap(direction =>
              accessibleTypedFields(parentSchema, relationSchema.id, direction, getFieldGroupAccess)
            )
            .at(0)
        : undefined;
      if (boundField?.type === 'typedRelation') {
        path.push({
          kind: 'typedRelation',
          fieldId: boundField.id,
          relationSchemaId: boundField.relationSchemaId,
          direction: boundField.direction
        });
      } else {
        path.push({
          kind: 'unboundTypedRelation',
          relationSchemaId: relationSchema.id,
          direction: directions.length === 2 ? 'both' : directions[0]!
        });
      }
      continue;
    }
    if (!childSchema) return { path: [], error: `Unknown map level schema: ${childSchemaId}` };
    if (parentRelationSchema) {
      const previousEntityId = schemaIds[index - 2];
      const previousEntity = previousEntityId ? schemaById.get(previousEntityId) : undefined;
      const previousStep = path.at(-1);
      const directions = previousEntity
        ? relationDirectionsForEntity(previousEntity, parentRelationSchema, getFieldGroupAccess)
        : (['in', 'out'] as const);
      const targetIds = new Set(
        directions.flatMap(direction =>
          resolveEndpointSchemaIds(
            direction === 'in' ? parentRelationSchema.out : parentRelationSchema.in,
            schemas
          )
        )
      );
      if (previousStep?.kind === 'typedRelation') {
        const targetEndpoint =
          previousStep.direction === 'in' ? parentRelationSchema.out : parentRelationSchema.in;
        if (endpointAllows(targetEndpoint, childSchemaId)) continue;
      } else if (previousStep?.kind === 'unboundTypedRelation') {
        if (targetIds.has(childSchemaId)) continue;
      }
      return {
        path: [],
        error: `“${childSchema.name}” is not a valid endpoint of “${parentRelationSchema.name}”`
      };
    }
    const step = findTraversalStep(parentSchema, childSchema, relationSchemas, getFieldGroupAccess);
    if (!step) {
      const relationCandidate = relationSchemas.find(relationSchema =>
        relationDirectionsForEntity(parentSchema!, relationSchema, getFieldGroupAccess).some(
          direction =>
            resolveEndpointSchemaIds(
              direction === 'in' ? relationSchema.out : relationSchema.in,
              schemas
            ).includes(childSchemaId)
        )
      );
      return {
        path: [],
        error: relationCandidate
          ? `Select “${relationCandidate.name}” as an intermediate map level before “${childSchema.name}”`
          : `No traversable relation connects “${parentSchema?.name ?? parentSchemaId}” to “${childSchema.name}”`
      };
    }
    path.push(step);
  }
  return { path };
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
    .filter(node => node._schema.id === schemaId)
    .sort((a, b) => nodeName(a).localeCompare(nodeName(b)));

export const getMapRoots = (
  nodes: TreeNode[],
  edges: TreeEdge[],
  schemaId: string | null
): TreeNode[] => {
  if (!schemaId) return [];
  const nodeMap = new Map(nodes.map(node => [node._uid, node]));
  const nestedNodeIds = new Set(
    edges.flatMap(({ childId, parentId }) => {
      const child = nodeMap.get(childId);
      const parent = nodeMap.get(parentId);
      return child?._schema.id === schemaId && parent?._schema.id === schemaId ? [childId] : [];
    })
  );
  return sortContainmentNodes(nodes, schemaId).filter(node => !nestedNodeIds.has(node._uid));
};

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
