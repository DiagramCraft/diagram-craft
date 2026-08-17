import type { AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { httpAssert } from '../../utils/httpAssert';
import { getWorkspaceCapabilityConfiguration } from '../workspace/workspaceCapabilityOperations';
import {
  getWorkspaceCapabilityDefinition,
  resolveCapabilityFieldId,
  resolveCapabilityFieldMappings
} from '@arch-register/api-types/integrationCatalog';
import type {
  GlossaryConfig,
  GlossaryTerm,
  GlossaryUsage
} from '@arch-register/api-types/glossaryContract';
import { listEntitiesWithCount, getEntity } from '../catalog/entityQueryOperations';
import { getEntityDependents } from '../catalog/entityRelationshipOperations';
import { getEntityProjects, getEntityDiagramFiles } from '../project/projectEntityOperations';
import { listRelatedContent } from '../project/markdownListingOperations';
import { runAuthorizedOperation } from '../operation';
import { projectDbErrorMessages } from '../project/projectOperationHelpers';
import { resolveWorkspace } from '../workspace/resolveWorkspace';

type GlossaryResolution = {
  config: GlossaryConfig;
  termSchemaId: string;
  categorySchemaId: string;
  fieldIds: GlossaryConfig['fields'];
};

const asValues = (value: unknown): unknown[] => (Array.isArray(value) ? value : [value]);

const asStrings = (value: unknown): string[] =>
  asValues(value)
    .flatMap(item => {
      if (typeof item === 'string') return [item];
      if (item && typeof item === 'object' && 'id' in item && typeof item.id === 'string') {
        return [item.id];
      }
      return [];
    })
    .map(value => value.trim())
    .filter(Boolean);

const normalized = (value: string) => value.trim().toLocaleLowerCase();

const valueAsText = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'value' in value && typeof value.value === 'string') {
    return value.value;
  }
  return null;
};

const ownerId = (entity: Record<string, unknown>) => {
  const owner = entity['_owner'];
  if (typeof owner === 'string') return owner;
  if (owner && typeof owner === 'object' && 'id' in owner && typeof owner.id === 'string') {
    return owner.id;
  }
  return null;
};

const lifecycleId = (entity: Record<string, unknown>) => {
  const lifecycle = entity['_lifecycle'];
  if (typeof lifecycle === 'string') return lifecycle;
  if (
    lifecycle &&
    typeof lifecycle === 'object' &&
    'id' in lifecycle &&
    typeof lifecycle.id === 'string'
  ) {
    return lifecycle.id;
  }
  return null;
};

const entityPublicId = (entity: Record<string, unknown>) =>
  typeof entity['_publicId'] === 'string' ? entity['_publicId'] : String(entity['_uid'] ?? '');

const entityName = (entity: Record<string, unknown>) =>
  typeof entity['_name'] === 'string' ? entity['_name'] : String(entity['_uid'] ?? '');

const resolveGlossary = async (
  db: DatabaseAdapter,
  workspace: string
): Promise<GlossaryResolution | null> => {
  const configuration = await getWorkspaceCapabilityConfiguration(
    db,
    workspace,
    'business-glossary'
  );
  if (!configuration?.valid) return null;

  const definition = getWorkspaceCapabilityDefinition('business-glossary');
  const termBinding = configuration.bindings.term;
  const categoryBinding = configuration.bindings.category;
  if (!definition || !termBinding || !categoryBinding) return null;
  if (
    termBinding.target.kind !== 'entity_schema' ||
    categoryBinding.target.kind !== 'entity_schema'
  ) {
    return null;
  }

  const termSchema = await db.catalog.getSchema(workspace, termBinding.target.id);
  const categorySchema = await db.catalog.getSchema(workspace, categoryBinding.target.id);
  if (!termSchema || !categorySchema) return null;

  const termRole = definition.bindingRoles.find(role => role.id === 'term');
  if (!termRole) return null;
  const resolution = resolveCapabilityFieldMappings(
    termBinding,
    termRole.fieldRoles,
    termSchema.fields
  );
  if (resolution.issues.length > 0) return null;

  const fields = {
    definition: resolveCapabilityFieldId(
      termBinding,
      termRole.fieldRoles.find(role => role.id === 'definition')!
    ),
    synonyms: resolveCapabilityFieldId(
      termBinding,
      termRole.fieldRoles.find(role => role.id === 'synonyms')!
    ),
    abbreviations: resolveCapabilityFieldId(
      termBinding,
      termRole.fieldRoles.find(role => role.id === 'abbreviations')!
    ),
    categories: resolveCapabilityFieldId(
      termBinding,
      termRole.fieldRoles.find(role => role.id === 'categories')!
    ),
    status: resolveCapabilityFieldId(
      termBinding,
      termRole.fieldRoles.find(role => role.id === 'status')!
    )
  };
  return {
    config: {
      termSchemaId: termSchema.id,
      categorySchemaId: categorySchema.id,
      fields
    },
    termSchemaId: termSchema.id,
    categorySchemaId: categorySchema.id,
    fieldIds: fields
  };
};

