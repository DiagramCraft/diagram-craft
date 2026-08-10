import { describe, expect, it } from 'vitest';
import { normalizeApiSpecification } from './apiSpecificationNormalization';

describe('normalizeApiSpecification', () => {
  it('normalizes OpenAPI YAML operations with stable source keys and summaries', async () => {
    const result = await normalizeApiSpecification(
      'revision-openapi',
      `openapi: 3.1.0
info:
  title: Pets
  version: 1.0.0
paths:
  /pets:
    get:
      operationId: listPets
      tags: [pets]
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
      responses:
        '200':
          description: A page of pets
`,
      'application/yaml'
    );

    expect(result.status).toBe('current');
    expect(result.protocol).toBe('openapi');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      identifier: 'listPets',
      path: '/pets',
      action: 'get',
      tags: ['pets'],
      itemKey: '#/paths/~1pets/get',
      parameters: [{ name: 'limit', in: 'query' }]
    });
    expect(result.items[0]?.output).toMatchObject({
      responses: [{ status: '200', description: 'A page of pets' }]
    });
  });

  it('normalizes AsyncAPI 2.x messages and preserves missing identifiers as warnings', async () => {
    const result = await normalizeApiSpecification(
      'revision-asyncapi',
      JSON.stringify({
        asyncapi: '2.6.0',
        info: { title: 'Events', version: '1.0.0' },
        channels: {
          'pets.created': {
            publish: {
              message: { payload: { type: 'object' } }
            }
          }
        }
      }),
      'application/json'
    );

    expect(result.status).toBe('current');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      protocol: 'asyncapi',
      itemKind: 'message',
      channel: 'pets.created',
      action: 'publish',
      identifier: 'PUBLISH pets.created'
    });
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'missing_identifier', severity: 'warning' })
      ])
    );
  });

  it('normalizes AsyncAPI 3.0 operations and channel references', async () => {
    const result = await normalizeApiSpecification(
      'revision-asyncapi-3',
      JSON.stringify({
        asyncapi: '3.0.0',
        info: { title: 'Events', version: '1.0.0' },
        channels: {
          pets: {
            address: 'pets',
            messages: {
              PetCreated: { name: 'PetCreated', payload: { type: 'object' } }
            }
          }
        },
        operations: {
          publishPet: {
            action: 'send',
            channel: { $ref: '#/channels/pets' },
            messages: [{ $ref: '#/channels/pets/messages/PetCreated' }]
          }
        }
      }),
      'application/json'
    );

    expect(result.status).toBe('current');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      protocol: 'asyncapi',
      channel: 'pets',
      action: 'send',
      identifier: 'PetCreated',
      input: { payload: { type: 'object' } }
    });
  });

  it('does not fetch external references and reports the unresolved location', async () => {
    const result = await normalizeApiSpecification(
      'revision-ref',
      JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'Refs', version: '1.0.0' },
        paths: {
          '/pets': {
            get: {
              operationId: 'listPets',
              responses: {
                '200': {
                  description: 'ok',
                  content: {
                    'application/json': { schema: { $ref: 'https://example.com/pet.json' } }
                  }
                }
              }
            }
          }
        }
      }),
      'application/json'
    );

    expect(result.status).toBe('current');
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'unresolved_reference',
          code: 'external_reference_not_fetched'
        })
      ])
    );
  });

  it('returns explicit unsupported and invalid statuses', async () => {
    const unsupported = await normalizeApiSpecification(
      'revision-unsupported',
      '{"openapi":"2.0","info":{"title":"Old","version":"1"}}',
      'application/json'
    );
    const invalid = await normalizeApiSpecification(
      'revision-invalid',
      '{not yaml',
      'application/yaml'
    );

    expect(unsupported.status).toBe('unsupported');
    expect(unsupported.diagnostics[0]).toMatchObject({ category: 'unsupported_version' });
    expect(invalid.status).toBe('invalid');
    expect(invalid.diagnostics[0]).toMatchObject({ category: 'parse_error' });
  });

  it('is deterministic for repeated normalization of the same revision', async () => {
    const content = JSON.stringify({
      openapi: '3.1.0',
      info: { title: 'Stable', version: '1.0.0' },
      paths: { '/health': { get: { responses: { '204': { description: 'ok' } } } } }
    });
    const first = await normalizeApiSpecification('revision-stable', content, 'application/json');
    const second = await normalizeApiSpecification('revision-stable', content, 'application/json');

    expect(second.items).toEqual(first.items);
    expect(second.diagnostics).toEqual(first.diagnostics);
  });
});
