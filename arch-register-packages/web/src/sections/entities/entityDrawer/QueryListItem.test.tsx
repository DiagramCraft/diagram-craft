import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { EntityDrawerItem } from '@arch-register/api-types/entityDrawerConfiguration';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntityDrawerFieldGroupAccess } from './entityDrawerState';
import type { EntityDrawerQueryItemResult } from './useEntityDrawerQueryItem';
import { QueryListItem } from './QueryListItem';

const mocks = vi.hoisted(() => ({ result: vi.fn() }));

vi.mock('./useEntityDrawerQueryItem', () => ({
  useEntityDrawerQueryItem: () => mocks.result()
}));

const item: Extract<EntityDrawerItem, { kind: 'query' }> = {
  kind: 'query',
  queryText: 'subtree(parent).->"Business Capability Supports Entity"',
  label: 'Realized by'
};

const schemas = [
  {
    id: 'contract',
    name: 'Contract',
    fields: [{ id: 'annual_cost', name: 'Annual cost', type: 'currency' }]
  }
] as never;

const restrictedSchemas = [
  {
    id: 'contract',
    name: 'Contract',
    fields: [
      { id: 'annual_cost', name: 'Annual cost', type: 'currency', groupId: 'financials' }
    ],
    groups: [{ id: 'financials', accessControl: { teamIds: ['team-finance'] } }],
    shared_field_group_links: []
  }
] as never;

const fullAccess: EntityDrawerFieldGroupAccess = () => 'edit';

const render = (queryItem = item, schemaList = schemas, getFieldGroupAccess = fullAccess) =>
  renderToStaticMarkup(
    <QueryListItem
      item={queryItem}
      label="Realized by"
      workspaceId="ws-1"
      schemaName="Business Capability"
      entityId="cap-1"
      schemas={schemaList}
      lifecycleStates={[{ id: 'active', label: 'Active', color: '#00a000', sort_order: 0 }]}
      getFieldGroupAccess={getFieldGroupAccess}
    />
  );

describe('QueryListItem', () => {
  it('renders a chip per matched entity', () => {
    mocks.result.mockReturnValue({
      items: [{ _uid: 'app-1', _name: 'Billing System' } as unknown as EntityRecord],
      isLoading: false,
      error: null
    } satisfies EntityDrawerQueryItemResult);

    expect(render()).toContain('Billing System');
  });

  it('renders configured fields in list presentation', () => {
    mocks.result.mockReturnValue({
      items: [
        {
          _uid: 'contract-1',
          _name: 'Support contract',
          _schema: { id: 'contract', name: 'Contract' },
          annual_cost: { amount: 1200, currency: 'USD' }
        } as unknown as EntityRecord
      ],
      isLoading: false,
      error: null
    });

    expect(
      render({
        kind: 'query',
        queryText: '<-"Contract".vendor',
        label: 'Contracts',
        presentation: 'list',
        fields: [{ fieldId: 'annual_cost', label: 'Annual cost' }]
      })
    ).toContain('Annual cost');
    expect(
      render({
        kind: 'query',
        queryText: '<-"Contract".vendor',
        label: 'Contracts',
        presentation: 'list',
        fields: [{ fieldId: 'annual_cost', label: 'Annual cost' }]
      })
    ).toContain('$1,200.00');
  });

  it('renders lifecycle metadata as a status chip in list presentation', () => {
    mocks.result.mockReturnValue({
      items: [
        {
          _uid: 'system-1',
          _name: 'Billing System',
          _schema: { id: 'system', name: 'System' },
          _lifecycle: { id: 'active', name: 'Active' }
        } as unknown as EntityRecord
      ],
      isLoading: false,
      error: null
    });

    expect(
      render({
        kind: 'query',
        queryText: '<-"Contract".vendor.<-"System Contract"',
        label: 'Technology lifecycle',
        presentation: 'list',
        fields: [{ fieldId: '_lifecycle', label: 'Lifecycle' }]
      })
    ).toContain('Active');
  });

  it('renders a restricted field when the viewer has field-group access', () => {
    mocks.result.mockReturnValue({
      items: [
        {
          _uid: 'contract-1',
          _name: 'Support contract',
          _schema: { id: 'contract', name: 'Contract' },
          annual_cost: { amount: 1200, currency: 'USD' }
        } as unknown as EntityRecord
      ],
      isLoading: false,
      error: null
    });

    const markup = render(
      {
        kind: 'query',
        queryText: '<-"Contract".vendor',
        label: 'Contracts',
        presentation: 'list',
        fields: [{ fieldId: 'annual_cost', label: 'Annual cost' }]
      },
      restrictedSchemas,
      () => 'view'
    );

    expect(markup).toContain('Annual cost');
    expect(markup).toContain('$1,200.00');
  });

  it('omits a restricted field entirely when the viewer has no field-group access', () => {
    mocks.result.mockReturnValue({
      items: [
        {
          _uid: 'contract-1',
          _name: 'Support contract',
          _schema: { id: 'contract', name: 'Contract' },
          annual_cost: undefined
        } as unknown as EntityRecord
      ],
      isLoading: false,
      error: null
    });

    const markup = render(
      {
        kind: 'query',
        queryText: '<-"Contract".vendor',
        label: 'Contracts',
        presentation: 'list',
        fields: [{ fieldId: 'annual_cost', label: 'Annual cost' }]
      },
      restrictedSchemas,
      () => 'none'
    );

    expect(markup).not.toContain('Annual cost');
    expect(markup).not.toContain('undefined');
  });

  it('renders loading, empty, and unavailable states', () => {
    mocks.result.mockReturnValue({ items: [], isLoading: true, error: null });
    expect(render()).toContain('Loading…');

    mocks.result.mockReturnValue({ items: [], isLoading: false, error: null });
    expect(render()).toContain('No realized by linked.');

    mocks.result.mockReturnValue({ items: [], isLoading: false, error: new Error('boom') });
    expect(render()).toContain('Realized by is unavailable.');
  });
});
