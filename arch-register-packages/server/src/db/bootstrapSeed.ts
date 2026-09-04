import { seedCollectionEntities, seedCollections, seedWorkspaceDashboards } from './seedData/views';
import { seedEntities } from './seedData/entities';
import {
  demoSeedEntities,
  demoSeedProjectEntities,
  demoSeedRelations
} from './seedData/demoDataset';
import {
  seedAssessments,
  seedChangeCases,
  seedMilestones,
  seedProjectEntities,
  seedProjects
} from './seedData/projects';
import { seedAdrDocuments, seedProjectFiles, seedWikiPageBodies } from './seedData/documents';
import { seedNotificationEvents, seedUserWatches } from './seedData/notifications';
import { seedRelationSchemas, seedRelations } from './seedData/relations';
import { seedCategories } from './seedData/catalog';
import { seededWorkspaces } from './seedFixtures';
import { decodeRefs } from '../types';
import { ContainmentField, ReferenceField } from '@arch-register/api-types/schemaContract';
import { savedViewQuerySchema } from '@arch-register/api-types/viewContract';
import { listAllCatalogEntities } from '../domain/catalog/entityLoader';
import { entityToBaseState } from '../domain/catalog/entityMutations';
import { relationToBaseState } from '../domain/catalog/relationHelpers';
import type { StorageAdapter } from '../storage/storage.types';
import { buildDefaultAdrDocuments } from '../domain/document/documentDefaults';
import { randomUUID } from 'node:crypto';
import { recalculateEntityDerivedFields } from '../domain/derived/derivedRecalculation';
import { ensureDerivedRecalculationScheduleExists } from '../domain/derived/derivedRecalculationJob';
import type { AiConfigInputDbUpsert } from '../domain/ai/db/aiDatabase';
import type { DatabaseAdapter } from './database';
import {
  seedAiConfiguration,
  seedBootstrapUsers,
  seedCatalogDefinitions,
  seedCatalogEntities,
  seedCatalogViews,
  seedPublicIdCounters,
  seedTemplateRelationCapabilityConfigurations,
  seedWorkspaceBase,
  seedWorkspaceConfiguration
} from './seedPhases';

type Database = DatabaseAdapter;

export type BootstrapSeedOptions = {
  aiConfig?: AiConfigInputDbUpsert;
  // 'test' (default) loads the exact dataset seedData.test.ts asserts on; 'demo' loads the richer
  // e-commerce Business Capability tree used for the bootstrap CLI's default demo dataset.
  dataset?: 'test' | 'demo';
};

