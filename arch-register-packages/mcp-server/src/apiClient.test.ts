import { describe, expect, it, vi } from 'vitest';
import { ArchRegisterApiClient, ArchRegisterApiError } from './apiClient';

const makeResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });

describe('ArchRegisterApiClient', () => {
  it('uses the workspace API and bearer token for searches', async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = vi.fn(async (input, init = {}) => {
      const url = String(input);
      requests.push({ url, init });
      return url.includes('/count')
        ? makeResponse({ total: 7 })
        : makeResponse([{ _uid: 'entity-1', _name: 'Payments API' }]);
    }) as unknown as typeof fetch;
    const client = new ArchRegisterApiClient({
      baseUrl: 'https://arch-register.example.test/',
      workspace: 'workspace/one',
      token: 'ar_pat_test',
      fetchImpl
    });

    const result = await client.searchEntities({
      query: 'payments',
      schemaId: 'application',
      conditions: [{ fieldId: '_name', op: 'contains', value: 'pay' }],
      limit: 10,
      offset: 20
    });

    expect(result).toEqual({
      entities: [{ _uid: 'entity-1', _name: 'Payments API' }],
      total: 7
    });
    expect(requests).toHaveLength(2);
    const listRequest = requests.find(request => request.url.includes('/data?'))!;
    const listUrl = new URL(listRequest.url);
    expect(listUrl.pathname).toBe('/api/workspace%2Fone/data');
    expect(listUrl.searchParams.get('_schemaId')).toBe('application');
    expect(listUrl.searchParams.get('q')).toBe('payments');
    expect(listUrl.searchParams.get('limit')).toBe('10');
    expect(listUrl.searchParams.get('offset')).toBe('20');
    expect(listUrl.searchParams.get('view')).toBe('full');
    expect(JSON.parse(listUrl.searchParams.get('conditions')!)).toEqual([
      { fieldId: '_name', op: 'contains', value: 'pay' }
    ]);
    expect(new Headers(listRequest.init.headers).get('authorization')).toBe('Bearer ar_pat_test');
  });

  it('maps MCP mutation fields to the REST entity contract', async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = vi.fn(async (input, init = {}) => {
      requests.push({ url: String(input), init });
      return makeResponse({ _uid: 'entity-1', _name: 'Payments API' });
    }) as unknown as typeof fetch;
    const client = new ArchRegisterApiClient({
      baseUrl: 'https://arch-register.example.test',
      workspace: 'workspace',
      token: 'ar_pat_test',
      fetchImpl
    });

    await client.createEntity({
      schemaId: 'application',
      name: 'Payments API',
      fields: { tech: 'Node' }
    });
    await client.updateEntity({ entityId: 'entity-1', name: 'Renamed', fields: { tech: 'Rust' } });

    expect(requests[0]?.init.method).toBe('POST');
    expect(JSON.parse(String(requests[0]?.init.body))).toEqual({
      _schemaId: 'application',
      _name: 'Payments API',
      tech: 'Node'
    });
    expect(requests[1]?.url).toBe('https://arch-register.example.test/api/workspace/data/entity-1');
    expect(requests[1]?.init.method).toBe('PUT');
    expect(JSON.parse(String(requests[1]?.init.body))).toEqual({
      _name: 'Renamed',
      tech: 'Rust'
    });
  });

  it('preserves upstream status and message details', async () => {
    const fetchImpl: typeof fetch = vi.fn(async () =>
      makeResponse({ message: 'Token lacks ent.edit' }, 403)
    ) as unknown as typeof fetch;
    const client = new ArchRegisterApiClient({
      baseUrl: 'https://arch-register.example.test',
      workspace: 'workspace',
      token: 'ar_pat_test',
      fetchImpl
    });

    await expect(client.listSchemas()).rejects.toEqual(
      new ArchRegisterApiError(403, 'Token lacks ent.edit', { message: 'Token lacks ent.edit' })
    );
  });
});
