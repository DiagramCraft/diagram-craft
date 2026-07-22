import { createApiTest, createTestORPCClient, expect } from '../helpers/fixtures';
import { seedCatalogEntities, seedIds } from '../helpers/seedHelper';
import { hashApiToken } from '@arch-register/server/domain/auth/apiTokens';

const test = createApiTest({
  afterSeed: async server => {
    await seedCatalogEntities(server.db);
  }
});

test.describe('workspace API tokens', () => {
  test('allows a view plus external-update token to change only an external field', async ({
    server,
    orpc
  }) => {
    const workspace = seedIds.workspace.default;
    const schemaId = '00000000-0000-0000-000e-000000000001';
    const entityId = '00000000-0000-0000-000e-000000000002';
    const now = new Date();
    await server.db.catalog.createSchema({
      id: schemaId,
      workspace,
      name: 'External integration test',
      description: '',
      fields: [
        { id: 'repository', name: 'Repository', type: 'text' },
        {
          id: 'latest_release',
          name: 'Latest release',
          type: 'text',
          external_kind: 'integration',
          refresh_mode: 'on_change'
        }
      ],
      color: null,
      icon: null,
      default_owner: null,
      key_prefix: 'EXT',
      created_at: now,
      updated_at: now
    });
    await server.db.catalog.createEntity({
      id: entityId,
      workspace,
      public_id: 'EXT-001',
      slug: 'external-integration-test',
      namespace: 'default',
      name: 'External integration test',
      description: '',
      owner: null,
      lifecycle: null,
      target_lifecycle: null,
      target_lifecycle_date: null,
      tags: [],
      links: [],
      schema_id: schemaId,
      data: { repository: 'owner/repo', latest_release: 'v1.0.0' },
      project_id: null,
      created_at: now,
      updated_at: now
    });

    const created = await orpc.authProtected.apiTokens.create({
      body: {
        workspace: 'default',
        name: 'External release integration',
        capabilities: ['content.view', 'ent.external_update']
      }
    });
    const tokenClient = createTestORPCClient(server.baseUrl, `Bearer ${created.token}`);
    const entity = await tokenClient.entities.get({
      params: { workspace: 'default', id: entityId }
    });

    const updated = await tokenClient.entities.update({
      params: { workspace: 'default', id: entityId },
      body: {
        _schemaId: schemaId,
        _name: entity._name,
        _slug: entity._slug,
        _namespace: entity._namespace,
        _description: entity._description,
        _owner: null,
        _lifecycle: null,
        _targetLifecycle: null,
        _targetLifecycleDate: null,
        _tags: [],
        _links: [],
        repository: 'owner/repo',
        latest_release: 'v2.0.0',
        _external: {
          fieldId: 'latest_release',
          kind: 'integration',
          source: 'github-releases',
          requestId: 'event-1'
        }
      } as never
    });
    expect(updated.latest_release).toBe('v2.0.0');

    await expect(
      tokenClient.entities.update({
        params: { workspace: 'default', id: entityId },
        body: {
          _schemaId: schemaId,
          _name: entity._name,
          _slug: entity._slug,
          _namespace: entity._namespace,
          _description: entity._description,
          _owner: null,
          _lifecycle: null,
          _targetLifecycle: null,
          _targetLifecycleDate: null,
          _tags: [],
          _links: [],
          repository: 'changed/repo',
          latest_release: 'v2.0.0'
        } as never
      })
    ).rejects.toMatchObject({ status: 403 });

    await orpc.authProtected.apiTokens.revoke({
      params: { id: created.id }
    });
  });

  test('creates a restricted token, authenticates workspace API calls, and revokes it', async ({
    server,
    orpc
  }) => {
    const created = await orpc.authProtected.apiTokens.create({
      body: {
        workspace: 'default',
        name: 'Release pipeline',
        capabilities: ['ent.edit'],
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      }
    });

    expect(created).toMatchObject({
      name: 'Release pipeline',
      capabilities: ['ent.edit'],
      token: expect.stringMatching(/^ar_pat_/)
    });
    expect(await server.db.auth.listApiTokenAudit(seedIds.workspace.default)).toEqual(
      expect.arrayContaining([expect.objectContaining({ token_id: created.id, event: 'created' })])
    );

    const tokenClient = createTestORPCClient(server.baseUrl, `Bearer ${created.token}`);
    const entities = await tokenClient.entities.list({
      params: { workspace: 'default' },
      query: { view: 'summary' }
    });
    expect(entities.items.length).toBeGreaterThan(0);
    expect(entities.total).toBeGreaterThan(0);
    expect(await server.db.auth.listApiTokenAudit(seedIds.workspace.default)).toEqual(
      expect.arrayContaining([expect.objectContaining({ token_id: created.id, event: 'used' })])
    );

    await expect(
      tokenClient.schemas.list({ params: { workspace: 'default' } })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(
      tokenClient.entities.list({ params: { workspace: 'second' }, query: { view: 'summary' } })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const listed = await orpc.authProtected.apiTokens.list();
    expect(listed).toEqual([expect.objectContaining({ id: created.id, name: 'Release pipeline' })]);
    expect(listed[0]).not.toHaveProperty('token');
    expect(listed[0]).not.toHaveProperty('token_hash');
    expect(await server.db.auth.getApiTokenByHash(hashApiToken(created.token))).toMatchObject({
      last_used_at: expect.any(Date)
    });

    await orpc.authProtected.apiTokens.revoke({ params: { id: created.id } });
    expect(await server.db.auth.listApiTokenAudit(seedIds.workspace.default)).toEqual(
      expect.arrayContaining([expect.objectContaining({ token_id: created.id, event: 'revoked' })])
    );

    await expect(
      tokenClient.entities.list({ params: { workspace: 'default' }, query: { view: 'summary' } })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('rejects non-editor capabilities and non-future expiration dates', async ({ orpc }) => {
    const defaultExpiry = await orpc.authProtected.apiTokens.create({
      body: {
        workspace: 'default',
        name: 'Default expiry token',
        capabilities: ['ent.edit']
      }
    });
    expect(defaultExpiry.expires_at).not.toBeNull();

    await expect(
      orpc.authProtected.apiTokens.create({
        body: { workspace: 'default', name: 'Admin token', capabilities: ['ws.settings'] }
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    await expect(
      orpc.authProtected.apiTokens.create({
        body: {
          workspace: 'default',
          name: 'Expired token',
          capabilities: ['ent.edit'],
          expires_at: new Date(Date.now() - 60_000).toISOString()
        }
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    await expect(
      orpc.authProtected.apiTokens.create({
        body: {
          workspace: 'default',
          name: 'Long-lived token',
          capabilities: ['ent.edit'],
          expires_at: new Date(Date.now() + 366 * 24 * 60 * 60 * 1000).toISOString()
        }
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  test('limits a user to ten tokens per workspace', async ({ orpc }) => {
    for (let index = 0; index < 10; index += 1) {
      await orpc.authProtected.apiTokens.create({
        body: {
          workspace: 'second',
          name: `Pipeline ${index + 1}`,
          capabilities: ['ent.edit']
        }
      });
    }

    await expect(
      orpc.authProtected.apiTokens.create({
        body: {
          workspace: 'second',
          name: 'Pipeline 11',
          capabilities: ['ent.edit']
        }
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
