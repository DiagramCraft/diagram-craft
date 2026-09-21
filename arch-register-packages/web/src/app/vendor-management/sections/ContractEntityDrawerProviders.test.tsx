import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { EntityDrawerProviderContext } from '../../../sections/entities/entityDrawer/EntityDrawerProviderRegistry';
import { vendorContractEntityDrawerProviderDefinitions } from './ContractEntityDrawerProviders';

const mocks = vi.hoisted(() => ({
  queryResults: [] as Array<{
    data?: { _publicId: string; _name: string };
    isLoading: boolean;
    isError: boolean;
  }>
}));

vi.mock('@tanstack/react-query', () => ({
  useQueries: () => mocks.queryResults
}));

vi.mock('../../../queries/entities', () => ({
  entityDetailQuery: (workspaceId: string, entityId: string) => ({
    queryKey: ['entity', workspaceId, entityId]
  })
}));

const context = (system: unknown = ['sys-1']): EntityDrawerProviderContext =>
  ({
    workspaceId: 'workspace-1',
    entity: { _uid: 'contract-1', system },
    schema: {
      id: 'contract',
      name: 'Contract',
      fields: [{ id: 'system', name: 'Used by', type: 'typedRelation' }]
    },
    schemas: [],
    relationSchemas: [],
    relations: { outgoing: [], incoming: [] },
    typedRelations: { outgoing: [], incoming: [] },
    typedRelationsStatus: { isLoading: false, isError: false },
    openEntity: vi.fn()
  }) as unknown as EntityDrawerProviderContext;

const provider = vendorContractEntityDrawerProviderDefinitions[0]!;
const item = { kind: 'slot' as const, slotId: provider.slotId };

describe('Vendor Management Contract entity drawer providers', () => {
  it('renders visible Systems used and omits unavailable linked systems', () => {
    mocks.queryResults = [
      { data: { _publicId: 'SYS-001', _name: 'Billing System' }, isLoading: false, isError: false },
      { data: undefined, isLoading: false, isError: true }
    ];

    const markup = renderToStaticMarkup(
      <provider.Component context={context(['sys-1', 'sys-2'])} item={item} label="Systems used" />
    );

    expect(markup).toContain('Billing System');
    expect(markup).not.toContain('Systems used are unavailable.');
  });

  it('renders empty, loading, and unavailable states', () => {
    mocks.queryResults = [];
    expect(
      renderToStaticMarkup(
        <provider.Component context={context([])} item={item} label="Systems used" />
      )
    ).toContain('No linked Systems.');

    mocks.queryResults = [{ data: undefined, isLoading: true, isError: false }];
    expect(
      renderToStaticMarkup(
        <provider.Component context={context()} item={item} label="Systems used" />
      )
    ).toContain('Loading…');

    mocks.queryResults = [{ data: undefined, isLoading: false, isError: true }];
    expect(
      renderToStaticMarkup(
        <provider.Component context={context()} item={item} label="Systems used" />
      )
    ).toContain('Systems used are unavailable.');
  });

  it('only supports Contract schemas with the typed system field', () => {
    expect(provider.supports(context())).toBe(true);
    const otherContext = {
      ...context(),
      schema: { id: 'other', name: 'Other', fields: [] }
    } as unknown as EntityDrawerProviderContext;
    expect(provider.supports(otherContext)).toBe(false);
  });
});
