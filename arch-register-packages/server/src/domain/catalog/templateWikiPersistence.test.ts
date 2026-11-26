import { describe, expect, it } from 'vitest';
import { provisionSqliteDatabase } from '../../db/testSupport/provisionDatabase';
import { seedWorkspaceBase } from '../../db/seedPhases';
import { seededWorkspaces } from '../../db/seedFixtures';
import { MemoryStorage } from '../../storage/memory';
import { persistTemplateWikiPages } from './templateWikiPersistence';
import { buildTemplateWikiPages } from './templateWikiPages';

describe('persistTemplateWikiPages', () => {
  it('writes nodes and bodies, and does not overwrite existing pages', async () => {
    const provisioned = await provisionSqliteDatabase();
    try {
      await seedWorkspaceBase(provisioned.db);
      const workspaceId = seededWorkspaces.default.id;
      const storage = new MemoryStorage();
      const options = { workspaceId, templateIds: ['default'] };
      const now = new Date('2026-08-10T00:00:00.000Z');

      await persistTemplateWikiPages(provisioned.db, storage, options, now, null);

      const overview = buildTemplateWikiPages(options).find(
        n => n.path === 'data-model/default/overview'
      )!;
      const stored = await storage.read(workspaceId, workspaceId, overview.id);
      expect(JSON.parse(stored!.toString('utf8')).body).toBe(overview.body);

      await storage.write(
        workspaceId,
        workspaceId,
        overview.id,
        Buffer.from(JSON.stringify({ body: 'edited' }), 'utf8')
      );
      await persistTemplateWikiPages(provisioned.db, storage, options, now, null);
      const again = await storage.read(workspaceId, workspaceId, overview.id);
      expect(JSON.parse(again!.toString('utf8')).body).toBe('edited');
    } finally {
      await provisioned.teardown();
    }
  });
});
