import { createApiTest, createTestORPCClient, expect } from '../../helpers/fixtures';
import { makeAuthHeader } from '../../helpers/seedHelper';
import { createFixtureUser } from '@arch-register/server/db/testSupport/fixtures';

const test = createApiTest();

/**
 * Vendor Management has no bespoke server router (unlike Business Glossary's `glossary.*`) — its
 * `vendor-management` capability configuration is generic and resolved client-side (see
 * `web/src/app/vendor-management/vendorManagementQueries.ts`). This scaffold coverage exercises
 * the generic `config.capabilityConfigurations` endpoints against the capability's binding roles,
 * mirroring `../strategy-model/strategyModel.test.ts`.
 */
test('configures the vendor-management capability against Vendor and Contract entity schemas', async ({
  orpc
}) => {
  const [vendor, contract] = await Promise.all([
    orpc.schemas.create({
      params: { workspace: 'default' },
      body: { name: `Vendor ${crypto.randomUUID()}`, fields: [] }
    }),
    orpc.schemas.create({
      params: { workspace: 'default' },
      body: { name: `Contract ${crypto.randomUUID()}`, fields: [] }
    })
  ]);

  const configured = await orpc.config.capabilityConfigurations.upsert({
    params: { workspace: 'default', type: 'vendor-management' },
    body: {
      bindings: {
        vendor: { target: { kind: 'entity_schema', id: vendor!.id } },
        contract: { target: { kind: 'entity_schema', id: contract!.id } }
      }
    }
  });

  expect(configured).toMatchObject({
    type: 'vendor-management',
    valid: true,
    bindings: {
      vendor: { target: { kind: 'entity_schema', id: vendor!.id } },
      contract: { target: { kind: 'entity_schema', id: contract!.id } }
    }
  });

  const listed = await orpc.config.capabilityConfigurations.list({
    params: { workspace: 'default' }
  });
  expect(listed).toEqual(expect.arrayContaining([expect.objectContaining({ id: configured.id })]));
});

test('does not expose vendor-management capability configuration to a workspace outsider', async ({
  server
}) => {
  const outsider = await createFixtureUser(server.db, {
    user_id: 'vendor-management-outsider-' + crypto.randomUUID(),
    email: 'vendor-management-outsider-' + crypto.randomUUID() + '@e2e.test',
    display_name: 'Vendor management outsider',
    password: 'VendorManagementOutsiderPassword123!'
  });
  const outsiderOrpc = createTestORPCClient(
    server.baseUrl,
    await makeAuthHeader(server.db, outsider.id)
  );

  await expect(
    outsiderOrpc.config.capabilityConfigurations.list({ params: { workspace: 'default' } })
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
