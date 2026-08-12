import type {
  PublicCatalogConfig,
  PublicCatalogEntity,
  PublicCatalogTopology,
  PublicCatalogTopologyEdge
} from '@arch-register/api-types/publicCatalogContract';
import { publicCatalogConfigSchema } from '@arch-register/api-types/publicCatalogContract';
import {
  isReferenceOrContainmentField,
  isTypedRelationField
} from '@arch-register/api-types/schemaContract';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter } from '../../db/database';
import { httpAssert } from '../../utils/httpAssert';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { runAuthorizedOperation } from '../operation';
import { requireWorkspaceCapability } from '../auth/authorization';
import {
  filterKnownAllRestrictedFieldGroups,
  isFieldGroupAccessControlled
} from '../auth/fieldGroupAccessControl';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import { isMarkdownNode, readMarkdownBody } from '../project/markdownOperationHelpers';
import { storageScope } from '../project/projectOperationHelpers';
import type { StorageAdapter } from '../../storage/storage';
import { decodeRefs } from '../../types';
import {
  toApiSpecificationItem,
  toApiSpecificationRevision
} from '../artifact/apiSpecificationOperations';
import { toRevision } from '../artifact/artifactOperations';
import type { ApiSpecificationItemFilters } from '../artifact/db/apiSpecificationDatabase';
import type { RelationDbResult } from '../catalog/db/relationDatabase';

const DEFAULT_CONFIG: PublicCatalogConfig = {
  enabled: false,
  title: undefined,
  description: undefined,
  indexable: false,
  schemas: [],
  entityOverrides: [],
  pages: [],
  apiArtifacts: []
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseConfig = (value: unknown, enabled: boolean): PublicCatalogConfig => {
  const candidate = isRecord(value) ? { ...value, enabled } : { enabled };
  const parsed = publicCatalogConfigSchema.safeParse(candidate);
  return parsed.success ? parsed.data : { ...DEFAULT_CONFIG };
};

export const getPublicCatalogConfig = async (db: DatabaseAdapter, workspace: string) => {
  const row = await db.publicCatalog.getConfig(workspace);
  return {
    config: parseConfig(row?.config, row?.enabled ?? false),
    updatedAt: row?.updated_at.toISOString() ?? null
  };
};

const normalizedPath = (value: string) => value.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');

/** Keep the public contract Markdown-only even for clients that do not use SafeMarkdown. */
const sanitizePublicMarkdown = (body: string) =>
  body.replace(/<[^>\n]*>/g, '').replace(/\]\(\s*(?:javascript|data|vbscript):[^\n]*\)/gi, ']');

const assertUnique = (values: string[], message: string) => {
  httpAssert.true(new Set(values).size === values.length, { status: 400, message });
};

const assertPublicFieldIds = (schema: SchemaDbResult, fieldIds: string[]) => {
  const fieldsById = new Map(schema.fields.map(field => [field.id, field]));
  assertUnique(fieldIds, `Schema '${schema.name}' contains duplicate public field ids`);
  for (const fieldId of fieldIds) {
    const field = fieldsById.get(fieldId);
    httpAssert.present(field, {
      status: 400,
      message: `Field '${fieldId}' does not exist in schema '${schema.name}'`
    });
    httpAssert.true(!isFieldGroupAccessControlled(schema, fieldId), {
      status: 400,
      message: `Field '${field.name}' is protected by a restricted field group and cannot be public`
    });
  }
};

