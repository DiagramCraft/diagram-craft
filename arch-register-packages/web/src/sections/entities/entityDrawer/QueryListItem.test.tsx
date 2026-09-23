import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { EntityDrawerItem } from '@arch-register/api-types/entityDrawerConfiguration';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
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

const render = () =>
  renderToStaticMarkup(
    <QueryListItem
      item={item}
      label="Realized by"
      workspaceId="ws-1"
      schemaName="Business Capability"
      entityId="cap-1"
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

  it('renders loading, empty, and unavailable states', () => {
    mocks.result.mockReturnValue({ items: [], isLoading: true, error: null });
    expect(render()).toContain('Loading…');

    mocks.result.mockReturnValue({ items: [], isLoading: false, error: null });
    expect(render()).toContain('No realized by linked.');

    mocks.result.mockReturnValue({ items: [], isLoading: false, error: new Error('boom') });
    expect(render()).toContain('Realized by is unavailable.');
  });
});
