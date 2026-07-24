import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchLatestRelease, parseRepository } from './github.js';

test('parses repository shorthand and URLs', () => {
  assert.deepEqual(parseRepository('DiagramCraft/diagram-craft'), {
    owner: 'DiagramCraft',
    repo: 'diagram-craft'
  });
  assert.deepEqual(parseRepository('https://github.com/DiagramCraft/diagram-craft.git'), {
    owner: 'DiagramCraft',
    repo: 'diagram-craft'
  });
});

test('rejects non-GitHub or malformed repositories', () => {
  assert.throws(() => parseRepository('https://gitlab.com/owner/repo'));
  assert.throws(() => parseRepository('owner/repo/extra'));
});

test('fetches and validates the latest GitHub release', async () => {
  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  const release = await fetchLatestRelease(
    { owner: 'owner', repo: 'repo' },
    {
      token: 'github-token',
      fetchImpl: async (input, init) => {
        requestUrl = String(input);
        requestInit = init;
        return new Response(
          JSON.stringify({
            id: 42,
            tag_name: 'v2.0.0',
            html_url: 'https://github.com/owner/repo/releases/tag/v2.0.0',
            published_at: '2026-07-21T10:00:00Z'
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
    }
  );

  assert.equal(release.tag_name, 'v2.0.0');
  assert.equal(requestUrl, 'https://api.github.com/repos/owner/repo/releases/latest');
  assert.equal(new Headers(requestInit?.headers).get('authorization'), 'Bearer github-token');
});