const validateConfig = async (
  db: DatabaseAdapter,
  workspace: string,
  input: PublicCatalogConfig
) => {
  const schemaIds = input.schemas.map(item => item.schemaId);
  assertUnique(schemaIds, 'Public catalog schemas must be unique');
  const schemas = new Map<string, SchemaDbResult>();
  for (const publication of input.schemas) {
    const schema = await db.catalog.getSchema(workspace, publication.schemaId);
    httpAssert.present(schema, {
      status: 400,
      message: `Public catalog schema '${publication.schemaId}' was not found`
    });
    assertPublicFieldIds(schema, publication.fieldIds);
    schemas.set(schema.id, schema);
  }

  assertUnique(
    input.entityOverrides.map(item => item.entityId),
    'Public catalog entity overrides must be unique'
  );
  for (const override of input.entityOverrides) {
    const entity = await db.catalog.getEntity(workspace, override.entityId);
    httpAssert.present(entity, {
      status: 400,
      message: `Public catalog entity '${override.entityId}' was not found`
    });
    httpAssert.true(entity.project_id == null, {
      status: 400,
      message: 'Project-only entities cannot be published in a workspace catalog'
    });
    const schema =
      schemas.get(entity.schema_id) ?? (await db.catalog.getSchema(workspace, entity.schema_id));
    httpAssert.present(schema, { status: 400, message: 'Entity schema was not found' });
    if (override.fieldIds) assertPublicFieldIds(schema, override.fieldIds);
  }

  assertUnique(
    input.pages.map(page => normalizedPath(page.publicPath)),
    'Public page paths must be unique'
  );
  assertUnique(
    input.pages.map(page => page.nodeId),
    'Public pages must reference unique content nodes'
  );
  for (const page of input.pages) {
    const node = await db.project.getAnyContentNodeById(workspace, page.nodeId);
    httpAssert.present(node, {
      status: 400,
      message: `Public catalog page node '${page.nodeId}' was not found`
    });
    httpAssert.true(isMarkdownNode(node) && node.project_id == null, {
      status: 400,
      message: 'Only non-project Markdown pages can be published'
    });
    if (page.scope === 'workspace') {
      httpAssert.true(node.entity_id == null, {
        status: 400,
        message: 'Workspace pages must belong to the workspace content scope'
      });
    } else {
      httpAssert.string(page.entityId, {
        status: 400,
        message: 'Entity pages require an entity id'
      });
      const entity = await db.catalog.getEntity(workspace, page.entityId!);
      httpAssert.present(entity, { status: 400, message: 'Public page entity was not found' });
      httpAssert.true(entity.project_id == null && node.entity_id === entity.id, {
        status: 400,
        message: 'Entity page node does not belong to the selected global entity'
      });
    }
  }

  assertUnique(
    input.apiArtifacts.map(item => item.artifactId),
    'Public API artifacts must be unique'
  );
  for (const publication of input.apiArtifacts) {
    const artifact = await db.artifact.getArtifact(workspace, publication.artifactId);
    httpAssert.present(artifact, {
      status: 400,
      message: `Public API artifact '${publication.artifactId}' was not found`
    });
    httpAssert.true(artifact.artifact_type === 'api-specification', {
      status: 400,
      message: 'Only API specification artifacts can be published'
    });
    const entity = await db.catalog.getEntity(workspace, artifact.entity_id);
    httpAssert.present(entity, {
      status: 400,
      message: 'Public API artifact entity was not found'
    });
    httpAssert.true(entity.project_id == null, {
      status: 400,
      message: 'Project-only entity API artifacts cannot be published'
    });
    if (publication.revisionId) {
      const revision = await db.artifact.getRevision(workspace, publication.revisionId);
      httpAssert.present(revision, { status: 400, message: 'Public API revision was not found' });
      httpAssert.true(revision.artifact_id === artifact.id, {
        status: 400,
        message: 'Public API revision does not belong to the selected artifact'
      });
      const projection = await db.artifactProjections.apiSpecification.getRevision(
        workspace,
        revision.id
      );
      httpAssert.present(projection, {
        status: 400,
        message: 'Public API revision has not been normalized'
      });
    }
  }

  return input;
};

export const readPublicCatalogConfig = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
) =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ws.view');
      const result = await getPublicCatalogConfig(db, ws);
      return { ...result.config, updatedAt: result.updatedAt };
    }
  });

export const replacePublicCatalogConfig = async (
  db: DatabaseAdapter,
  workspace: string,
  input: PublicCatalogConfig,
  event: AuthenticatedEvent
) =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ws.settings');
      const config = await validateConfig(db, ws, input);
      const row = await db.publicCatalog.upsertConfig({
        workspace: ws,
        enabled: config.enabled,
        config: config as unknown as Record<string, unknown>,
        updated_at: new Date(),
        updated_by: event.context.user.id
      });
      return { ...config, updatedAt: row.updated_at.toISOString() };
    }
  });

type PublishedEntity = { entity: EntityDbResult; schema: SchemaDbResult; fieldIds: string[] };

type PublishedEntityLookup = ReadonlyMap<string, EntityDbResult>;
type RelationRowsBySchema = Map<string, Promise<RelationDbResult[]>>;
type PublicTopologyDirection = 'both' | 'incoming' | 'outgoing';
type PublicTopologyEdgeKind = PublicCatalogTopologyEdge['kind'];
type PublicTopologyCandidateEdge = {
  from: PublishedEntity;
  to: PublishedEntity;
  kind: PublicTopologyEdgeKind;
  label: string;
};

const PUBLIC_TOPOLOGY_NODE_LIMIT = 200;
const PUBLIC_TOPOLOGY_EDGE_LIMIT = 500;

const findOverride = (config: PublicCatalogConfig, entity: EntityDbResult) =>
  config.entityOverrides.find(
    item => item.entityId === entity.id || item.entityId === entity.public_id
  );

const getPublishedEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  config: PublicCatalogConfig,
  entity: EntityDbResult
): Promise<PublishedEntity | null> => {
  if (!config.enabled || entity.project_id != null) return null;
  const schema = await db.catalog.getSchema(workspace, entity.schema_id);
  if (!schema) return null;
  const schemaPublication = config.schemas.find(item => item.schemaId === schema.id);
  const override = findOverride(config, entity);
  if (override?.mode === 'exclude') return null;
  if (!schemaPublication && !override) return null;
  const requestedFieldIds = override?.fieldIds ?? schemaPublication?.fieldIds ?? [];
  const fieldIds = requestedFieldIds.filter(
    fieldId =>
      schema.fields.some(field => field.id === fieldId) &&
      !isFieldGroupAccessControlled(schema, fieldId)
  );
  return { entity, schema, fieldIds };
};

const publishedEntityLookup = (published: PublishedEntity[]): Map<string, EntityDbResult> =>
  new Map(
    published.flatMap(item => [
      [item.entity.id, item.entity],
      [item.entity.public_id, item.entity]
    ])
  );

const resolvePublishedTarget = async (
  db: DatabaseAdapter,
  workspace: string,
  config: PublicCatalogConfig,
  identifier: string,
  publishedByIdentifier: PublishedEntityLookup
) => {
  const candidate =
    publishedByIdentifier.get(identifier) ?? (await db.catalog.getEntity(workspace, identifier));
  if (!candidate) return null;
  if (publishedByIdentifier.has(candidate.id)) return candidate;
  const published = await getPublishedEntity(db, workspace, config, candidate);
  return published?.entity ?? null;
};

const loadRelationRows = async (
  db: DatabaseAdapter,
  workspace: string,
  relationSchemaId: string
): Promise<RelationDbResult[]> => {
  const rows: RelationDbResult[] = [];
  let offset = 0;
  const pageSize = 200;
  while (true) {
    const page = await db.relation.listRelations(
      workspace,
      { schemaId: relationSchemaId },
      { limit: pageSize, offset }
    );
    rows.push(...page.items);
    if (page.items.length === 0 || rows.length >= page.total) return rows;
    offset += page.items.length;
  }
};

const getRelationRows = (
  db: DatabaseAdapter,
  workspace: string,
  relationSchemaId: string,
  cache: RelationRowsBySchema
) => {
  const cached = cache.get(relationSchemaId);
  if (cached) return cached;
  const promise = loadRelationRows(db, workspace, relationSchemaId);
  cache.set(relationSchemaId, promise);
  return promise;
};

const resolveReferenceLabels = async (
  db: DatabaseAdapter,
  workspace: string,
  config: PublicCatalogConfig,
  raw: unknown,
  publishedByIdentifier: PublishedEntityLookup
) => {
  const labels: string[] = [];
  for (const identifier of decodeRefs(raw)) {
    const target = await resolvePublishedTarget(
      db,
      workspace,
      config,
      identifier,
      publishedByIdentifier
    );
    if (target) labels.push(target.name);
  }
  return labels;
};

const resolveTypedRelationLabels = async (
  db: DatabaseAdapter,
  workspace: string,
  config: PublicCatalogConfig,
  entity: EntityDbResult,
  field: Extract<SchemaDbResult['fields'][number], { type: 'typedRelation' }>,
  publishedByIdentifier: PublishedEntityLookup,
  relationRowsBySchema: RelationRowsBySchema
) => {
  const relations = await getRelationRows(
    db,
    workspace,
    field.relationSchemaId,
    relationRowsBySchema
  );
  const labels: string[] = [];
  for (const relation of relations) {
    const ownerId = field.direction === 'out' ? relation.out_entity_id : relation.in_entity_id;
    if (ownerId !== entity.id) continue;
    const targetId = field.direction === 'out' ? relation.in_entity_id : relation.out_entity_id;
    const target = await resolvePublishedTarget(
      db,
      workspace,
      config,
      targetId,
      publishedByIdentifier
    );
    if (target) labels.push(target.name);
  }
  return labels;
};

const toPublicEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  config: PublicCatalogConfig,
  published: PublishedEntity,
  publishedByIdentifier: PublishedEntityLookup = new Map(),
  relationRowsBySchema: RelationRowsBySchema = new Map()
): Promise<PublicCatalogEntity> => {
  const { entity, schema, fieldIds } = published;
  const safeData = filterKnownAllRestrictedFieldGroups(schema, entity.data);
  const selectedFields = schema.fields.filter(field => fieldIds.includes(field.id));
  const fieldEntries = await Promise.all(
    selectedFields.map(async field => {
      if (isTypedRelationField(field)) {
        return [
          field.id,
          await resolveTypedRelationLabels(
            db,
            workspace,
            config,
            entity,
            field,
            publishedByIdentifier,
            relationRowsBySchema
          )
        ] as const;
      }
      if (!(field.id in safeData)) return null;
      if (isReferenceOrContainmentField(field)) {
        const labels = await resolveReferenceLabels(
          db,
          workspace,
          config,
          safeData[field.id],
          publishedByIdentifier
        );
        return [
          field.id,
          field.type === 'containment' || field.maxCount === 1 ? (labels[0] ?? null) : labels
        ] as const;
      }
      return [field.id, safeData[field.id]] as const;
    })
  );
  const fields = Object.fromEntries(fieldEntries.filter(entry => entry !== null));
  const apiArtifacts = await listPublicApiArtifactSummaries(db, workspace, config, entity);
  return {
    publicId: entity.public_id,
    slug: entity.slug,
    name: entity.name,
    namespace: entity.namespace,
    description: entity.description,
    owner: entity.owner_name,
    lifecycle: entity.lifecycle_label,
    tags: entity.tags,
    updatedAt: entity.updated_at.toISOString(),
    schema: {
      id: schema.id,
      name: schema.name,
      keyPrefix: schema.key_prefix,
      fields: selectedFields.map(field => ({ id: field.id, name: field.name, type: field.type }))
    },
    fields,
    apiArtifacts
  };
};

const listPublishedEntities = async (
  db: DatabaseAdapter,
  workspace: string,
  config: PublicCatalogConfig
) => {
  const entities = await db.catalog.listEntities(workspace);
  const published: PublishedEntity[] = [];
  for (const entity of entities) {
    const item = await getPublishedEntity(db, workspace, config, entity);
    if (item) published.push(item);
  }
  return published;
};

const comparePublicTopologyEdges = (
  left: PublicTopologyCandidateEdge,
  right: PublicTopologyCandidateEdge
) => {
  const leftKey = [
    left.from.entity.public_id,
    left.to.entity.public_id,
    left.kind,
    left.label
  ].join('\u0000');
  const rightKey = [
    right.from.entity.public_id,
    right.to.entity.public_id,
    right.kind,
    right.label
  ].join('\u0000');
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
};

const publicTopologyRelationLabel = (field: SchemaDbResult['fields'][number]) => {
  if ('predicate' in field && typeof field.predicate === 'string' && field.predicate.trim()) {
    return field.predicate.trim();
  }
  return field.name;
};

