import { randomUUID } from 'node:crypto';
import { expect, test } from '../helpers/fixtures';
import type { TestORPCClient } from '../helpers/orpcTestClient';

const workspace = 'default';

// #3091 — derived fields on relation schemas: a relation instance carries a read-only value
// computed from its own fields (and, in the general case, the entities it connects), materialized
// on write and queryable through the ordinary relation query engine.
test.describe('relation derived fields', () => {
  const setup = async (orpc: TestORPCClient) => {
    const suffix = randomUUID();
    const endpointSchema = await orpc.schemas.create({
      params: { workspace },
      body: { name: `${suffix} endpoint` }
    });
    const inEntity = await orpc.entities.create({
      params: { workspace },
      body: { _schemaId: endpointSchema.id, _name: `${suffix} source` } as never
    });
    const outEntity = await orpc.entities.create({
      params: { workspace },
      body: { _schemaId: endpointSchema.id, _name: `${suffix} target` } as never
    });
    const relationSchema = await orpc.relationSchemas.create({
      params: { workspace },
      body: {
        name: `${suffix} flow`,
        in: { schemaIds: [endpointSchema.id] },
        out: { schemaIds: [endpointSchema.id] },
        fields: [
          { id: 'source_region', name: 'Source region', type: 'text' },
          { id: 'dest_region', name: 'Destination region', type: 'text' },
          {
            id: 'cross_boundary',
            name: 'Cross boundary',
            type: 'derived',
            requirementLevel: 'optional',
            expression:
              "relation.source_region == relation.dest_region ? 'internal' : 'cross-boundary'",
            resultType: 'text'
          }
        ]
      }
    });
    return { relationSchema, inEntity, outEntity };
  };

  test('materializes a derived relation field on create and update', async ({ orpc }) => {
    const { relationSchema, inEntity, outEntity } = await setup(orpc);

    const created = (await orpc.relations.create({
      params: { workspace },
      body: {
        _schemaId: relationSchema.id,
        _inEntityId: inEntity._uid,
        _outEntityId: outEntity._uid,
        source_region: 'eu',
        dest_region: 'us'
      } as never
    })) as Record<string, unknown> & { _uid: string };

    expect(created.cross_boundary).toBe('cross-boundary');

    const updated = (await orpc.relations.update({
      params: { workspace, id: created._uid },
      body: { dest_region: 'eu' } as never
    })) as Record<string, unknown>;

    expect(updated.cross_boundary).toBe('internal');
  });

  test('exposes the derived field to the relation query engine', async ({ orpc }) => {
    const { relationSchema, inEntity, outEntity } = await setup(orpc);

    const crossBoundary = (await orpc.relations.create({
      params: { workspace },
      body: {
        _schemaId: relationSchema.id,
        _inEntityId: inEntity._uid,
        _outEntityId: outEntity._uid,
        source_region: 'eu',
        dest_region: 'us'
      } as never
    })) as { _uid: string };

    const result = await orpc.relations.query({
      params: { workspace },
      query: {
        relationQuery: JSON.stringify({
          schemaId: relationSchema.id,
          root: {
            kind: 'predicate',
            path: [],
            fieldId: 'cross_boundary',
            op: 'equals',
            value: 'cross-boundary'
          }
        }) as never
      }
    });

    expect(result.items.map(item => item['_uid'])).toContain(crossBoundary._uid);
  });

  test('rejects a direct write to a derived relation field', async ({ orpc }) => {
    const { relationSchema, inEntity, outEntity } = await setup(orpc);

    await expect(
      orpc.relations.create({
        params: { workspace },
        body: {
          _schemaId: relationSchema.id,
          _inEntityId: inEntity._uid,
          _outEntityId: outEntity._uid,
          source_region: 'eu',
          dest_region: 'us',
          cross_boundary: 'internal'
        } as never
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
