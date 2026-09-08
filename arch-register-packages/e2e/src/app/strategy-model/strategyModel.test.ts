import { createApiTest, createTestORPCClient, expect } from '../../helpers/fixtures';
import { makeAuthHeader } from '../../helpers/seedHelper';
import { createFixtureUser } from '@arch-register/server/db/testSupport/fixtures';

const test = createApiTest();

/**
 * Strategy & Capability Modelling has no bespoke server router (unlike Business Glossary's
 * `glossary.*`) — its `strategy-model` capability configuration is generic and resolved
 * client-side (see `web/src/app/strategy-model/strategyQueries.ts`). This scaffold coverage
 * exercises the generic `config.capabilityConfigurations` endpoints against the capability's five
 * binding roles, mirroring `../business-glossary/glossary.test.ts`.
 */
test('configures the strategy-model capability against five entity schemas', async ({ orpc }) => {
  const schemaNames = [
    'Business Capability',
    'Objective',
    'Outcome',
    'Initiative',
    'Measure'
  ] as const;
  const [businessCapability, objective, outcome, initiative, measure] = await Promise.all(
    schemaNames.map(name =>
      orpc.schemas.create({
        params: { workspace: 'default' },
        body: { name: `${name} ${crypto.randomUUID()}`, fields: [] }
      })
    )
  );

  const configured = await orpc.config.capabilityConfigurations.upsert({
    params: { workspace: 'default', type: 'strategy-model' },
    body: {
      bindings: {
        business_capability: { target: { kind: 'entity_schema', id: businessCapability!.id } },
        objective: { target: { kind: 'entity_schema', id: objective!.id } },
        outcome: { target: { kind: 'entity_schema', id: outcome!.id } },
        initiative: { target: { kind: 'entity_schema', id: initiative!.id } },
        measure: { target: { kind: 'entity_schema', id: measure!.id } }
      }
    }
  });

  expect(configured).toMatchObject({
    type: 'strategy-model',
    valid: true,
    bindings: {
      business_capability: { target: { kind: 'entity_schema', id: businessCapability!.id } },
      objective: { target: { kind: 'entity_schema', id: objective!.id } },
      outcome: { target: { kind: 'entity_schema', id: outcome!.id } },
      initiative: { target: { kind: 'entity_schema', id: initiative!.id } },
      measure: { target: { kind: 'entity_schema', id: measure!.id } }
    }
  });

  const listed = await orpc.config.capabilityConfigurations.list({
    params: { workspace: 'default' }
  });
  expect(listed).toEqual(expect.arrayContaining([expect.objectContaining({ id: configured.id })]));
});

test('does not expose strategy-model capability configuration to a workspace outsider', async ({
  server
}) => {
  const outsider = await createFixtureUser(server.db, {
    user_id: 'strategy-outsider-' + crypto.randomUUID(),
    email: 'strategy-outsider-' + crypto.randomUUID() + '@e2e.test',
    display_name: 'Strategy outsider',
    password: 'StrategyOutsiderPassword123!'
  });
  const outsiderOrpc = createTestORPCClient(
    server.baseUrl,
    await makeAuthHeader(server.db, outsider.id)
  );

  await expect(
    outsiderOrpc.config.capabilityConfigurations.list({ params: { workspace: 'default' } })
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
