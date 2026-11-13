import { randomUUID } from 'node:crypto';
import { createApiTest, expect } from '../helpers/fixtures';
import { seedIds, TEST_ADMIN } from '../helpers/seedHelper';

const test = createApiTest();

test.describe('My work submission count', () => {
  test('counts open and request-changes submissions only', async ({ server, orpc }) => {
    const workspace = seedIds.workspace.default;
    const createdAt = new Date();
    // Case ids are UUIDs in Postgres
    const createCase = async () => {
      const id = randomUUID();
      await server.db.governance.createCase({
        id,
        workspace,
        case_kind: 'test.my-work',
        subject_type: 'assessment',
        subject_id: id,
        subject_version: null,
        policy_version: null,
        initiator_user_id: TEST_ADMIN.id,
        parent_case_id: null,
        dedupe_key: null,
        self_approval_allowed: false,
        payload: {},
        created_at: createdAt,
        due_at: null
      });
      return id;
    };

    await createCase();
    const requestChangesId = await createCase();
    await server.db.governance.completeCaseIfOpen(requestChangesId, 'request_changes', createdAt);
    const approvedId = await createCase();
    await server.db.governance.completeCaseIfOpen(approvedId, 'approve', createdAt);
    const cancelledId = await createCase();
    await server.db.governance.cancelCaseIfOpen(cancelledId, createdAt);

    const result = await orpc.governance.submissions.count({
      params: { workspace: 'default' }
    });

    expect(result).toEqual({ count: 2 });
  });
});
