import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFixtureWorkspace } from './projectFixtures';
import { createFixtureUser } from './authFixtures';

runContractSuiteAgainstBothDrivers('WorkspaceDatabase', getDb => {
  describe('workspace CRUD', () => {
    it('creates, updates and deletes a workspace', async () => {
      const db = getDb();
      const id = await createFixtureWorkspace(db);

      const fetched = await db.workspace.getWorkspace(id);
      expect(fetched!.created_at).toBeInstanceOf(Date);

      const updated = await db.workspace.updateWorkspace(id, {
        name: 'renamed',
        url_slug: fetched!.url_slug,
        short_code: fetched!.short_code,
        color: '#123456',
        description: 'updated',
        updated_at: new Date()
      });
      expect(updated!.name).toBe('renamed');
      expect(updated!.color).toBe('#123456');

      const { workspace: deleted, projectIds } = await db.workspace.deleteWorkspace(id);
      expect(deleted!.id).toBe(id);
      expect(projectIds).toEqual([]);
      expect(await db.workspace.getWorkspace(id)).toBeNull();
    });

    it('deleting an unknown workspace returns a null workspace and empty project list', async () => {
      const db = getDb();
      const result = await db.workspace.deleteWorkspace(randomUUID());
      expect(result).toEqual({ workspace: null, projectIds: [] });
    });
  });

  describe('lifecycle states', () => {
    it('replaces lifecycle states atomically, updating and removing as needed', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const idA = randomUUID();
      const idB = randomUUID();

      const first = await db.workspace.replaceLifecycleStates(workspace, [
        {
          id: idA,
          workspace,
          label: 'Draft',
          color: '#111111',
          sort_order: 0,
          created_at: new Date()
        },
        {
          id: idB,
          workspace,
          label: 'Live',
          color: '#222222',
          sort_order: 1,
          created_at: new Date()
        }
      ]);
      expect(first.map(s => s.label)).toEqual(['Draft', 'Live']);

      const idC = randomUUID();
      const second = await db.workspace.replaceLifecycleStates(workspace, [
        {
          id: idA,
          workspace,
          label: 'Draft (renamed)',
          color: '#111111',
          sort_order: 0,
          created_at: new Date()
        },
        {
          id: idC,
          workspace,
          label: 'Archived',
          color: '#333333',
          sort_order: 1,
          created_at: new Date()
        }
      ]);

      expect(second.map(s => s.id).sort()).toEqual([idA, idC].sort());
      expect(second.find(s => s.id === idA)!.label).toBe('Draft (renamed)');

      const cleared = await db.workspace.replaceLifecycleStates(workspace, []);
      expect(cleared).toEqual([]);
      expect(await db.workspace.listLifecycleStates(workspace)).toEqual([]);
    });
  });

  describe('project entity types', () => {
    it('replaces project entity types atomically', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const id = randomUUID();

      const first = await db.workspace.replaceProjectEntityTypes(workspace, [
        { id, workspace, label: 'Service', sort_order: 0, created_at: new Date() }
      ]);
      expect(first.map(t => t.label)).toEqual(['Service']);

      const second = await db.workspace.replaceProjectEntityTypes(workspace, []);
      expect(second).toEqual([]);
    });
  });

  describe('teams and team assignments', () => {
    it('replaces teams and assignments atomically, dropping orphaned assignments', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);
      const teamA = randomUUID();
      const teamB = randomUUID();

      await db.workspace.replaceTeams(workspace, [
        {
          id: teamA,
          workspace,
          name: 'Team A',
          sort_order: 0,
          color: null,
          description: '',
          created_at: new Date()
        },
        {
          id: teamB,
          workspace,
          name: 'Team B',
          sort_order: 1,
          color: null,
          description: '',
          created_at: new Date()
        }
      ]);

      await db.workspace.replaceTeamAssignments(workspace, [
        { workspace, team_id: teamA, user_id: user.id, role: 'team_editor', created_at: new Date() }
      ]);

      const teamsAfterRemoval = await db.workspace.replaceTeams(workspace, [
        {
          id: teamA,
          workspace,
          name: 'Team A (renamed)',
          sort_order: 0,
          color: '#abcdef',
          description: '',
          created_at: new Date()
        }
      ]);
      expect(teamsAfterRemoval.map(t => t.id)).toEqual([teamA]);

      const assignments = await db.workspace.listTeamAssignments(workspace);
      expect(assignments.map(a => a.team_id)).toEqual([teamA]);
    });

    it('searches teams by name and applies a limit', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const teamA = randomUUID();
      const teamB = randomUUID();

      await db.workspace.replaceTeams(workspace, [
        {
          id: teamA,
          workspace,
          name: 'Platform Engineering',
          sort_order: 0,
          color: null,
          description: '',
          created_at: new Date()
        },
        {
          id: teamB,
          workspace,
          name: 'Platform Operations',
          sort_order: 1,
          color: null,
          description: '',
          created_at: new Date()
        }
      ]);

      const result = await db.workspace.listTeams(workspace, { q: 'platform', limit: 1 });
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('Platform Engineering');
    });
  });

  describe('workspace members and roles', () => {
    it('sets, reads and removes a workspace member role', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);

      const set = await db.workspace.setWorkspaceMemberRole(
        workspace,
        user.id,
        'editor',
        new Date()
      );
      expect(set.role).toBe('editor');

      expect(await db.workspace.getWorkspaceRole(workspace, user.id)).toBe('editor');

      const updated = await db.workspace.setWorkspaceMemberRole(
        workspace,
        user.id,
        'viewer',
        new Date()
      );
      expect(updated.role).toBe('viewer');

      const removed = await db.workspace.removeWorkspaceMember(workspace, user.id);
      expect(removed!.role).toBe('viewer');
      expect(await db.workspace.getWorkspaceMember(workspace, user.id)).toBeNull();
    });

    it('creates, updates and deletes a custom workspace role, and counts members with that role', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);
      const roleId = randomUUID();

      const created = await db.workspace.createCustomWorkspaceRole({
        id: roleId,
        workspace,
        name: `Custom Role ${roleId}`,
        description: 'a custom role',
        tone: 'blue',
        builtin: false,
        capabilities: ['content.view', 'content.edit'],
        created_at: new Date(),
        updated_at: new Date()
      });
      expect(created.capabilities).toEqual(['content.view', 'content.edit']);
      expect(created.builtin).toBe(false);

      await db.workspace.setWorkspaceMemberRole(workspace, user.id, roleId, new Date());
      expect(await db.workspace.countWorkspaceMembersByRole(workspace, roleId)).toBe(1);

      const updated = await db.workspace.updateCustomWorkspaceRole(workspace, roleId, {
        name: created.name,
        description: 'updated description',
        tone: 'green',
        builtin: false,
        capabilities: ['content.view'],
        updated_at: new Date()
      });
      expect(updated!.description).toBe('updated description');
      expect(updated!.capabilities).toEqual(['content.view']);

      const fetched = await db.workspace.getCustomWorkspaceRole(workspace, roleId);
      expect(fetched!.tone).toBe('green');
    });

    it('normalizes a duplicate role name in the same workspace to a unique DatabaseError', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const name = `Duplicate Role ${randomUUID()}`;

      await db.workspace.createCustomWorkspaceRole({
        id: randomUUID(),
        workspace,
        name,
        description: '',
        tone: 'blue',
        builtin: false,
        capabilities: [],
        created_at: new Date(),
        updated_at: new Date()
      });

      await expect(
        db.workspace.createCustomWorkspaceRole({
          id: randomUUID(),
          workspace,
          name,
          description: '',
          tone: 'blue',
          builtin: false,
          capabilities: [],
          created_at: new Date(),
          updated_at: new Date()
        })
      ).rejects.toThrow();
    });
  });

  describe('public id prefix allocation', () => {
    it('registers a prefix and allocates strictly increasing sequential numbers', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const prefix = `PFX${randomUUID().slice(0, 8).toUpperCase()}`;

      await db.workspace.registerPublicIdPrefix(prefix, 'workspace', workspace, new Date());

      const first = await db.workspace.allocatePublicId(prefix, new Date());
      const second = await db.workspace.allocatePublicId(prefix, new Date());
      const third = await db.workspace.allocatePublicId(prefix, new Date());

      expect([first, second, third]).toEqual([1, 2, 3]);
    });

    it('renames a prefix in place, preserving the counter', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const oldPrefix = `OLD${randomUUID().slice(0, 6).toUpperCase()}`;
      const newPrefix = `NEW${randomUUID().slice(0, 6).toUpperCase()}`;

      await db.workspace.registerPublicIdPrefix(oldPrefix, 'workspace', workspace, new Date());
      await db.workspace.allocatePublicId(oldPrefix, new Date());

      await db.workspace.updatePublicIdPrefix(
        oldPrefix,
        newPrefix,
        'workspace',
        workspace,
        new Date()
      );

      const next = await db.workspace.allocatePublicId(newPrefix, new Date());
      expect(next).toBe(2);

      await db.workspace.deletePublicIdPrefix(newPrefix);
    });
  });

  describe('import cache', () => {
    it('stores, reads and deletes an import cache entry with JSON round-trip', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);
      const importId = randomUUID();

      await db.workspace.storeImportCache({
        import_id: importId,
        workspace_id: workspace,
        user_id: user.id,
        manifest: {
          version: '1',
          format: 'zip-multi-file',
          exported_at: new Date().toISOString(),
          exported_by: user.id,
          source_workspace: { id: workspace, name: 'ws', url_slug: 'ws' },
          export_options: [],
          files: {},
          statistics: {
            entity_count: 0,
            project_count: 0,
            schema_count: 0,
            content_node_count: 0,
            total_content_size_bytes: 0
          },
          checksums: {}
        },
        data: { schemas: [] },
        content_files: { 'a.txt': 'aGVsbG8=' },
        created_at: new Date(),
        expires_at: new Date(Date.now() + 60_000)
      });

      const fetched = await db.workspace.getImportCache(importId);
      expect(fetched!.data).toEqual({ schemas: [] });
      expect(fetched!.content_files).toEqual({ 'a.txt': 'aGVsbG8=' });
      expect(fetched!.created_at).toBeInstanceOf(Date);

      await db.workspace.deleteImportCache(importId);
      expect(await db.workspace.getImportCache(importId)).toBeNull();
    });

    it('cleans up only expired import cache entries', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);
      const expiredId = randomUUID();
      const activeId = randomUUID();
      const manifest = {
        version: '1',
        format: 'zip-multi-file' as const,
        exported_at: new Date().toISOString(),
        exported_by: user.id,
        source_workspace: { id: workspace, name: 'ws', url_slug: 'ws' },
        export_options: [],
        files: {},
        statistics: {
          entity_count: 0,
          project_count: 0,
          schema_count: 0,
          content_node_count: 0,
          total_content_size_bytes: 0
        },
        checksums: {}
      };

      await db.workspace.storeImportCache({
        import_id: expiredId,
        workspace_id: workspace,
        user_id: user.id,
        manifest,
        data: {},
        created_at: new Date(),
        expires_at: new Date(Date.now() - 60_000)
      });
      await db.workspace.storeImportCache({
        import_id: activeId,
        workspace_id: workspace,
        user_id: user.id,
        manifest,
        data: {},
        created_at: new Date(),
        expires_at: new Date(Date.now() + 60_000)
      });

      await db.workspace.cleanupExpiredImportCache();

      expect(await db.workspace.getImportCache(expiredId)).toBeNull();
      expect(await db.workspace.getImportCache(activeId)).not.toBeNull();
    });
  });
});