const buildPublicTopologyEdges = async (
  db: DatabaseAdapter,
  workspace: string,
  published: PublishedEntity[]
) => {
  const publishedByIdentifier = publishedEntityLookup(published);
  const publishedById = new Map(published.map(item => [item.entity.id, item]));
  const candidates: PublicTopologyCandidateEdge[] = [];
  const typedFieldsByRelationSchema = new Map<
    string,
    Array<{
      source: PublishedEntity;
      field: Extract<SchemaDbResult['fields'][number], { type: 'typedRelation' }>;
    }>
  >();

  for (const source of published) {
    for (const field of source.schema.fields) {
      if (!source.fieldIds.includes(field.id)) continue;
      if (isReferenceOrContainmentField(field)) {
        for (const identifier of decodeRefs(source.entity.data[field.id])) {
          const targetEntity = publishedByIdentifier.get(identifier);
          const target = targetEntity ? publishedById.get(targetEntity.id) : undefined;
          if (!target) continue;
          candidates.push({
            from: source,
            to: target,
            kind: field.type,
            label: publicTopologyRelationLabel(field)
          });
        }
        continue;
      }
      if (!isTypedRelationField(field)) continue;
      const relationFields = typedFieldsByRelationSchema.get(field.relationSchemaId) ?? [];
      relationFields.push({ source, field });
      typedFieldsByRelationSchema.set(field.relationSchemaId, relationFields);
    }
  }

  const relationRowsBySchema: RelationRowsBySchema = new Map();
  for (const [relationSchemaId, relationFields] of [...typedFieldsByRelationSchema.entries()].sort(
    ([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)
  )) {
    const relations = await getRelationRows(db, workspace, relationSchemaId, relationRowsBySchema);
    for (const { source, field } of relationFields) {
      for (const relation of relations) {
        const ownerId = field.direction === 'out' ? relation.out_entity_id : relation.in_entity_id;
        if (ownerId !== source.entity.id) continue;
        const targetId = field.direction === 'out' ? relation.in_entity_id : relation.out_entity_id;
        const target = publishedById.get(targetId);
        if (!target) continue;
        candidates.push({
          from: source,
          to: target,
          kind: 'typed',
          label: publicTopologyRelationLabel(field)
        });
      }
    }
  }

  const unique = new Map<string, PublicTopologyCandidateEdge>();
  for (const candidate of candidates) {
    const key = [
      candidate.from.entity.public_id,
      candidate.to.entity.public_id,
      candidate.kind,
      candidate.label
    ].join('\u0000');
    if (!unique.has(key)) unique.set(key, candidate);
  }
  return [...unique.values()].sort(comparePublicTopologyEdges);
};

const publicTopologyEdgeKey = (edge: PublicTopologyCandidateEdge) =>
  [edge.from.entity.public_id, edge.to.entity.public_id, edge.kind, edge.label].join('\u0000');

const toPublicTopologyNode = (published: PublishedEntity, isRoot: boolean) => ({
  publicId: published.entity.public_id,
  slug: published.entity.slug,
  name: published.entity.name,
  schema: {
    name: published.schema.name,
    keyPrefix: published.schema.key_prefix
  },
  isRoot
});

const toPublicTopologyEdge = (edge: PublicTopologyCandidateEdge): PublicCatalogTopologyEdge => ({
  id: `edge:${edge.kind}:${edge.from.entity.public_id}:${edge.to.entity.public_id}:${edge.label}`,
  from: edge.from.entity.public_id,
  to: edge.to.entity.public_id,
  label: edge.label,
  kind: edge.kind
});

export const getPublicCatalogTopology = async (
  db: DatabaseAdapter,
  workspaceSlug: string,
  entityPublicId: string,
  query: { depth: number; direction: PublicTopologyDirection }
): Promise<PublicCatalogTopology> => {
  const { workspace, config } = await requirePublicCatalog(db, workspaceSlug);
  const published = await listPublishedEntities(db, workspace, config);
  const root = published.find(item => item.entity.public_id === entityPublicId);
  httpAssert.present(root, { status: 404, message: 'Published entity not found' });

  const edges = await buildPublicTopologyEdges(db, workspace, published);
  const outgoing = new Map<string, PublicTopologyCandidateEdge[]>();
  const incoming = new Map<string, PublicTopologyCandidateEdge[]>();
  for (const edge of edges) {
    const outgoingEdges = outgoing.get(edge.from.entity.id) ?? [];
    outgoingEdges.push(edge);
    outgoing.set(edge.from.entity.id, outgoingEdges);
    const incomingEdges = incoming.get(edge.to.entity.id) ?? [];
    incomingEdges.push(edge);
    incoming.set(edge.to.entity.id, incomingEdges);
  }

  const nodeDepth = new Map<string, number>([[root.entity.id, 0]]);
  const nodeOrder: PublishedEntity[] = [root];
  const queue: PublishedEntity[] = [root];
  const selectedEdges = new Map<string, PublicTopologyCandidateEdge>();
  let truncated = false;

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDepth = nodeDepth.get(current.entity.id)!;
    if (currentDepth >= query.depth) continue;

    const adjacent = new Map<string, PublicTopologyCandidateEdge>();
    if (query.direction === 'both' || query.direction === 'outgoing') {
      for (const edge of outgoing.get(current.entity.id) ?? []) {
        adjacent.set(publicTopologyEdgeKey(edge), edge);
      }
    }
    if (query.direction === 'both' || query.direction === 'incoming') {
      for (const edge of incoming.get(current.entity.id) ?? []) {
        adjacent.set(publicTopologyEdgeKey(edge), edge);
      }
    }

    for (const edge of [...adjacent.values()].sort(comparePublicTopologyEdges)) {
      const neighbor =
        query.direction === 'incoming' && edge.to.entity.id === current.entity.id
          ? edge.from
          : query.direction === 'outgoing' && edge.from.entity.id === current.entity.id
            ? edge.to
            : edge.from.entity.id === current.entity.id
              ? edge.to
              : edge.from;
      const edgeKey = publicTopologyEdgeKey(edge);
      const hasNode = nodeDepth.has(neighbor.entity.id);
      if (!selectedEdges.has(edgeKey) && selectedEdges.size >= PUBLIC_TOPOLOGY_EDGE_LIMIT) {
        truncated = true;
        continue;
      }
      if (!hasNode && nodeOrder.length >= PUBLIC_TOPOLOGY_NODE_LIMIT) {
        truncated = true;
        continue;
      }
      if (!selectedEdges.has(edgeKey)) selectedEdges.set(edgeKey, edge);
      if (hasNode) continue;
      nodeDepth.set(neighbor.entity.id, currentDepth + 1);
      nodeOrder.push(neighbor);
      queue.push(neighbor);
    }
  }

  return {
    rootPublicId: root.entity.public_id,
    nodes: nodeOrder.map(item => toPublicTopologyNode(item, item.entity.id === root.entity.id)),
    edges: [...selectedEdges.values()].sort(comparePublicTopologyEdges).map(toPublicTopologyEdge),
    depth: query.depth,
    direction: query.direction,
    truncated,
    limits: {
      nodes: PUBLIC_TOPOLOGY_NODE_LIMIT,
      edges: PUBLIC_TOPOLOGY_EDGE_LIMIT
    }
  };
};

