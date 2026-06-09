import 'dotenv/config';
import { createDatabase } from '../db/factory';
import {
  seedEntities,
  seedGlobalRoleAssignments,
  seedLifecycleStates,
  seedLocalUsers,
  seedOwners,
  seedProjectFiles,
  seedProjects,
  seedSavedViews,
  seedEnums,
  seedNotificationEvents,
  seedSchemas,
  seedTeamAssignments,
  seedUserWatches,
  seedWorkspaceMembers,
  seedWorkspaces
} from '../db/seedData';
import type { ContainmentField, ReferenceField } from '../types';
import { decodeRefs } from '../types';
import { hashPassword } from '../utils/password';
import { CreateUserInput } from '../db/database';

async function validate(db: Awaited<ReturnType<typeof createDatabase>>) {
  const workspaces = await db.workspace.listWorkspaces();
  const workspaceIds = new Set(workspaces.map(w => w.id));
  const schemas = (
    await Promise.all(workspaces.map(workspace => db.catalog.listSchemas(workspace.id)))
  ).flat();
  const schemaMap = new Map(schemas.map(s => [`${s.workspace}:${s.id}`, s]));
  const entities = (
    await Promise.all(workspaces.map(workspace => db.catalog.listEntities(workspace.id)))
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
}

const seedTestUsers = async (db: Awaited<ReturnType<typeof createDatabase>>) => {
  const testPassword = 'test';
  const passwordHash = await hashPassword(testPassword);
  const now = new Date();

  for (const user of seedLocalUsers) {
    await db.auth.createUser({
      id: user.id,
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
    } as CreateUserInput);
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
    await db.auth.replaceGlobalRoleAssignments(
      user.id,
      rolesByUser.get(user.id) ?? [],
      now
    );
  }

  for (const member of seedWorkspaceMembers) {
    await db.workspace.setWorkspaceMemberRole(
      member.workspace,
      member.user_id,
      member.role,
      member.created_at
    );
  }

  console.log(
    `  Created ${seedLocalUsers.length} test users with seeded team assignments, workspace roles and global roles (password: test)`
  );
};

const seedWatchesAndNotifications = async (db: Awaited<ReturnType<typeof createDatabase>>) => {
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

  console.log(
    `  Seeded ${seedUserWatches.length} watches and ${seedNotificationEvents.length} notifications for demo users`
  );
};

const seed = async (db: Awaited<ReturnType<typeof createDatabase>>) => {
  for (const workspace of seedWorkspaces) {
    await db.workspace.createWorkspace(workspace);
  }
  for (const workspace of seedWorkspaces) {
    await db.workspace.replaceLifecycleStates(
      workspace.id,
      seedLifecycleStates.filter(state => state.workspace === workspace.id)
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
  }
  for (const entity of seedEntities) {
    await db.catalog.createEntity(entity);
  }
  for (const project of seedProjects) {
    await db.project.createProject(project);
  }
  for (const view of seedSavedViews) {
    await db.view.createSavedView(view);
  }
  for (const file of seedProjectFiles) {
    await db.project.upsertProjectFile({
      workspace: file.workspace,
      project_id: file.project_id,
      path: file.path,
      name: file.name,
      size_bytes: file.size_bytes,
      comment_count: 0,
      unresolved_comment_count: 0,
      created_atIfNew: file.created_at,
      updated_at: file.updated_at
    });
  }

  await seedTestUsers(db);
  await seedWatchesAndNotifications(db);
};

async function main() {
  console.log('Bootstrapping database...');
  const db = await createDatabase({ initialize: false });

  console.log('Resetting schema...');
  await db.core.reset();
  console.log('Schema created.');

  console.log('Seeding data...');
  await seed(db);
  console.log('Seed data loaded.');

  console.log('Validating seed...');
  await validate(db);

  console.log('Bootstrap complete.');
  await db.core.close();
}

main().catch(err => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
