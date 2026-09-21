import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { EntityDrawerProviderContext } from '../../../sections/entities/entityDrawer/EntityDrawerProviderRegistry';
import { businessGlossaryEntityDrawerProviderDefinitions } from './GlossaryEntityDrawerProvider';

const mocks = vi.hoisted(() => ({
  usage: {
    data: undefined as
      | { items: Array<{ kind: string; id: string; label: string; context?: string }>; total: number }
      | undefined,
    isLoading: false,
    isError: false
  }
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => mocks.usage
}));

vi.mock('../glossaryQueries', () => ({
  glossaryUsageQuery: (workspaceId: string, entityId: string) => ({
    queryKey: ['glossary', 'usage', workspaceId, entityId]
  })
}));

const context = {
  workspaceId: 'workspace-1',
  entity: { _uid: 'term-1' },
  schema: { id: 'term', name: 'Term', fields: [] },
  schemas: [],
  relationSchemas: [],
  relations: { outgoing: [], incoming: [] },
  typedRelations: { outgoing: [], incoming: [] },
  typedRelationsStatus: { isLoading: false, isError: false },
  openEntity: vi.fn()
} as unknown as EntityDrawerProviderContext;

const item = { kind: 'slot' as const, slotId: 'business-glossary.usage' };

describe('business glossary entity drawer provider', () => {
  const Provider = businessGlossaryEntityDrawerProviderDefinitions[0]!.Component;

  it('renders grouped usage across entities, relations, documents, projects, and diagrams', () => {
    mocks.usage = {
      data: {
        total: 5,
        items: [
          { kind: 'entity', id: 'entity-1', label: 'Customer', context: 'definition' },
          { kind: 'relation', id: 'relation-1', label: 'Supports', context: 'relation' },
          { kind: 'document', id: 'document-1', label: 'Glossary guide' },
          { kind: 'project', id: 'project-1', label: 'Migration' },
          { kind: 'diagram', id: 'diagram-1', label: 'Context map' }
        ]
      },
      isLoading: false,
      isError: false
    };

    const markup = renderToStaticMarkup(
      <Provider context={context} item={item} label="Usage & backlinks" />
    );

    expect(markup).toContain('5 visible references');
    expect(markup).toContain('Referencing entities');
    expect(markup).toContain('Typed relations');
    expect(markup).toContain('Linked documents');
    expect(markup).toContain('Projects');
    expect(markup).toContain('Diagrams');
    expect(markup).toContain('definition');
  });

  it('preserves loading, empty, and unavailable states', () => {
    mocks.usage = { data: undefined, isLoading: true, isError: false };
    expect(
      renderToStaticMarkup(<Provider context={context} item={item} label="Usage" />)
    ).toContain('Loading…');

    mocks.usage = { data: { items: [], total: 0 }, isLoading: false, isError: false };
    expect(
      renderToStaticMarkup(<Provider context={context} item={item} label="Usage" />)
    ).toContain('No visible explicit usage found.');

    mocks.usage = { data: undefined, isLoading: false, isError: true };
    expect(
      renderToStaticMarkup(<Provider context={context} item={item} label="Usage" />)
    ).toContain('Glossary usage is unavailable.');
  });
});