const requirePublicCatalog = async (db: DatabaseAdapter, workspaceSlug: string) => {
  const workspace = await resolveWorkspace(db.catalog, workspaceSlug);
  const { config } = await getPublicCatalogConfig(db, workspace);
  httpAssert.true(config.enabled, { status: 404, message: 'Public catalog is not enabled' });
  return { workspace, config };
};

export const getPublicCatalogManifest = async (db: DatabaseAdapter, workspaceSlug: string) => {
  const { workspace, config } = await requirePublicCatalog(db, workspaceSlug);
  const published = await listPublishedEntities(db, workspace, config);
  const schemaIds = new Set([
    ...config.schemas.map(publication => publication.schemaId),
    ...published.map(item => item.schema.id)
  ]);
  const schemaPublications = await Promise.all(
    [...schemaIds].map(async schemaId => {
      const schema = await db.catalog.getSchema(workspace, schemaId);
      if (!schema) return null;
      const selectedFieldIds = new Set(
        published.filter(item => item.schema.id === schema.id).flatMap(item => item.fieldIds)
      );
      const configuredFieldIds =
        config.schemas.find(item => item.schemaId === schema.id)?.fieldIds ?? [];
      const fieldIds = [...new Set([...selectedFieldIds, ...configuredFieldIds])].filter(
        fieldId =>
          schema.fields.some(field => field.id === fieldId) &&
          !isFieldGroupAccessControlled(schema, fieldId)
      );
      return {
        id: schema.id,
        name: schema.name,
        description: schema.description,
        keyPrefix: schema.key_prefix,
        fields: schema.fields
          .filter(field => fieldIds.includes(field.id))
          .map(field => ({ id: field.id, name: field.name, type: field.type }))
      };
    })
  );
  const pages = await listPublicPages(db, workspace, config, published);
  const apiArtifacts = await Promise.all(
    config.apiArtifacts.map(async publication => {
      const artifact = await db.artifact.getArtifact(workspace, publication.artifactId);
      if (!artifact) return null;
      const entity = published.find(item => item.entity.id === artifact.entity_id)?.entity;
      if (!entity) return null;
      const revisionId = publication.revisionId ?? artifact.current_revision_id;
      const projection = revisionId
        ? await db.artifactProjections.apiSpecification.getRevision(workspace, revisionId)
        : null;
      return {
        artifactId: artifact.id,
        entityPublicId: entity.public_id,
        title: projection?.title ?? null,
        protocol: projection?.protocol ?? null,
        currentRevisionId: revisionId,
        rawAvailable: publication.exposeRaw
      };
    })
  );
  return {
    workspace: workspaceSlug,
    title: config.title?.trim() || 'Public catalog',
    description: config.description ?? '',
    indexable: config.indexable,
    schemas: schemaPublications.filter(
      (schema): schema is NonNullable<(typeof schemaPublications)[number]> => schema !== null
    ),
    pages,
    apiArtifacts: apiArtifacts.filter(
      (artifact): artifact is NonNullable<(typeof apiArtifacts)[number]> => artifact !== null
    ),
    entityCount: published.length,
    endpoints: {
      entities: `/api/public/v1/${encodeURIComponent(workspaceSlug)}/entities`,
      topology: `/api/public/v1/${encodeURIComponent(workspaceSlug)}/topology`,
      wiki: `/api/public/v1/${encodeURIComponent(workspaceSlug)}/wiki`
    }
  };
};

export const listPublicCatalogEntities = async (
  db: DatabaseAdapter,
  workspaceSlug: string,
  query: { q?: string; schema?: string; limit: number; offset: number }
) => {
  const { workspace, config } = await requirePublicCatalog(db, workspaceSlug);
  const published = await listPublishedEntities(db, workspace, config);
  const q = query.q?.trim().toLowerCase();
  const filtered = published.filter(item => {
    if (
      query.schema &&
      item.schema.id !== query.schema &&
      item.schema.key_prefix !== query.schema
    ) {
      return false;
    }
    if (!q) return true;
    return [item.entity.name, item.entity.slug, item.entity.description]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });
  const page = filtered.slice(query.offset, query.offset + query.limit);
  const publishedByIdentifier = publishedEntityLookup(published);
  const relationRowsBySchema: RelationRowsBySchema = new Map();
  return {
    items: await Promise.all(
      page.map(item =>
        toPublicEntity(db, workspace, config, item, publishedByIdentifier, relationRowsBySchema)
      )
    ),
    total: filtered.length
  };
};

