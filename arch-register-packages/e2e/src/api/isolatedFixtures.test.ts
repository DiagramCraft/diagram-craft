import { createApiTest, expect } from '../helpers/fixtures';
import {
  buildFixtureEntityGrant,
  buildFixtureWorkspaceMember,
  createFixtureEntity,
  createFixtureProject,
  createFixtureSchema,
  createFixtureUser,
  createFixtureWorkspace
} from '@arch-register/server/db/testSupport/fixtures';

let fixtureIds: {
  workspace: string;
  schema: string;
  entity: string;
  project: string;
  user: string;
};

const test = createApiTest({
  seed: 'empty',
  afterSeed: async server => {
    const workspace = await createFixtureWorkspace(server.db, {
      name: 'E2E isolated workspace',
      short_code: 'E2E'
    });
    const schema = await createFixtureSchema(server.db, workspace, {
      name: 'E2E isolated schema',
      key_prefix: 'E2E'
    });
    const entity = await createFixtureEntity(server.db, workspace, schema, {
      name: 'E2E isolated entity',
      slug: 'e2e-isolated-entity'
    });
    const project = await createFixtureProject(server.db, workspace, {
      name: 'E2E isolated project'
    });
    const user = await createFixtureUser(server.db, {
      user_id: 'e2e-isolated-user',
      email: 'e2e-isolated@example.com'
    });
    const member = buildFixtureWorkspaceMember(workspace, user.id, { role: 'viewer' });
    await server.db.workspace.setWorkspaceMemberRole(
      member.workspace,
      member.user_id,
      member.role,
      member.created_at
    );
    await server.db.catalog.replaceEntityGrants(workspace, entity.id, [
      buildFixtureEntityGrant(workspace, entity.id, 'user', user.id)
    ]);

    fixtureIds = { workspace, schema, entity: entity.id, project: project.id, user: user.id };
  }
});

test('empty seed profiles contain no unrelated non-system fixture rows', async ({ server }) => {
  expect((await server.db.workspace.listWorkspaces()).map(row => row.id)).toEqual([
    fixtureIds.workspace
  ]);
  expect((await server.db.catalog.listSchemas(fixtureIds.workspace)).map(row => row.id)).toEqual([
    fixtureIds.schema
  ]);
  expect((await server.db.catalog.listEntities(fixtureIds.workspace)).map(row => row.id)).toEqual([
    fixtureIds.entity
  ]);
  expect(
    (await server.db.project.projects.listProjects(fixtureIds.workspace)).map(row => row.id)
  ).toEqual([fixtureIds.project]);
  expect(
    (await server.db.auth.listUsers()).filter(row => !row.is_system_actor).map(row => row.id)
  ).toEqual([fixtureIds.user]);
});
