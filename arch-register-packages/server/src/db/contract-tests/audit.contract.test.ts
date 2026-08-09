import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFixtureWorkspace } from './projectFixtures';
import { createFixtureUser } from './authFixtures';

runContractSuiteAgainstBothDrivers('AuditDatabase', getDb => {
  describe('audit logs', () => {
    it('creates an audit log with the user display name joined in', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);

      const created = await db.audit.createAuditLog({
        workspace,
        timestamp: new Date(),
        user_id: user.id,
        operation: 'create',
        entity_type: 'entity',
        entity_id: randomUUID(),
        entity_name: 'my-entity',
        entity_slug: 'my-entity-slug',
        schema_id: null,
        changes: { new: { name: 'my-entity' } },
        metadata: { source: 'test' }
      });

      expect(created.id).toBeTruthy();
      expect(created.user_display_name).toBe(user.display_name);
      expect(created.changes).toEqual({ new: { name: 'my-entity' } });
      expect(created.metadata).toEqual({ source: 'test' });
      expect(await db.audit.getAuditLog(workspace, created.id)).toEqual(created);
      expect(await db.audit.getAuditLog(workspace, randomUUID())).toBeNull();
    });

    it('creates an audit log with a null user and empty JSON columns', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);

      const created = await db.audit.createAuditLog({
        workspace,
        timestamp: new Date(),
        user_id: null,
        operation: 'delete',
        entity_type: 'project',
        entity_id: randomUUID(),
        entity_name: 'my-project',
        entity_slug: null,
        schema_id: null,
        changes: {},
        metadata: {}
      });

      expect(created.user_display_name).toBeNull();
      expect(created.changes).toEqual({});
      expect(created.metadata).toEqual({});
    });

    it('deduplicates audit writes with the same workspace key', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const input = {
        workspace,
        timestamp: new Date(),
        user_id: null,
        operation: 'update' as const,
        entity_type: 'content_node' as const,
        entity_id: randomUUID(),
        entity_name: 'content-node',
        entity_slug: null,
        schema_id: null,
        changes: { new: { name: 'content-node' } },
        metadata: {},
        dedupe_key: 'content-reconciliation:test'
      };

      const first = await db.audit.createAuditLog(input);
      const second = await db.audit.createAuditLog({
        ...input,
        timestamp: new Date(Date.now() + 1_000),
        entity_name: 'changed-name'
      });

      expect(second.id).toBe(first.id);
      expect(
        (await db.audit.listAuditLogs(workspace)).filter(log => log.id === first.id)
      ).toHaveLength(1);
    });

    it('lists audit logs for a workspace ordered by timestamp descending, joined with user display name', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);

      const older = await db.audit.createAuditLog({
        workspace,
        timestamp: new Date(Date.now() - 60_000),
        user_id: user.id,
        operation: 'create',
        entity_type: 'entity',
        entity_id: randomUUID(),
        entity_name: 'older-entity',
        entity_slug: null,
        schema_id: null,
        changes: {},
        metadata: {}
      });
      const newer = await db.audit.createAuditLog({
        workspace,
        timestamp: new Date(),
        user_id: user.id,
        operation: 'update',
        entity_type: 'entity',
        entity_id: randomUUID(),
        entity_name: 'newer-entity',
        entity_slug: null,
        schema_id: null,
        changes: {},
        metadata: {}
      });

      const logs = await db.audit.listAuditLogs(workspace);
      const ids = logs.map(l => l.id);
      expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));
      expect(logs.every(l => l.user_display_name === user.display_name)).toBe(true);
    });
  });
});