export const getPublicCatalogEntity = async (
  db: DatabaseAdapter,
  workspaceSlug: string,
  entityPublicId: string
) => {
  const { workspace, config } = await requirePublicCatalog(db, workspaceSlug);
  const entity = await db.catalog.getEntity(workspace, entityPublicId);
  httpAssert.present(entity, { status: 404, message: 'Published entity not found' });
  httpAssert.true(entity.public_id === entityPublicId, {
    status: 404,
    message: 'Published entity not found'
  });
  const published = await getPublishedEntity(db, workspace, config, entity);
  httpAssert.present(published, { status: 404, message: 'Published entity not found' });
  return await toPublicEntity(db, workspace, config, published, publishedEntityLookup([published]));
};

const pageMatchesScope = (
  page: PublicCatalogConfig['pages'][number],
  node: { project_id: string | null; entity_id: string | null },
  entity: EntityDbResult | null
) => {
  if (page.scope === 'workspace') return node.project_id == null && node.entity_id == null;
  return (
    node.project_id == null &&
    entity != null &&
    page.entityId != null &&
    (page.entityId === entity.id || page.entityId === entity.public_id) &&
    node.entity_id === entity.id
  );
};

const listPublicPages = async (
  db: DatabaseAdapter,
  workspace: string,
  config: PublicCatalogConfig,
  published: PublishedEntity[]
) => {
  const publishedById = new Map(published.map(item => [item.entity.id, item.entity]));
  const pages = [];
  for (const page of [...config.pages].sort(
    (a, b) => a.order - b.order || a.publicPath.localeCompare(b.publicPath)
  )) {
    const node = await db.project.getAnyContentNodeById(workspace, page.nodeId);
    if (!node || !isMarkdownNode(node)) continue;
    const entity = node.entity_id ? (publishedById.get(node.entity_id) ?? null) : null;
    if (!pageMatchesScope(page, node, entity)) continue;
    pages.push({
      path: normalizedPath(page.publicPath),
      label: page.label?.trim() || node.name,
      scope: page.scope,
      entityPublicId: entity?.public_id ?? null
    });
  }
  return pages;
};

export const getPublicCatalogWikiPage = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  workspaceSlug: string,
  publicPath: string
) => {
  const { workspace, config } = await requirePublicCatalog(db, workspaceSlug);
  const wantedPath = normalizedPath(publicPath);
  const page = config.pages.find(item => normalizedPath(item.publicPath) === wantedPath);
  httpAssert.present(page, { status: 404, message: 'Published wiki page not found' });
  const node = await db.project.getAnyContentNodeById(workspace, page.nodeId);
  httpAssert.present(node, { status: 404, message: 'Published wiki page not found' });
  httpAssert.true(isMarkdownNode(node) && node.project_id == null, {
    status: 404,
    message: 'Published wiki page not found'
  });
  let entity: EntityDbResult | null = null;
  if (page.scope === 'entity') {
    httpAssert.present(page.entityId, { status: 404, message: 'Published wiki page not found' });
    entity = await db.catalog.getEntity(workspace, page.entityId!);
    httpAssert.present(entity, { status: 404, message: 'Published wiki page not found' });
    const published = await getPublishedEntity(db, workspace, config, entity);
    httpAssert.present(published, { status: 404, message: 'Published wiki page not found' });
  }
  httpAssert.true(pageMatchesScope(page, node, entity), {
    status: 404,
    message: 'Published wiki page not found'
  });
  const content = await storage.read(workspace, storageScope(workspace, node), node.id);
  return {
    path: wantedPath,
    label: page.label?.trim() || node.name,
    scope: page.scope,
    entityPublicId: entity?.public_id ?? null,
    body: sanitizePublicMarkdown(readMarkdownBody(content)),
    updatedAt: node.updated_at.toISOString()
  };
};

const getPublishedArtifact = async (
  db: DatabaseAdapter,
  workspace: string,
  config: PublicCatalogConfig,
  entityPublicId: string,
  artifactId: string
) => {
  const publication = config.apiArtifacts.find(item => item.artifactId === artifactId);
  httpAssert.present(publication, { status: 404, message: 'Published API artifact not found' });
  const entity = await db.catalog.getEntity(workspace, entityPublicId);
  httpAssert.present(entity, { status: 404, message: 'Published API artifact not found' });
  httpAssert.true(entity.public_id === entityPublicId && entity.project_id == null, {
    status: 404,
    message: 'Published API artifact not found'
  });
  const published = await getPublishedEntity(db, workspace, config, entity);
  httpAssert.present(published, { status: 404, message: 'Published API artifact not found' });
  const artifact = await db.artifact.getArtifact(workspace, artifactId);
  httpAssert.present(artifact, { status: 404, message: 'Published API artifact not found' });
  httpAssert.true(
    artifact.entity_id === entity.id && artifact.artifact_type === 'api-specification',
    {
      status: 404,
      message: 'Published API artifact not found'
    }
  );
  return { publication, artifact };
};

