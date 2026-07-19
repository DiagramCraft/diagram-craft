import { test, expect } from '../helpers/fixtures';

test.describe('dev user switcher (disabled by default)', () => {
  test('GET /api/dev/config reports disabled', async ({ orpc }) => {
    const result = await orpc.dev.config(undefined);
    expect(result).toEqual({ enabled: false });
  });

  test('GET /api/dev/users is forbidden when disabled', async ({ orpc }) => {
    await expect(orpc.dev.listUsers(undefined)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  test('POST /api/dev/switch-user is forbidden when disabled', async ({ orpc }) => {
    await expect(orpc.dev.switchUser({ body: { userId: 'anything' } })).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
  });
});
