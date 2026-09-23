import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { type EntityDrawerProviderContext } from '../../../sections/entities/entityDrawer/EntityDrawerProviderRegistry';
import { dataStewardshipEntityDrawerProviderDefinitions } from './DataStewardshipEntityDrawerProviders';

const mocks = vi.hoisted(() => ({
  queue: { items: [], isLoading: false },
  cases: { data: [], isLoading: false, isError: false }
}));

vi.mock('../dataStewardshipQueue', () => ({
  useDataStewardshipQueue: () => mocks.queue
}));

vi.mock('../../../hooks/useChangeCases', () => ({
  useChangeCasesByEntity: () => mocks.cases
}));

const context = (
  overrides: Partial<EntityDrawerProviderContext> = {}
): EntityDrawerProviderContext =>
  ({
    workspaceId: 'workspace-1',
    entity: {
      _uid: 'dataset-1',
      _name: 'Customer Records',
      _owner: { id: 'team-1', name: 'Payments' },
      classification: 'confidential',
      steward: { principal_type: 'user', principal_id: 'user-1' },
      review_status: 'current'
    },
    schema: {
      id: 'data-entity',
      name: 'Data Entity',
      fields: [
        { id: 'classification', name: 'Classification', type: 'select' },
        { id: 'steward', name: 'Steward', type: 'principal' },
        { id: 'custodian', name: 'Custodian', type: 'principal' },
        { id: 'review_date', name: 'Review Date', type: 'date' },
        { id: 'review_status', name: 'Review Status', type: 'derived' },
        { id: 'stewardship_status', name: 'Stewardship Status', type: 'derived' }
      ]
    },
    schemas: [],
    relationSchemas: [],
    relations: { outgoing: [], incoming: [] },
    typedRelations: { outgoing: [], incoming: [] },
    typedRelationsStatus: { isLoading: false, isError: false },
    openEntity: vi.fn(),
    ...overrides
  }) as unknown as EntityDrawerProviderContext;

const item = (slotId: string) => ({ kind: 'slot' as const, slotId });
const provider = (slotId: string) =>
  dataStewardshipEntityDrawerProviderDefinitions.find(definition => definition.slotId === slotId)!;

describe('Data Stewardship entity drawer providers', () => {
  it('renders the empty queue state without issue references', () => {
    const definition = provider('data-stewardship.queue-items');
    const markup = renderToStaticMarkup(
      <definition.Component context={context()} item={item(definition.slotId)} />
    );

    expect(markup).toContain('Nothing in the queue against this dataset.');
    expect(markup).not.toMatch(/#\d{3,5}/);
  });
});