const getPublicRevisionProjection = async (
  db: DatabaseAdapter,
  workspace: string,
  artifactId: string,
  revisionId: string
) => {
  const revision = await db.artifact.getRevision(workspace, revisionId);
  httpAssert.present(revision, { status: 404, message: 'Published API revision not found' });
  httpAssert.true(revision.artifact_id === artifactId, {
    status: 404,
    message: 'Published API revision not found'
  });
  const projection = await db.artifactProjections.apiSpecification.getRevision(
    workspace,
    revision.id
  );
  httpAssert.present(projection, { status: 404, message: 'Published API revision not found' });
  return { revision, projection };
};

const assertPublishedRevision = (revisionId: string, configuredRevisionId?: string) => {
  httpAssert.true(configuredRevisionId == null || configuredRevisionId === revisionId, {
    status: 404,
    message: 'Published API revision not found'
  });
};

export const listPublicApiSpecificationRevisions = async (
  db: DatabaseAdapter,
  workspaceSlug: string,
  entityPublicId: string,
  artifactId: string
) => {
  const { workspace, config } = await requirePublicCatalog(db, workspaceSlug);
  const { publication, artifact } = await getPublishedArtifact(
    db,
    workspace,
    config,
    entityPublicId,
    artifactId
  );
  const revisions = await db.artifact.listRevisionSummaries(workspace, artifact.id);
  const allowed = publication.revisionId
    ? revisions.filter(revision => revision.id === publication.revisionId)
    : revisions;
  const result = [];
  for (const revision of allowed) {
    const projection = await db.artifactProjections.apiSpecification.getRevision(
      workspace,
      revision.id
    );
    if (!projection) continue;
    result.push(
      toApiSpecificationRevision(revision, projection, artifact.current_revision_id === revision.id)
    );
  }
  return result;
};

export const listPublicApiSpecification = async (
  db: DatabaseAdapter,
  workspaceSlug: string,
  entityPublicId: string,
  artifactId: string,
  revisionId: string,
  query: {
    q?: string;
    resource?: string;
    action?: string;
    kind?: 'operation' | 'message';
    tag?: string;
    deprecated?: boolean;
    limit: number;
    offset: number;
  }
) => {
  const { workspace, config } = await requirePublicCatalog(db, workspaceSlug);
  const { publication, artifact } = await getPublishedArtifact(
    db,
    workspace,
    config,
    entityPublicId,
    artifactId
  );
  assertPublishedRevision(revisionId, publication.revisionId);
  const { revision, projection } = await getPublicRevisionProjection(
    db,
    workspace,
    artifact.id,
    revisionId
  );
  const page = await db.artifactProjections.apiSpecification.listItems(
    workspace,
    revision.id,
    query as ApiSpecificationItemFilters & { limit: number; offset: number },
    query
  );
  return {
    revision: toApiSpecificationRevision(
      revision,
      projection,
      artifact.current_revision_id === revision.id
    ),
    items: page.items.map(toApiSpecificationItem),
    total: page.total,
    limit: query.limit,
    offset: query.offset
  };
};

export const getPublicApiSpecificationRaw = async (
  db: DatabaseAdapter,
  workspaceSlug: string,
  entityPublicId: string,
  artifactId: string,
  revisionId: string
) => {
  const { workspace, config } = await requirePublicCatalog(db, workspaceSlug);
  const { publication, artifact } = await getPublishedArtifact(
    db,
    workspace,
    config,
    entityPublicId,
    artifactId
  );
  httpAssert.true(publication.exposeRaw, {
    status: 404,
    message: 'Raw API source is not published'
  });
  assertPublishedRevision(revisionId, publication.revisionId);
  const { revision } = await getPublicRevisionProjection(db, workspace, artifact.id, revisionId);
  return { ...toRevision(revision), content: revision.content };
};

export const listPublicApiArtifactSummaries = async (
  db: DatabaseAdapter,
  workspace: string,
  config: PublicCatalogConfig,
  entity: EntityDbResult
) => {
  const result = [];
  for (const publication of config.apiArtifacts) {
    const artifact = await db.artifact.getArtifact(workspace, publication.artifactId);
    if (
      !artifact ||
      artifact.entity_id !== entity.id ||
      artifact.artifact_type !== 'api-specification'
    ) {
      continue;
    }
    const revisionId = publication.revisionId ?? artifact.current_revision_id;
    const projection = revisionId
      ? await db.artifactProjections.apiSpecification.getRevision(workspace, revisionId)
      : null;
    result.push({
      artifactId: artifact.id,
      entityPublicId: entity.public_id,
      title: projection?.title ?? null,
      protocol: projection?.protocol ?? null,
      currentRevisionId: revisionId,
      rawAvailable: publication.exposeRaw
    });
  }
  return result;
};
