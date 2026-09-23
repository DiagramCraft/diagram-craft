import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { EntityDrawerProviderContext } from './EntityDrawerProviderRegistry';
import { entityGovernanceItemsDrawerProviderDefinitions } from './EntityGovernanceItemsProvider';

const governanceCases = {
  data: [
    {
      id: 'case-1',
      caseKind: 'entity.change-case',
      payload: {},
      dueAt: '2099-01-01T00:00:00.000Z'
    }
  ],
  isLoading: false,
  isError: false
};

vi.mock('../../../hooks/useGovernance', () => ({
  useGovernanceCases: () => governanceCases
}));

const context = {
  workspaceId: 'workspace-1',
  entity: { _uid: 'service-1', _name: 'Payments' },
  schema: { id: 'service', name: 'Service', fields: [] },
  schemas: [],
  relationSchemas: [],
  relations: { outgoing: [], incoming: [] },
  typedRelations: { outgoing: [], incoming: [] },
  typedRelationsStatus: { isLoading: false, isError: false },
  openEntity: vi.fn(),
  openGovernanceCase: vi.fn()
} as unknown as EntityDrawerProviderContext;

describe('Entity governance-items drawer provider', () => {
  it('renders open governance cases for an arbitrary entity', () => {
    const definition = entityGovernanceItemsDrawerProviderDefinitions[0]!;
    const markup = renderToStaticMarkup(
      <definition.Component
        context={context}
        item={{ kind: 'slot', slotId: 'entity.governance-items' }}
      />
    );

    expect(markup).toContain('Entity Change Case');
    expect(markup).toContain('due');
  });
});
