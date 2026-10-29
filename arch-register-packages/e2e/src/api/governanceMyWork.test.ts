import { createApiTest, expect } from '../helpers/fixtures';
import { seedIds, TEST_ADMIN } from '../helpers/seedHelper';

const test = createApiTest();

test.describe('My work submission count', () => {
  test('counts open and request-changes submissions only', async ({ server, orpc }) => {
    const workspace = seedIds.workspace.default;
    const createdAt = new Date();
    const createCase = (id: string) =>
      server.db.governance.createCase({
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

    await createCase('my-work-open');
    await createCase('my-work-request-changes');
    await server.db.governance.completeCaseIfOpen(
      'my-work-request-changes',
      'request_changes',
      createdAt
    );
    await createCase('my-work-approved');
    await server.db.governance.completeCaseIfOpen('my-work-approved', 'approve', createdAt);
    await createCase('my-work-cancelled');
    await server.db.governance.cancelCaseIfOpen('my-work-cancelled', createdAt);

    const result = await orpc.governance.submissions.count({
      params: { workspace: 'default' }
    });

    expect(result).toEqual({ count: 2 });
  });
});
