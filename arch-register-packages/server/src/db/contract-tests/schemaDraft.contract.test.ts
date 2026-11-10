import { describe, expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFixtureWorkspace } from '../testSupport/fixtures';
import type { SchemaDraftStageInput } from '../../domain/schemaDraft/db/schemaDraftDatabase';

runContractSuiteAgainstBothDrivers('SchemaDraftDatabase', getDb => {
  const item = (
    workspace: string,
    item_id: string,
    overrides: Partial<SchemaDraftStageInput> = {}
  ): SchemaDraftStageInput => ({
    workspace,
    kind: 'enum',
    item_id,
    op: 'create',
    payload: { name: item_id, options: [{ value: 'a' }] },
    base_version: null,
    updated_by: null,
    ...overrides
  });

  describe('draft', () => {
    it('has no draft until the first item is staged', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      expect(await db.schemaDraft.getDraft(workspace)).toBeNull();
      expect(await db.schemaDraft.listItems(workspace)).toEqual([]);
    });

    it('creates the draft at revision 1 and bumps it on each change', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const first = await db.schemaDraft.stageItem(item(workspace, 'one'), 0);
      expect(first?.revision).toBe(1);
      const second = await db.schemaDraft.stageItem(item(workspace, 'two'), 1);
      expect(second?.revision).toBe(2);
      const items = await db.schemaDraft.listItems(workspace);
      expect(items.map(i => i.item_id)).toEqual(['one', 'two']);
      expect(items[0]?.payload).toEqual({ name: 'one', options: [{ value: 'a' }] });
    });

    it('replaces an item staged twice (unique per kind and item)', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      await db.schemaDraft.stageItem(item(workspace, 'one'), 0);
      await db.schemaDraft.stageItem(
        item(workspace, 'one', { op: 'update', payload: { name: 'renamed' } }),
        1
      );
      const items = await db.schemaDraft.listItems(workspace);
      expect(items).toHaveLength(1);
      expect(items[0]?.op).toBe('update');
      expect(items[0]?.payload).toEqual({ name: 'renamed' });
    });

    it('allows the same item id for different kinds', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      await db.schemaDraft.stageItem(item(workspace, 'x', { kind: 'enum' }), 0);
      await db.schemaDraft.stageItem(item(workspace, 'x', { kind: 'category' }), 1);
      expect(await db.schemaDraft.listItems(workspace)).toHaveLength(2);
    });

    it('rejects a stale expected revision without writing', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      await db.schemaDraft.stageItem(item(workspace, 'one'), 0);
      expect(await db.schemaDraft.stageItem(item(workspace, 'two'), 0)).toBeNull();
      expect(await db.schemaDraft.stageItem(item(workspace, 'two'), 5)).toBeNull();
      expect((await db.schemaDraft.getDraft(workspace))?.revision).toBe(1);
      expect(await db.schemaDraft.listItems(workspace)).toHaveLength(1);
    });

    it('unstages an item and rejects a stale revision', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      await db.schemaDraft.stageItem(item(workspace, 'one'), 0);
      expect(await db.schemaDraft.unstageItem(workspace, 'enum', 'one', 9, null)).toBeNull();
      expect(await db.schemaDraft.listItems(workspace)).toHaveLength(1);
      const draft = await db.schemaDraft.unstageItem(workspace, 'enum', 'one', 1, null);
      expect(draft?.revision).toBe(2);
      expect(await db.schemaDraft.listItems(workspace)).toEqual([]);
    });

    it('discards the draft and its items, rejecting a stale revision', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      await db.schemaDraft.stageItem(item(workspace, 'one'), 0);
      expect(await db.schemaDraft.discard(workspace, 7)).toBe(false);
      expect(await db.schemaDraft.getDraft(workspace)).not.toBeNull();
      expect(await db.schemaDraft.discard(workspace, 1)).toBe(true);
      expect(await db.schemaDraft.getDraft(workspace)).toBeNull();
      expect(await db.schemaDraft.listItems(workspace)).toEqual([]);
    });

    it('does not touch live enums or categories', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      await db.schemaDraft.stageItem(item(workspace, 'one'), 0);
      await db.schemaDraft.stageItem(item(workspace, 'cat', { kind: 'category' }), 1);
      expect(await db.catalog.listEnums(workspace)).toEqual([]);
      expect(await db.catalog.listSchemas(workspace)).toEqual([]);
    });
  });

  describe('schema change mode', () => {
    it('defaults to direct and can be switched', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      expect(await db.schemaDraft.getSchemaChangeMode(workspace)).toBe('direct');
      await db.schemaDraft.setSchemaChangeMode(workspace, 'draft', null);
      expect(await db.schemaDraft.getSchemaChangeMode(workspace)).toBe('draft');
      await db.schemaDraft.setSchemaChangeMode(workspace, 'direct', null);
      expect(await db.schemaDraft.getSchemaChangeMode(workspace)).toBe('direct');
    });
  });

  describe('audit', () => {
    it('accepts schema_draft audit entries', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const log = await db.audit.createAuditLog({
        workspace,
        timestamp: new Date(),
        user_id: null,
        operation: 'update',
        entity_type: 'schema_draft',
        entity_id: workspace,
        entity_name: 'Schema draft',
        entity_slug: null,
        schema_id: null,
        changes: {},
        metadata: {},
        dedupe_key: null
      });
      expect(log.entity_type).toBe('schema_draft');
    });
  });
});
