import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import {
  buildFixtureEntityGrant,
  buildFixtureTeamMembership,
  buildFixtureWorkspaceMember,
  createFixtureEntity,
  createFixtureProject,
  createFixtureSchema,
  createFixtureUser,
  createFixtureWorkspace
} from '../testSupport/fixtures';

runContractSuiteAgainstBothDrivers('shared typed database fixtures', getDb => {
  it('creates an isolated, composable dataset with typed overrides', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db, {
      name: 'Fixture workspace',
      short_code: 'FIX'
    });
    const schema = await createFixtureSchema(db, workspace, {
      name: 'Fixture schema',
      key_prefix: 'FIX'
    });
    const entity = await createFixtureEntity(db, workspace, schema, {
      name: 'Fixture entity',
      slug: 'fixture-entity'
    });
    const project = await createFixtureProject(db, workspace, {
      name: 'Fixture project',
      status: 'draft'
    });
    const user = await createFixtureUser(db, {
      user_id: 'fixture-user',
      email: 'fixture@example.com',
      password: 'FixturePassword123!'
    });

    const member = buildFixtureWorkspaceMember(workspace, user.id, {
      role: 'viewer'
    });
    await db.workspace.setWorkspaceMemberRole(
      member.workspace,
      member.user_id,
      member.role,
      member.created_at
    );

    const teamId = randomUUID();
    await db.workspace.replaceTeams(workspace, [
      {
        id: teamId,
        workspace,
        name: 'Fixture team',
        sort_order: 0,
        color: null,
        description: '',
        created_at: new Date()
      }
    ]);
    const teamMembership = buildFixtureTeamMembership(workspace, teamId, user.id);
    await db.workspace.replaceTeamAssignments(workspace, [teamMembership]);

    const grant = buildFixtureEntityGrant(workspace, entity.id, 'user', user.id, {
      applies_to: 'subtree'
    });
    const grants = await db.catalog.replaceEntityGrants(workspace, entity.id, [grant]);

    expect(new Set((await db.workspace.listWorkspaces()).map(row => row.id))).toEqual(
      new Set([workspace])
    );
    expect(new Set((await db.catalog.listSchemas(workspace)).map(row => row.id))).toEqual(
      new Set([schema])
    );
    expect(new Set((await db.catalog.listEntities(workspace)).map(row => row.id))).toEqual(
      new Set([entity.id])
    );
    expect(new Set((await db.project.listProjects(workspace)).map(row => row.id))).toEqual(
      new Set([project.id])
    );
    expect(
      (await db.auth.listUsers()).filter(row => !row.is_system_actor).map(row => row.id)
    ).toEqual([user.id]);
    expect(await db.workspace.getWorkspaceMember(workspace, user.id)).toMatchObject(member);
    expect(await db.workspace.listTeamAssignments(workspace)).toEqual([teamMembership]);
    expect(grants).toEqual([grant]);
  });
});
