import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { discoverRelationSchemas, syncRelation } from './archRegister.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('Arch Register typed relation integration', () => {
  it('discovers the named API participation relation schemas', async () => {
    let requestedUrl = '';
    globalThis.fetch = async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return new Response(
        JSON.stringify([
          { id: 'consumer-schema', name: 'Consumes API' },
          { id: 'provider-schema', name: 'Provides API' }
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    await assert.doesNotReject(async () => {
      const mapping = await discoverRelationSchemas('workspace', 'token', 'https://ar.example');
      assert.deepEqual(mapping, {
        'provides-api': 'provider-schema',
        'consumes-api': 'consumer-schema'
      });
    });
    assert.equal(
      requestedUrl,
      'https://ar.example/api/integrations/v1/workspace/relation-schemas'
    );
  });

  it('syncs a typed relation by a stable external identity', async () => {
    let requestedUrl = '';
    let requestBody: Record<string, unknown> | undefined;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl = String(input);
      requestBody = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({ status: 'unchanged', relation: { _uid: 'relation-1' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const result = await syncRelation(
      'workspace',
      'backstage-github-example',
      'default/component/catalog/typed-relations/provides-api/default/api/catalog',
      {
        schemaId: 'provider-schema',
        inEntityId: 'component-1',
        outEntityId: 'api-1'
      },
      'token',
      'https://ar.example'
    );

    assert.equal(result.status, 'unchanged');
    assert.equal(result.relation._uid, 'relation-1');
    assert.equal(
      requestedUrl,
      'https://ar.example/api/integrations/v1/workspace/relations/byExternalKey/backstage-github-example/default%2Fcomponent%2Fcatalog%2Ftyped-relations%2Fprovides-api%2Fdefault%2Fapi%2Fcatalog'
    );
    assert.deepEqual(requestBody, {
      _schemaId: 'provider-schema',
      _inEntityId: 'component-1',
      _outEntityId: 'api-1'
    });
  });
});
