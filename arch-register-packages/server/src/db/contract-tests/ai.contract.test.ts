import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFixtureWorkspace } from './projectFixtures';
import { createFixtureUser } from './authFixtures';

runContractSuiteAgainstBothDrivers('AiDatabase', getDb => {
  describe('ai config', () => {
    it('creates a config on first upsert with defaults applied', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);

      const created = await db.ai.upsertAiConfig(workspace, {});

      expect(created.provider).toBe('openrouter');
      expect(created.enabled).toBe(true);
      expect(created.created_at).toBeInstanceOf(Date);
      expect(created.updated_at).toBeInstanceOf(Date);
    });

    it('upserting twice keeps a single row and merges fields', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);

      await db.ai.upsertAiConfig(workspace, { provider: 'openai', model: 'gpt-4' });
      const second = await db.ai.upsertAiConfig(workspace, { temperature: 0.5 });

      expect(second.provider).toBe('openai');
      expect(second.model).toBe('gpt-4');
      expect(second.temperature).toBe(0.5);

      const fetched = await db.ai.getAiConfig(workspace);
      expect(fetched!.provider).toBe('openai');
    });
  });

  describe('conversations and messages', () => {
    it('creates, lists and updates a conversation title', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);

      const created = await db.ai.createConversation({
        id: randomUUID(),
        workspace,
        user_id: user.id,
        title: 'New conversation',
        created_at: new Date(),
        updated_at: new Date()
      });

      expect(created.created_at).toBeInstanceOf(Date);

      const listed = await db.ai.listConversations(workspace, user.id);
      expect(listed.map(c => c.id)).toContain(created.id);

      const updated = await db.ai.updateConversationTitle(workspace, created.id, 'Renamed');
      expect(updated!.title).toBe('Renamed');
    });

    it('initConversationTitle only sets the title once', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);

      const created = await db.ai.createConversation({
        id: randomUUID(),
        workspace,
        user_id: user.id,
        title: 'New conversation',
        created_at: new Date(),
        updated_at: new Date()
      });

      await db.ai.initConversationTitle(workspace, created.id, 'First title');
      await db.ai.initConversationTitle(workspace, created.id, 'Second title');

      const fetched = await db.ai.getConversation(workspace, created.id);
      expect(fetched!.title).toBe('First title');
    });

    it('deletes a conversation and returns null on a second delete', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);

      const created = await db.ai.createConversation({
        id: randomUUID(),
        workspace,
        user_id: user.id,
        title: 'New conversation',
        created_at: new Date(),
        updated_at: new Date()
      });

      const deleted = await db.ai.deleteConversation(workspace, created.id);
      expect(deleted!.id).toBe(created.id);

      expect(await db.ai.deleteConversation(workspace, created.id)).toBeNull();
      expect(await db.ai.getConversation(workspace, created.id)).toBeNull();
    });

    it('creates messages with JSON metadata round-tripped and lists them in order', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);

      const conversation = await db.ai.createConversation({
        id: randomUUID(),
        workspace,
        user_id: user.id,
        title: 'New conversation',
        created_at: new Date(),
        updated_at: new Date()
      });

      const first = await db.ai.createMessage({
        id: randomUUID(),
        conversation_id: conversation.id,
        role: 'user',
        content: 'hello',
        metadata: { tokens: 3 },
        created_at: new Date(Date.now() - 1000)
      });
      const second = await db.ai.createMessage({
        id: randomUUID(),
        conversation_id: conversation.id,
        role: 'assistant',
        content: 'hi there',
        metadata: {},
        created_at: new Date()
      });

      expect(first.metadata).toEqual({ tokens: 3 });
      expect(second.metadata).toEqual({});

      const messages = await db.ai.listMessages(conversation.id);
      expect(messages.map(m => m.id)).toEqual([first.id, second.id]);
    });
  });
});