const getCategorySummaries = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  categorySchemaId: string
) => {
  const page = await listEntitiesWithCount(db, workspace, authCtx, {
    schemaId: categorySchemaId,
    view: 'full',
    limit: null,
    offset: 0
  });
  return new Map(
    page.items.map(entity => [
      String(entity._uid),
      {
        id: String(entity._uid),
        name: entityName(entity),
        public_id: entityPublicId(entity)
      }
    ])
  );
};

const collectUsage = async (
  db: DatabaseAdapter,
  workspaceId: string,
  workspaceKey: string,
  entityId: string,
  event: AuthenticatedEvent,
  authCtx: AuthorizationContext
): Promise<GlossaryUsage[]> => {
  const [dependents, documents, projects, diagrams] = await Promise.all([
    getEntityDependents(db, workspaceId, entityId, { transitive: false }, authCtx),
    listRelatedContent(db, workspaceKey, entityId, event),
    getEntityProjects(db, workspaceKey, entityId, event),
    getEntityDiagramFiles(db, workspaceKey, entityId, event)
  ]);

  const usage: GlossaryUsage[] = [];
  const seen = new Set<string>();
  const add = (item: GlossaryUsage) => {
    const key = `${item.kind}:${item.id}:${item.context ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    usage.push(item);
  };

  for (const dependent of dependents.dependents) {
    add({
      kind: dependent.kind === 'typed' ? 'relation' : 'entity',
      id:
        dependent.kind === 'typed'
          ? (dependent.relationId ?? dependent.entityId)
          : dependent.entityId,
      label: dependent.entityName,
      context: dependent.fieldName
    });
  }
  for (const document of documents) {
    add({ kind: 'document', id: document.file.id, label: document.file.name });
  }
  for (const project of projects) {
    add({ kind: 'project', id: project.project.id, label: project.project.name });
  }
  for (const diagram of diagrams) {
    add({ kind: 'diagram', id: diagram.file.id, label: diagram.file.name });
  }
  return usage;
};

const buildTerms = async (
  db: DatabaseAdapter,
  workspace: string,
  workspaceKey: string,
  authCtx: AuthorizationContext,
  event: AuthenticatedEvent,
  resolution: GlossaryResolution
): Promise<GlossaryTerm[]> => {
  const [terms, categories, lifecycleStates] = await Promise.all([
    listEntitiesWithCount(db, workspace, authCtx, {
      schemaId: resolution.termSchemaId,
      view: 'full',
      limit: null,
      offset: 0
    }),
    getCategorySummaries(db, workspace, authCtx, resolution.categorySchemaId),
    db.workspace.listLifecycleStates(workspace)
  ]);
  const deprecatedLifecycleId =
    lifecycleStates.find(state => state.is_deprecated_state)?.id ?? null;

  const aliasesByTerm = new Map<string, string[]>();
  for (const entity of terms.items) {
    aliasesByTerm.set(entity._uid, [
      ...asStrings(entity[resolution.fieldIds.synonyms]),
      ...asStrings(entity[resolution.fieldIds.abbreviations])
    ]);
  }
  const collisions = new Map<string, Set<string>>();
  for (const entity of terms.items) {
    const values = [entityName(entity), ...(aliasesByTerm.get(entity._uid) ?? [])];
    for (const value of values) {
      const key = normalized(value);
      if (!key) continue;
      const termIds = collisions.get(key) ?? new Set<string>();
      termIds.add(entity._uid);
      collisions.set(key, termIds);
    }
  }
  const conflictingValues = new Set(
    [...collisions.entries()].filter(([, ids]) => ids.size > 1).map(([value]) => value)
  );

  const result: GlossaryTerm[] = [];
  for (const entity of terms.items) {
    const aliases = aliasesByTerm.get(entity._uid) ?? [];
    const categoryIds = asStrings(entity[resolution.fieldIds.categories]);
    const categorySummaries = categoryIds.flatMap(categoryId => {
      const category = categories.get(categoryId);
      return category ? [category] : [];
    });
    const usage = await collectUsage(db, workspace, workspaceKey, entity._uid, event, authCtx);
    const conflict = [entityName(entity), ...aliases].some(value =>
      conflictingValues.has(normalized(value))
    );
    const deprecated = lifecycleId(entity) === deprecatedLifecycleId;
    const ownerless = ownerId(entity) == null;
    result.push({
      entity,
      canonicalName: entityName(entity),
      aliases,
      categories: categorySummaries,
      status: valueAsText(entity[resolution.fieldIds.status]),
      usageCount: usage.length,
      quality: {
        unused: usage.length === 0,
        conflicting: conflict,
        deprecated,
        ownerless
      }
    });
  }
  return result.sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));
};

type GlossaryTermQuery = {
  q?: string;
  categoryIds?: string[];
  owner?: string;
  status?: string;
  lifecycle?: string;
  quality?: 'unused' | 'conflicting' | 'deprecated' | 'ownerless';
  limit?: number;
  offset?: number;
};

const filterTerms = (terms: GlossaryTerm[], query: GlossaryTermQuery) => {
  const q = query.q?.trim().toLocaleLowerCase() ?? '';
  const categoryIds = new Set(query.categoryIds ?? []);
  return terms.filter(term => {
    if (
      q &&
      ![term.canonicalName, ...term.aliases].some(value => value.toLocaleLowerCase().includes(q))
    ) {
      return false;
    }
    if (categoryIds.size > 0 && !term.categories.some(category => categoryIds.has(category.id))) {
      return false;
    }
    if (query.owner !== undefined && ownerId(term.entity) !== query.owner) return false;
    if (query.lifecycle !== undefined && lifecycleId(term.entity) !== query.lifecycle) return false;
    if (query.status !== undefined && term.status !== query.status) return false;
    if (query.quality !== undefined && !term.quality[query.quality]) return false;
    return true;
  });
};

const requireGlossary = async (db: DatabaseAdapter, workspace: string) => {
  const resolution = await resolveGlossary(db, workspace);
  httpAssert.present(resolution, {
    status: 404,
    message: 'Business glossary capability is not configured for this workspace'
  });
  return resolution!;
};

export const getGlossaryConfig = async (db: DatabaseAdapter, workspace: string) => {
  const workspaceId = await resolveWorkspace(db.catalog, workspace);
  return (await resolveGlossary(db, workspaceId))?.config ?? null;
};

export const listGlossaryTerms = async (
  db: DatabaseAdapter,
  workspace: string,
  query: GlossaryTermQuery,
  event: AuthenticatedEvent
) =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'entity', workspace },
    fallback: 'Failed to retrieve glossary terms',
    dbErrorMessages: projectDbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      const resolution = await requireGlossary(db, ws);
      const terms = filterTerms(
        await buildTerms(db, ws, workspace, authCtx, event, resolution),
        query
      );
      const offset = query.offset ?? 0;
      const limit = query.limit ?? 50;
      return { items: terms.slice(offset, offset + limit), total: terms.length };
    }
  });

export const getGlossaryTerm = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
) =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'entity', workspace },
    fallback: 'Failed to retrieve glossary term',
    dbErrorMessages: projectDbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      const resolution = await requireGlossary(db, ws);
      const entity = await getEntity(db, ws, id, authCtx);
      httpAssert.true(entity._schema.id === resolution.termSchemaId, {
        status: 404,
        message: `Data record '${id}' is not a glossary term`
      });
      const term = await buildTerms(db, ws, workspace, authCtx, event, resolution);
      const result = term.find(item => item.entity._uid === entity._uid);
      httpAssert.present(result, { status: 404, message: `Glossary term '${id}' not found` });
      return result!;
    }
  });

export const getGlossaryTermUsage = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
) =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'entity', workspace },
    fallback: 'Failed to retrieve glossary term usage',
    dbErrorMessages: projectDbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      const resolution = await requireGlossary(db, ws);
      const entity = await getEntity(db, ws, id, authCtx);
      httpAssert.true(entity._schema.id === resolution.termSchemaId, {
        status: 404,
        message: `Data record '${id}' is not a glossary term`
      });
      return await collectUsage(db, ws, workspace, entity._uid, event, authCtx);
    }
  });

export const listGlossaryReports = async (
  db: DatabaseAdapter,
  workspace: string,
  kind: 'unused' | 'conflicting' | 'deprecated' | 'ownerless',
  limit: number | undefined,
  offset: number | undefined,
  event: AuthenticatedEvent
) => listGlossaryTerms(db, workspace, { quality: kind, limit, offset }, event);