export const validateBootstrapSeed = async (db: Database) => {
  const workspaces = await db.workspace.listWorkspaces();
  const workspaceIds = new Set(workspaces.map(w => w.id));
  const schemas = (
    await Promise.all(workspaces.map(workspace => db.catalog.listSchemas(workspace.id)))
  ).flat();
  const schemaMap = new Map(schemas.map(s => [`${s.workspace}:${s.id}`, s]));
  const entities = (
    await Promise.all(workspaces.map(workspace => listAllCatalogEntities(db, workspace.id)))
  ).flat();
  const entityMap = new Map(entities.map(e => [`${e.workspace}:${e.id}`, e]));

  let errors = 0;

  for (const schema of schemas) {
    if (!workspaceIds.has(schema.workspace)) {
      console.error(`  [schema:${schema.id}] references unknown workspace '${schema.workspace}'`);
      errors++;
    }
  }

  for (const entity of entities) {
    if (!workspaceIds.has(entity.workspace)) {
      console.error(
        `  [${entity.workspace}:${entity.namespace}/${entity.slug}] references unknown workspace '${entity.workspace}'`
      );
      errors++;
      continue;
    }

    const schema = schemaMap.get(`${entity.workspace}:${entity.schema_id}`);
    if (!schema) {
      console.error(
        `  [${entity.workspace}:${entity.namespace}/${entity.slug}] references unknown schema '${entity.schema_id}'`
      );
      errors++;
      continue;
    }

    for (const field of schema.fields) {
      if (field.type !== 'reference' && field.type !== 'containment') continue;
      const f = field as ReferenceField | ContainmentField;
      const refs = decodeRefs(entity.data[f.id]);

      if (
        f.type === 'containment' &&
        (f.maxCount !== 1 || (f.minCount !== 0 && f.minCount !== 1))
      ) {
        console.error(
          `  [schema:${schema.id}] containment field '${f.id}' must use minCount 0|1 and maxCount 1`
        );
        errors++;
      }

      if (f.minCount > 0 && refs.length < f.minCount) {
        console.error(
          `  [${entity.namespace}/${entity.slug}] (${schema.name}): '${f.id}' requires >=${f.minCount} ref(s), got ${refs.length}`
        );
        errors++;
      }
      if (f.maxCount !== -1 && refs.length > f.maxCount) {
        console.error(
          `  [${entity.namespace}/${entity.slug}] (${schema.name}): '${f.id}' allows <=${f.maxCount} ref(s), got ${refs.length}`
        );
        errors++;
      }
      for (const ref of refs) {
        const target = entityMap.get(`${entity.workspace}:${ref}`);
        if (!target) {
          console.error(
            `  [${entity.workspace}:${entity.namespace}/${entity.slug}] (${schema.name}): '${f.id}' references unknown entity '${ref}'`
          );
          errors++;
        } else if (target.schema_id !== f.schemaId) {
          const targetSchema = schemaMap.get(`${target.workspace}:${target.schema_id}`);
          console.error(
            `  [${entity.workspace}:${entity.namespace}/${entity.slug}] (${schema.name}): '${f.id}' should reference ${
              schemaMap.get(`${entity.workspace}:${f.schemaId}`)?.name ?? f.schemaId
            } but got ${targetSchema?.name ?? target.schema_id}`
          );
          errors++;
        }
      }
    }
  }

  for (const workspace of workspaces) {
    const views = await db.view.listSavedViews(workspace.id);
    for (const view of views) {
      const result = savedViewQuerySchema.safeParse(view.filters);
      if (!result.success) {
        console.error(
          `  [view:${view.id}] has invalid canonical filters: ${result.error.issues
            .map(issue => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ')}`
        );
        errors++;
      }
    }
  }

  if (errors > 0) throw new Error(`Validation failed with ${errors} error(s)`);
  console.log(
    `  ${workspaces.length} workspaces, ${entities.length} entities validated against ${schemas.length} schemas — OK`
  );
};

const seedBootstrapWatchesAndNotifications = async (db: Database) => {
  for (const watch of seedUserWatches) {
    await db.watch.createWatch({
      user_id: watch.user_id,
      workspace: watch.workspace,
      entity_id: watch.entity_id,
      created_at: watch.created_at
    });
  }

  for (const event of seedNotificationEvents) {
    const auditLog = await db.audit.createAuditLog({
      workspace: event.workspace,
      timestamp: event.timestamp,
      user_id: event.user_id,
      operation: event.operation,
      entity_type: 'entity',
      entity_id: event.entity_id,
      entity_name: event.entity_name,
      entity_slug: event.entity_slug,
      schema_id: event.schema_id,
      changes: event.changes,
      metadata: {}
    });

    await db.watch.createNotificationsFromAudit({
      auditLog,
      changedByDisplayName: event.changed_by_display_name
    });
  }
};

const seedBootstrapCollections = async (db: Database) => {
  for (const collection of seedCollections) {
    await db.view.createCollection(collection);
  }

  for (const membership of seedCollectionEntities) {
    const collection = seedCollections.find(item => item.id === membership.collection_id);
    if (!collection) continue;
    await db.view.addCollectionEntity(
      collection.user_id,
      collection.workspace,
      membership.collection_id,
      membership.entity_id,
      membership.created_at
    );
  }
};

