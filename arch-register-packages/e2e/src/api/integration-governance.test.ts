import { createApiTest, expect } from '../helpers/fixtures';
import { TEST_ADMIN, seedIds } from '../helpers/seedHelper';

const test = createApiTest();

const integrationUrl = (baseUrl: string, path: string) =>
  `${baseUrl}/api/integrations/v1/default${path}`;

test.describe('external governance integration surface', () => {
  test('creates cases and inbox items, then decides an external inbox item', async ({
    server,
    orpc
  }) => {
    await server.db.governanceCaseConfig.upsertCaseConfig({
      workspace: seedIds.workspace.default,
      case_kind: 'assessment.response',
      case_subkind: null,
      enabled: true,
      config: { external: true },
      updated_at: new Date(),
      updated_by: TEST_ADMIN.id
    });
    await orpc.webhooks.create({
      params: { workspace: 'default' },
      body: {
        url: 'https://example.com/governance',
        event_filter: { operations: ['governance.workflow.started'], schema_ids: [] },
        enabled: true
      }
    });
    const token = await orpc.config.tokens.create({
      params: { workspace: 'default' },
      body: {
        name: 'External governance engine',
        capabilities: ['ws.view', 'governance.external']
      }
    });
    const auth = { Authorization: `Bearer ${token.token}`, 'content-type': 'application/json' };
    const createResponse = await fetch(integrationUrl(server.baseUrl, '/governance/cases'), {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        caseKind: 'assessment.response',
        subjectType: 'assessment',
        subjectId: 'assessment-external-1',
        idempotencyKey: 'case-request-1'
      })
    });
    const createBody = await createResponse.text();
    expect(createResponse.status, createBody).toBe(200);
    const caseRow = JSON.parse(createBody) as { id: string; status: string };
    expect(caseRow.status).toBe('open');

    const jobs = await server.db.jobs.listRuns(seedIds.workspace.default, {
      limit: 20,
      offset: 0
    });
    expect(jobs.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          job_type: 'webhook.delivery',
          payload: expect.objectContaining({
            event: expect.objectContaining({ type: 'governance.workflow.started' })
          })
        })
      ])
    );

    const itemResponse = await fetch(
      integrationUrl(server.baseUrl, `/governance/cases/${caseRow.id}/inbox-items`),
      {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          action: 'approve',
          target: { type: 'user', userId: TEST_ADMIN.id },
          idempotencyKey: 'inbox-request-1'
        })
      }
    );
    expect(itemResponse.status).toBe(200);
    const item = (await itemResponse.json()) as { assignment: { id: string } };

    const decision = await fetch(
      integrationUrl(server.baseUrl, `/governance/inbox-items/${item.assignment.id}/decisions`),
      {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          decision: 'reject',
          reason: 'External policy rejected the request',
          idempotencyKey: 'decision-request-1'
        })
      }
    );
    const decisionBody = await decision.text();
    expect(decision.status, decisionBody).toBe(200);
    expect(JSON.parse(decisionBody)).toMatchObject({
      case: { id: caseRow.id, status: 'completed', outcome: 'reject' },
      event: { eventType: 'rejected' }
    });

    const retry = await fetch(
      integrationUrl(server.baseUrl, `/governance/inbox-items/${item.assignment.id}/decisions`),
      {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          decision: 'reject',
          reason: 'External policy rejected the request',
          idempotencyKey: 'decision-request-1'
        })
      }
    );
    expect(retry.status).toBe(200);
  });
});
