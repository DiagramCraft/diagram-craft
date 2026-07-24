import { test, expect, createTestORPCClient } from '../helpers/fixtures';
import { seedIds } from '../helpers/seedHelper';
import { NONEXISTENT_UUID } from '../helpers/testIds';

const seededEnumId = '00000000-0000-0000-0000-e00000000001';

test.describe('GET /api/:workspace/enums', () => {
  test('returns seeded enums for the default workspace', async ({ orpc }) => {
    const enums = await orpc.enums.list({ params: { workspace: 'default' } });
    expect(enums.length).toBeGreaterThan(0);
    expect(enums).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: seededEnumId,
          workspace: seedIds.workspace.default,
          name: 'API Type',
          options: expect.arrayContaining([{ value: 'openapi', label: 'OpenAPI' }]),
          created_at: expect.any(String),
          updated_at: expect.any(String)
        })
      ])
    );
  });

  test('returns 404 for unknown workspace', async ({ orpc }) => {
    await expect(orpc.enums.list({ params: { workspace: 'nonexistent' } })).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  test('returns 401 without authentication', async ({ server }) => {
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(anonOrpc.enums.list({ params: { workspace: 'default' } })).rejects.toMatchObject({
      code: 'UNAUTHORIZED'
    });
  });
});

test.describe('GET /api/:workspace/enums/:id', () => {
  test('returns a seeded enum by id', async ({ orpc }) => {
    const result = await orpc.enums.get({ params: { workspace: 'default', id: seededEnumId } });
    expect(result).toMatchObject({
      id: seededEnumId,
      workspace: seedIds.workspace.default,
      name: 'API Type'
    });
  });

  test('returns 404 for an unknown enum id', async ({ orpc }) => {
    await expect(
      orpc.enums.get({ params: { workspace: 'default', id: NONEXISTENT_UUID } })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

test.describe('POST /api/:workspace/enums', () => {
  test('creates an enum with explicit options and sort order', async ({ orpc }) => {
    const result = await orpc.enums.create({
      params: { workspace: 'default' },
      body: {
        name: 'Deployment Stage',
        options: [{ value: 'prod', label: 'Production' }],
        sort_order: 9
      }
    });
    expect(result).toMatchObject({
      workspace: seedIds.workspace.default,
      name: 'Deployment Stage',
      options: [{ value: 'prod', label: 'Production' }],
      sort_order: 9
    });
    expect(result.id).toEqual(expect.any(String));
  });

  test('defaults options and sort order when omitted or invalid', async ({ orpc }) => {
    const result = await orpc.enums.create({
      params: { workspace: 'default' },
      body: { name: 'Environment' }
    });
    expect(result).toMatchObject({ name: 'Environment', options: [], sort_order: 0 });
  });

  test('returns 400 for a non-object request body', async ({ orpc }) => {
    await expect(
      orpc.enums.create({
        params: { workspace: 'default' },
        body: { name: undefined as unknown as string }
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  test('returns 409 for a duplicate enum name', async ({ orpc }) => {
    await expect(
      orpc.enums.create({ params: { workspace: 'default' }, body: { name: 'API Type' } })
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'An enum with that name already exists in this workspace'
    });
  });
});

test.describe('PUT /api/:workspace/enums/:id', () => {
  test('updates an enum when all mutable fields are provided', async ({ orpc }) => {
    const created = await orpc.enums.create({
      params: { workspace: 'default' },
      body: { name: 'Change Type', options: [{ value: 'minor', label: 'Minor' }], sort_order: 1 }
    });

    const updated = await orpc.enums.update({
      params: { workspace: 'default', id: created.id },
      body: {
        name: 'Change Classification',
        options: [{ value: 'major', label: 'Major' }],
        sort_order: 4
      }
    });
    expect(updated).toMatchObject({
      id: created.id,
      name: 'Change Classification',
      options: [{ value: 'major', label: 'Major' }],
      sort_order: 4
    });
  });

  test('preserves options and sort order when omitted', async ({ orpc }) => {
    const created = await orpc.enums.create({
      params: { workspace: 'default' },
      body: { name: 'Risk Level', options: [{ value: 'low', label: 'Low' }], sort_order: 6 }
    });

    const updated = await orpc.enums.update({
      params: { workspace: 'default', id: created.id },
      body: { name: 'Risk Severity' }
    });
    expect(updated).toMatchObject({
      id: created.id,
      name: 'Risk Severity',
      options: [{ value: 'low', label: 'Low' }],
      sort_order: 6
    });
  });

  test('returns 404 for an unknown enum id', async ({ orpc }) => {
    await expect(
      orpc.enums.update({
        params: { workspace: 'default', id: NONEXISTENT_UUID },
        body: { name: 'Nope' }
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

test.describe('DELETE /api/:workspace/enums/:id', () => {
  test('deletes an unreferenced enum', async ({ orpc }) => {
    const created = await orpc.enums.create({
      params: { workspace: 'default' },
      body: { name: 'Temporary Enum' }
    });

    const result = await orpc.enums.remove({ params: { workspace: 'default', id: created.id } });
    expect(result).toEqual({ success: true, message: `Enum '${created.id}' deleted` });
  });

  test('returns 409 for a referenced enum', async ({ orpc }) => {
    await expect(
      orpc.enums.remove({ params: { workspace: 'default', id: seededEnumId } })
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Cannot delete enum: it is still referenced by one or more schema fields'
    });
  });

  test('returns 404 for an unknown enum id', async ({ orpc }) => {
    await expect(
      orpc.enums.remove({ params: { workspace: 'default', id: NONEXISTENT_UUID } })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
