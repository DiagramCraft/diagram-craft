import { createDatabase } from './factory';
import {
  seedEntities,
  seedCollectionEntities,
  seedCollections,
  seedAiConfig,
  seedAssessments,
  seedGlobalRoleAssignments,
  seedLifecycleStates,
  seedProjectEntityTypes,
  seedLocalUsers,
  seedOwners,
  seedProjectFiles,
  seedAdrDocuments,
  seedProjects,
  seedMilestones,
  seedEntitySnapshots,
  seedProjectEntities,
  seedSavedViews,
  seedEnums,
  seedNotificationEvents,
  seedSchemas,
  seedTeamAssignments,
  seedUserWatches,
  seedWikiPageBodies,
  seedWorkspaceMembers,
  seedWorkspaces
} from './seedData';
import { seededTestPassword, seededWorkspaces } from './seedFixtures';
import { decodeRefs } from '../types';
import { hashPassword } from '../utils/password';
import { UserDbCreate } from './database';
import { ContainmentField, ReferenceField } from '@arch-register/api-types/schemaContract';
import { listAllCatalogEntities } from '../domain/catalog/entityLoader';
import { entityToBaseState } from '../domain/catalog/entityMutations';
import type { StorageAdapter } from '../storage/storage.types';
import { buildDefaultAdrDocuments } from '../domain/document/documentDefaults';
import { randomUUID } from 'node:crypto';
import type { AiConfigInputDbUpsert } from '../domain/ai/db/aiDatabase';

type Database = Awaited<ReturnType<typeof createDatabase>>;

export type BootstrapSeedOptions = {
  aiConfig?: AiConfigInputDbUpsert;
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

  if (errors > 0) throw new Error(`Validation failed with ${errors} error(s)`);
  console.log(
    `  ${workspaces.length} workspaces, ${entities.length} entities validated against ${schemas.length} schemas — OK`
  );
};

const seedBootstrapUsers = async (db: Database) => {
  const passwordHash = await hashPassword(seededTestPassword);
  const now = new Date();

  for (const user of seedLocalUsers) {
    await db.auth.createUser({
      id: user.id,
      user_id: user.user_id,
      email: user.email,
      display_name: user.display_name,
      auth_provider: 'local',
      password_hash: passwordHash,
      oidc_issuer: null,
      oidc_subject: null,
      is_active: true,
      color: user.color,
      created_at: now,
      updated_at: now,
      last_login_at: null
    } as UserDbCreate);
  }

  for (const workspace of seedWorkspaces) {
    await db.workspace.replaceTeamAssignments(
      workspace.id,
      seedTeamAssignments.filter(assignment => assignment.workspace === workspace.id)
    );
  }

  const rolesByUser = new Map<string, Array<(typeof seedGlobalRoleAssignments)[number]['role']>>();
  for (const assignment of seedGlobalRoleAssignments) {
    const current = rolesByUser.get(assignment.user_id) ?? [];
    current.push(assignment.role);
    rolesByUser.set(assignment.user_id, current);
  }

  for (const user of seedLocalUsers) {
    await db.auth.replaceGlobalRoleAssignments(user.id, rolesByUser.get(user.id) ?? [], now);
  }

  for (const member of seedWorkspaceMembers) {
    await db.workspace.setWorkspaceMemberRole(
      member.workspace,
      member.user_id,
      member.role,
      member.created_at
    );
  }
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
  const aiConfig = options.aiConfig ?? seedAiConfig;
  const syncTimestamp = new Date();
  for (const workspace of seedWorkspaces) {
    await db.workspace.createWorkspace(workspace);
    await db.workspace.registerPublicIdPrefix(
      workspace.short_code,
      'workspace',
      workspace.id,
      workspace.created_at
    );
  }
  for (const workspace of seedWorkspaces) {
    await db.workspace.replaceLifecycleStates(
      workspace.id,
      seedLifecycleStates.filter(state => state.workspace === workspace.id)
    );
    await db.workspace.replaceProjectEntityTypes(
      workspace.id,
      seedProjectEntityTypes.filter(t => t.workspace === workspace.id)
    );
    await db.workspace.replaceTeams(
      workspace.id,
      seedOwners.filter(owner => owner.workspace === workspace.id)
    );
  }
  for (const e of seedEnums) {
    await db.catalog.createEnum(e);
  }
  for (const schema of seedSchemas) {
    await db.catalog.createSchema(schema);
    if (schema.key_prefix) {
      await db.workspace.registerPublicIdPrefix(
        schema.key_prefix,
        'schema',
        schema.id,
        schema.created_at
      );
    }
  }
  for (const workspace of seedWorkspaces) {
    await db.ai.upsertAiConfig(workspace.id, aiConfig);
  }
  for (const entity of seedEntities) {
    await db.catalog.createEntity(entity);
  }
  for (const project of seedProjects) {
    await db.project.createProject(project);
  }
  for (const assessment of seedAssessments) {
    await db.project.createAssessment(assessment);
  }
  for (const milestone of seedMilestones) {
    await db.project.createMilestone(milestone);
  }
  for (const link of seedProjectEntities) {
    await db.project.addProjectEntity(link);
  }

  const maxByPrefix = new Map<string, number>();
  for (const item of [...seedProjects, ...seedEntities]) {
    if (!item.public_id) continue;
    const parts = item.public_id.split('-');
    const prefix = parts.slice(0, -1).join('-');
    const seq = parseInt(parts.at(-1) ?? '0', 10);
    if (prefix && !Number.isNaN(seq)) {
      maxByPrefix.set(prefix, Math.max(maxByPrefix.get(prefix) ?? 0, seq));
    }
  }
  for (const [prefix, max] of maxByPrefix) {
    await db.workspace.setPublicIdNextNumber(prefix, max + 1, syncTimestamp);
  }
  for (const view of seedSavedViews) {
    await db.view.createSavedView(view);
  }
  for (const file of seedProjectFiles) {
    await db.project.upsertContentNode({
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
  await db.project.upsertContentNode({
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
  await db.project.createMarkdownRevision({
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
    await db.project.createMarkdownRevision({
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
        entity_id: entity.id,
        version_number: entity.version ?? 1,
        kind: 'autosave',
        commit_message: null,
        created_at: entity.created_at,
        created_by: null,
        state: entityToBaseState(entity),
        applied_case_revision_id: null
      });
    }
  }

  for (const snapshot of seedEntitySnapshots) {
    await db.catalog.createSnapshot(snapshot);
  }

  await seedBootstrapCollections(db);
  await seedBootstrapWatchesAndNotifications(db);
};
