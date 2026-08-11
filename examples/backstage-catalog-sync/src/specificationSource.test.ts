import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  resolveBackstageSpecification,
  SpecificationResolutionError
} from './specificationSource.js';
import type { GitHubFile, GitHubRepo } from './github.js';

const originalFetch = globalThis.fetch;
const repo: GitHubRepo = {
  name: 'catalog',
  fullName: 'example/catalog',
  defaultBranch: 'main'
};
const catalogFile: GitHubFile = {
  content: '',
  path: 'catalog-info.yaml',
  sha: 'catalog-sha',
  htmlUrl: 'https://github.com/example/catalog/blob/main/catalog-info.yaml'
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('Backstage API specification sources', () => {
  it('submits inline definitions as bounded documents with catalog provenance', async () => {
    const result = await resolveBackstageSpecification(
      'openapi: 3.0.0\ninfo: {title: Example, version: 1.0.0}',
      'github:example/catalog:catalog-info.yaml:default/api/example:spec.definition',
      repo,
      catalogFile,
      undefined,
      null
    );

    assert.equal(result.kind, 'document');
    assert.equal(result.sourceRevision, 'catalog-sha');
    assert.equal(result.location, catalogFile.htmlUrl);
  });

  it('resolves a relative $text substitution through GitHub', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          type: 'file',
          encoding: 'base64',
          path: 'spec/openapi.yaml',
          sha: 'spec-sha',
          html_url: 'https://github.com/example/catalog/blob/main/spec/openapi.yaml',
          content: Buffer.from('openapi: 3.0.0\n').toString('base64')
        }),
        { status: 200 }
      );

    const result = await resolveBackstageSpecification(
      { $text: 'spec/openapi.yaml' },
      'source-key',
      repo,
      catalogFile,
      'github-token',
      null
    );

    assert.deepEqual(result, {
      kind: 'document',
      sourceKey: 'source-key',
      content: 'openapi: 3.0.0\n',
      location: 'https://github.com/example/catalog/blob/main/spec/openapi.yaml',
      mediaType: 'application/yaml',
      sourceRevision: 'spec-sha'
    });
  });

  it('falls back to a useful link when no definition is present', async () => {
    const result = await resolveBackstageSpecification(
      undefined,
      'source-key',
      repo,
      catalogFile,
      undefined,
      'https://api.example.test/docs'
    );

    assert.deepEqual(result, {
      kind: 'link',
      sourceKey: 'source-key',
      location: 'https://api.example.test/docs',
      mediaType: null
    });
  });

  it('classifies a deleted GitHub definition as missing', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });

    await assert.rejects(
      resolveBackstageSpecification(
        { $text: 'spec/deleted.yaml' },
        'source-key',
        repo,
        catalogFile,
        'github-token',
        null
      ),
      (error: unknown) =>
        error instanceof SpecificationResolutionError && error.category === 'missing'
    );
  });

  it('rejects unsupported substitutions', async () => {
    await assert.rejects(
      resolveBackstageSpecification(
        { $json: { url: 'spec.json' } },
        'source-key',
        repo,
        catalogFile,
        undefined,
        null
      ),
      (error: unknown) =>
        error instanceof SpecificationResolutionError && error.message.includes('must name')
    );
  });
});
