import { createApiTest, createTestORPCClient, expect } from '../../helpers/fixtures';
import { makeAuthHeader } from '../../helpers/seedHelper';
import { createFixtureUser } from '@arch-register/server/db/testSupport/fixtures';

const test = createApiTest();

/**
 * Data Stewardship has no bespoke server router (unlike Business Glossary's `glossary.*`) — its
 * `data-stewardship` capability configuration is generic and resolved client-side (see
 * `web/src/app/data-stewardship/dataStewardshipQueries.ts`). This scaffold coverage exercises the
 * generic `config.capabilityConfigurations` endpoints against the capability's one binding role,
 * mirroring `../vendor-management/vendorManagement.test.ts`.
 */
test('configures the data-stewardship capability against a Data Entity entity schema', async ({
  orpc
}) => {
  const dataEntity = await orpc.schemas.create({
    params: { workspace: 'default' },
    body: { name: `Data Entity ${crypto.randomUUID()}`, fields: [] }
  });

  const configured = await orpc.config.capabilityConfigurations.upsert({
    params: { workspace: 'default', type: 'data-stewardship' },
    body: {
      bindings: {
        dataEntity: { target: { kind: 'entity_schema', id: dataEntity!.id } }
      }
    }
  });

  expect(configured).toMatchObject({
    type: 'data-stewardship',
    valid: true,
    bindings: {
      dataEntity: { target: { kind: 'entity_schema', id: dataEntity!.id } }
    }
  });

  const listed = await orpc.config.capabilityConfigurations.list({
    params: { workspace: 'default' }
  });
  expect(listed).toEqual(expect.arrayContaining([expect.objectContaining({ id: configured.id })]));
});

test('does not expose data-stewardship capability configuration to a workspace outsider', async ({
  server
}) => {
  const outsider = await createFixtureUser(server.db, {
    user_id: 'data-stewardship-outsider-' + crypto.randomUUID(),
    email: 'data-stewardship-outsider-' + crypto.randomUUID() + '@e2e.test',
    display_name: 'Data stewardship outsider',
    password: 'DataStewardshipOutsiderPassword123!'
  });
  const outsiderOrpc = createTestORPCClient(
    server.baseUrl,
    await makeAuthHeader(server.db, outsider.id)
  );

  await expect(
    outsiderOrpc.config.capabilityConfigurations.list({ params: { workspace: 'default' } })
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