export const seedBootstrapData = async (
  db: Database,
  storage: StorageAdapter,
  options: BootstrapSeedOptions = {}
) => {
  const syncTimestamp = new Date();
  const entities = options.dataset === 'demo' ? demoSeedEntities : seedEntities;
  const relations = options.dataset === 'demo' ? demoSeedRelations : seedRelations;
  const projectEntities =
    options.dataset === 'demo' ? demoSeedProjectEntities : seedProjectEntities;
  await seedWorkspaceBase(db);
  await seedWorkspaceConfiguration(db);
  await seedCatalogDefinitions(db);
  await seedAiConfiguration(db, options.aiConfig);
  for (const project of seedProjects) {
    await db.project.projects.createProject(project);
  }
  await seedCatalogEntities(db, entities);
  const categoryNamesById = new Map(seedCategories.map(category => [category.id, category.name]));
  for (const relationSchema of seedRelationSchemas) {
    const createdSchema = await db.relation.createRelationSchema(relationSchema);
    await db.relation.createRelationSchemaVersion({
      id: randomUUID(),
      workspace: createdSchema.workspace,
      schema_id: createdSchema.id,
      version: createdSchema.version ?? 1,
      name: createdSchema.name,
      category:
        (createdSchema.category_id && categoryNamesById.get(createdSchema.category_id)) ?? null,
      description: createdSchema.description,
      in_schema_ids: createdSchema.in_schema_ids,
      out_schema_ids: createdSchema.out_schema_ids,
      in_label: createdSchema.in_label,
      out_label: createdSchema.out_label,
      fields: createdSchema.fields,
      groups: createdSchema.groups ?? [],
      validation_rules: createdSchema.validation_rules ?? [],
      color: createdSchema.color,
      icon: createdSchema.icon,
      unique_endpoint_pair: createdSchema.unique_endpoint_pair ?? false,
      change_summary: { added: createdSchema.fields.map(field => field.id) },
      created_by: null,
      created_at: createdSchema.created_at
    });
  }
  for (const relation of relations) {
    await db.relation.createRelation(relation);
  }
  for (const relationSchema of seedRelationSchemas) {
    if (relationSchema.unique_endpoint_pair) {
      await db.relation.setRelationEndpointPairKeys?.(
        relationSchema.workspace,
        relationSchema.id,
        true
      );
    }
  }
  await seedTemplateRelationCapabilityConfigurations(db);
  await recalculateEntityDerivedFields(db, seededWorkspaces.default.id);
  await ensureDerivedRecalculationScheduleExists(db, seededWorkspaces.default.id, new Date());
  for (const assessment of seedAssessments) {
    await db.project.assessments.createAssessment(assessment);
  }
  for (const milestone of seedMilestones) {
    await db.project.milestones.createMilestone(milestone);
  }
  for (const link of projectEntities) {
    await db.project.projectEntities.addProjectEntity(link);
  }

  await seedPublicIdCounters(db, [...seedProjects, ...entities], syncTimestamp);
  await seedCatalogViews(db);
  for (const dashboard of seedWorkspaceDashboards) {
    const created = await db.dashboard.create({
      id: dashboard.id,
      workspace: dashboard.workspace,
      name: dashboard.name,
      sort_order: dashboard.sort_order,
      updated_by: null
    });
    await db.dashboard.update(dashboard.workspace, created.id, {
      layout: dashboard.layout,
      updated_by: null
    });
  }
  for (const file of seedProjectFiles) {
    await db.project.contentNodes.upsertContentNode({
      id: file.id,
      workspace: file.workspace,
      project_id: file.project_id,
      entity_id: file.entity_id,
      parent_id: file.parent_id,
      path: file.path,
      name: file.name,
      type: file.type as 'diagram' | 'folder' | 'markdown',
      size_bytes: file.size_bytes,
      comment_count: 0,
      unresolved_comment_count: 0,
      created_atIfNew: file.created_at,
      updated_at: file.updated_at
    });

    const body = seedWikiPageBodies[file.id];
    if (body !== undefined) {
      const storageId = file.project_id ?? file.entity_id ?? file.workspace;
      await storage.write(
        file.workspace,
        storageId,
        file.id,
        Buffer.from(JSON.stringify({ body }), 'utf8')
      );
    }
  }

  const adr = buildDefaultAdrDocuments(seededWorkspaces.default.id, syncTimestamp);
  await db.document.createDocumentType(adr.documentType);
  await db.document.createDocumentTemplate(adr.template);
  const exampleNodeId = randomUUID();
  const exampleBody =
    '# Initial architecture decision\n\n## Context\n\nThis is a typed ADR seeded for development.\n\n## Decision drivers\n\n## Considered options\n\n## Decision\n\n## Consequences\n';
  await db.project.contentNodes.upsertContentNode({
    id: exampleNodeId,
    workspace: seededWorkspaces.default.id,
    project_id: null,
    entity_id: null,
    parent_id: null,
    path: 'adr/initial-architecture-decision.md',
    name: 'Initial architecture decision',
    type: 'markdown',
    size_bytes: Buffer.byteLength(JSON.stringify({ body: exampleBody }), 'utf8'),
    comment_count: 0,
    unresolved_comment_count: 0,
    created_atIfNew: syncTimestamp,
    updated_at: syncTimestamp
  });
  await db.document.upsertDocumentMetadata({
    workspace: seededWorkspaces.default.id,
    node_id: exampleNodeId,
    document_type_id: adr.documentType.id,
    values: { status: 'Proposed' },
    updated_at: syncTimestamp
  });
  await db.project.markdownRevisions.createMarkdownRevision({
    workspace: seededWorkspaces.default.id,
    node_id: exampleNodeId,
    revision_number: 1,
    title: 'Initial architecture decision',
    body: exampleBody,
    created_at: syncTimestamp,
    created_by: null,
    document_type_id: adr.documentType.id,
    metadata: { status: 'Proposed' }
  });
  await storage.write(
    seededWorkspaces.default.id,
    seededWorkspaces.default.id,
    exampleNodeId,
    Buffer.from(JSON.stringify({ body: exampleBody }), 'utf8')
  );

  for (const seededAdr of seedAdrDocuments) {
    const file = seedProjectFiles.find(item => item.id === seededAdr.id);
    const body = file ? seedWikiPageBodies[file.id] : undefined;
    if (!file || body === undefined) continue;

    const metadata = {
      status: seededAdr.status,
      decision_date: seededAdr.decision_date
    };
    await db.document.upsertDocumentMetadata({
      workspace: seededWorkspaces.default.id,
      node_id: file.id,
      document_type_id: adr.documentType.id,
      values: metadata,
      updated_at: syncTimestamp
    });
    await db.project.markdownRevisions.createMarkdownRevision({
      workspace: seededWorkspaces.default.id,
      node_id: file.id,
      revision_number: 1,
      title: file.name,
      body,
      created_at: syncTimestamp,
      created_by: null,
      document_type_id: adr.documentType.id,
      metadata
    });
  }

  await seedBootstrapUsers(db);

  // Seed the actual current state into the target historical version model before adding
  // planned cases. Seed data is a clean bootstrap, so no legacy snapshot backfill is needed.
  for (const workspace of Object.values(seededWorkspaces)) {
    const entities = await listAllCatalogEntities(db, workspace.id);
    for (const entity of entities) {
      const versions = await db.catalog.listEntityVersions(workspace.id, entity.id);
      if (versions.length > 0) continue;
      await db.catalog.createEntityVersion({
        id: randomUUID(),
        workspace: workspace.id,
        record_id: entity.id,
        version_number: entity.version ?? 1,
        kind: 'autosave',
        commit_message: null,
        created_at: entity.created_at,
        created_by: null,
        state: entityToBaseState(entity),
        applied_case_revision_id: null
      });
    }

    const relations = (
      await db.relation.listRelations(workspace.id, {}, { limit: null, offset: 0 })
    ).items;
    for (const relation of relations) {
      const versions = await db.catalog.listEntityVersions(workspace.id, relation.id);
      if (versions.length > 0) continue;
      await db.catalog.createEntityVersion({
        id: randomUUID(),
        workspace: workspace.id,
        record_id: relation.id,
        version_number: relation.version,
        kind: 'autosave',
        commit_message: null,
        created_at: relation.created_at,
        created_by: null,
        state: relationToBaseState(relation),
        applied_case_revision_id: null
      });
    }
  }

  for (const changeCase of seedChangeCases) {
    await db.changeCase.createCase(changeCase);
  }

  await seedBootstrapCollections(db);
  await seedBootstrapWatchesAndNotifications(db);
};
