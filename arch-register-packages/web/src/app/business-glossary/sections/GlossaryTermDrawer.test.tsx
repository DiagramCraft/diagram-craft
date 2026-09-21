import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GlossaryTermDrawer } from './GlossaryTermDrawer';

const mocks = vi.hoisted(() => ({
  term: {
    data: undefined as unknown,
    isLoading: false,
    isError: false
  }
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => mocks.term
}));

vi.mock('../glossaryQueries', () => ({
  glossaryTermQuery: (workspaceId: string, termId: string) => ({
    queryKey: ['glossary', 'term', workspaceId, termId]
  })
}));

vi.mock('../../../sections/entities/entityDrawer/EntityDrawer', () => ({
  EntityDrawer: ({
    entityOverride,
    additionalBadges,
    entityLoading,
    entityUnavailable,
    loadingMessage,
    unavailableMessage
  }: {
    entityOverride?: { _uid: string; _name: string };
    additionalBadges: ReactNode;
    entityLoading: boolean;
    entityUnavailable: boolean;
    loadingMessage: ReactNode;
    unavailableMessage: ReactNode;
  }) => (
    <div>
      {entityLoading ? (
        <span>{loadingMessage}</span>
      ) : entityUnavailable ? (
        <span>{unavailableMessage}</span>
      ) : (
        <>
          <span>{entityOverride?._uid}</span>
          <span>{entityOverride?._name}</span>
          {additionalBadges}
        </>
      )}
    </div>
  )
}));

describe('GlossaryTermDrawer', () => {
  it('preserves glossary loading and unavailable states', () => {
    mocks.term = { data: undefined, isLoading: true, isError: false };
    expect(
      renderToStaticMarkup(
        <GlossaryTermDrawer workspaceSlug="workspace-1" termId="TERM-001" onClose={vi.fn()} />
      )
    ).toContain('Loading term…');

    mocks.term = { data: undefined, isLoading: false, isError: true };
    expect(
      renderToStaticMarkup(
        <GlossaryTermDrawer workspaceSlug="workspace-1" termId="TERM-001" onClose={vi.fn()} />
      )
    ).toContain('This glossary term is unavailable.');
  });

  it('passes the permission-checked term entity and quality badges to the shared drawer', () => {
    mocks.term = {
      data: {
        entity: { _uid: 'term-1', _name: 'Customer Account' },
        quality: { unused: true, conflicting: true, deprecated: false, ownerless: true }
      },
      isLoading: false,
      isError: false
    };

    const markup = renderToStaticMarkup(
      <GlossaryTermDrawer workspaceSlug="workspace-1" termId="TERM-001" onClose={vi.fn()} />
    );

    expect(markup).toContain('term-1');
    expect(markup).toContain('Customer Account');
    expect(markup).toContain('Conflicts with another term');
    expect(markup).toContain('No visible usage found');
    expect(markup).toContain('No owner assigned');
  });
});
