import { createApiTest, createTestORPCClient, expect } from '../helpers/fixtures';
import { seededUsers } from '@arch-register/server/db/seedFixtures';
import { createFixtureUser } from '@arch-register/server/db/testSupport/fixtures';
import { makeAuthHeader } from '../helpers/seedHelper';

const test = createApiTest();
const bootstrapTest = createApiTest({ seed: 'bootstrap' }).extend<{ auth: string }>({
  auth: [
    async ({ server }, use) => {
      await use(await makeAuthHeader(server.db, seededUsers.globalAdmin.id));
    },
    { scope: 'file' }
  ]
});

test('searches configured glossary terms by alias and returns categories', async ({ orpc }) => {
  const statusEnum = await orpc.enums.create({
    params: { workspace: 'default' },
    body: {
      name: `Glossary term status ${crypto.randomUUID()}`,
      options: [{ value: 'approved', label: 'Approved' }]
    }
  });
  const category = await orpc.schemas.create({
    params: { workspace: 'default' },
    body: { name: `Category alias filter ${crypto.randomUUID()}`, fields: [] }
  });
  const termSchema = await orpc.schemas.create({
    params: { workspace: 'default' },
    body: {
      name: `Term alias filter schema ${crypto.randomUUID()}`,
      fields: [
        { id: 'definition', name: 'Definition', type: 'longtext' },
        { id: 'synonyms', name: 'Synonyms', type: 'text', minCardinality: 0, maxCardinality: -1 },
        {
          id: 'abbreviations',
          name: 'Abbreviations',
          type: 'text',
          minCardinality: 0,
          maxCardinality: -1
        },
        {
          id: 'categories',
          name: 'Categories',
          type: 'reference',
          schemaId: category.id,
          minCount: 0,
          maxCount: -1
        },
        { id: 'status', name: 'Status', type: 'select', enumId: statusEnum.id }
      ]
    }
  });

  await orpc.config.capabilityConfigurations.upsert({
    params: { workspace: 'default', type: 'business-glossary' },
    body: {
      bindings: {
        term: { target: { kind: 'entity_schema', id: termSchema.id } },
        category: { target: { kind: 'entity_schema', id: category.id } }
      }
    }
  });

  const categoryEntity = await orpc.entities.create({
    params: { workspace: 'default' },
    body: { _schemaId: category.id, _name: 'Customer data' } as never
  });
  await orpc.entities.create({
    params: { workspace: 'default' },
    body: {
      _schemaId: termSchema.id,
      _name: 'Customer Account',
      definition: 'A record representing a customer account.',
      synonyms: ['Client account'],
      abbreviations: ['CA'],
      categories: [categoryEntity._uid],
      status: 'approved'
    } as never
  });

  const result = await orpc.glossary.terms.list({
    params: { workspace: 'default' },
    query: { q: 'client account' }
  });
  expect(result.total).toBe(1);
  expect(result.items[0]).toMatchObject({
    canonicalName: 'Customer Account',
    aliases: ['Client account', 'CA'],
    categories: [expect.objectContaining({ name: 'Customer data' })]
  });
});

bootstrapTest('exposes seeded glossary examples through the glossary API', async ({ orpc }) => {
  const config = await orpc.glossary.config({ params: { workspace: 'default' } });
  const result = await orpc.glossary.terms.list({
    params: { workspace: 'default' },
    query: { q: 'customer profile' }
  });
  expect(config).toMatchObject({
    fields: {
      definition: 'definition',
      synonyms: 'synonyms',
      abbreviations: 'abbreviations',
      categories: 'categories',
      status: 'status'
    }
  });
  expect(result.total).toBe(1);
  expect(result.items[0]).toMatchObject({
    canonicalName: 'Customer Account',
    aliases: ['Client Account', 'Customer Profile', 'CA'],
    categories: [expect.objectContaining({ name: 'Customer & Identity' })],
    status: 'approved'
  });

  const term = await orpc.glossary.terms.get({
    params: { workspace: 'default', id: result.items[0]!.entity._uid }
  });
  expect(term.canonicalName).toBe('Customer Account');

  const report = await orpc.glossary.reports.list({
    params: { workspace: 'default' },
    query: { kind: 'ownerless', limit: 1 }
  });
  expect(report.total).toBeGreaterThanOrEqual(report.items.length);
  expect(report.items.length).toBeLessThanOrEqual(1);

  const usage = await orpc.glossary.terms.usage({
    params: { workspace: 'default', id: result.items[0]!.entity._uid },
    query: { limit: 1 }
  });
  expect(usage.total).toBeGreaterThanOrEqual(usage.items.length);
  expect(usage.items).toHaveLength(Math.min(usage.total, 1));
});

bootstrapTest(
  'does not expose glossary configuration to a workspace outsider',
  async ({ server }) => {
    const outsider = await createFixtureUser(server.db, {
      user_id: 'glossary-outsider-' + crypto.randomUUID(),
      email: 'glossary-outsider-' + crypto.randomUUID() + '@e2e.test',
      display_name: 'Glossary outsider',
      password: 'GlossaryOutsiderPassword123!'
    });
    const outsiderOrpc = createTestORPCClient(
      server.baseUrl,
      await makeAuthHeader(server.db, outsider.id)
    );

    await expect(
      outsiderOrpc.glossary.config({ params: { workspace: 'default' } })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  }
);
