import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { EntityDrawerProviderContext } from './EntityDrawerProviderRegistry';
import { entityChangeCasesDrawerProviderDefinitions } from './EntityChangeCasesProvider';

const changeCases = {
  data: [{ id: 'case-1', name: 'Payments migration' }],
  isLoading: false,
  isError: false
};

vi.mock('../../../hooks/useChangeCases', () => ({
  useChangeCasesByEntity: () => changeCases
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
  openEntity: vi.fn()
} as unknown as EntityDrawerProviderContext;

describe('Entity change-case drawer provider', () => {
  it('renders cases for an entity without Data Stewardship fields', () => {
    const definition = entityChangeCasesDrawerProviderDefinitions[0]!;
    const markup = renderToStaticMarkup(
      <definition.Component
        context={context}
        item={{ kind: 'slot', slotId: 'entity.change-cases' }}
      />
    );

    expect(markup).toContain('Payments migration');
  });
});
