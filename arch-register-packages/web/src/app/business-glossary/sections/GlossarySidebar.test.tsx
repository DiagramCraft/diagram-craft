import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
const searchMock = vi.fn();
const useQueryMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useSearch: () => searchMock()
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey: unknown[] }) => useQueryMock(options)
}));

vi.mock('../glossaryQueries', () => ({
  glossaryConfigQuery: () => ({ queryKey: ['glossary', 'config'] }),
  glossaryTermsQuery: () => ({ queryKey: ['glossary', 'terms'] })
}));

vi.mock('../../../queries/entities', () => ({
  entitiesQuery: () => ({ queryKey: ['entities', 'list'] })
}));

const term = (overrides: Partial<{ categories: { id: string; name: string }[] }> = {}) => ({
  categories: [],
  quality: { unused: false, conflicting: false, deprecated: false, ownerless: false },
  ...overrides
});

const { GlossarySidebar } = await import('./GlossarySidebar');

describe('GlossarySidebar', () => {
  it('shows a disabled message when the glossary capability is off', () => {
    searchMock.mockReturnValue({});
    useQueryMock.mockImplementation(({ queryKey }: { queryKey: unknown[] }) =>
      queryKey[1] === 'config' ? { data: undefined } : { data: undefined }
    );

    const html = renderToStaticMarkup(<GlossarySidebar workspaceSlug="ws" />);
    expect(html).toContain('Business glossary is not enabled.');
  });

  it('derives category and quality counts from the unfiltered term fetch', () => {
    searchMock.mockReturnValue({});
    useQueryMock.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      if (queryKey[1] === 'config') {
        return { data: { termSchemaId: 't', categorySchemaId: 'c' } };
      }
      if (queryKey[0] === 'entities') {
        return {
          data: { items: [{ _uid: 'cat-1', _name: 'Payments' }] }
        };
      }
      return {
        data: {
          total: 2,
          items: [
            term({ categories: [{ id: 'cat-1', name: 'Payments' }] }),
            {
              ...term(),
              quality: { unused: true, conflicting: false, deprecated: false, ownerless: true }
            }
          ]
        }
      };
    });

    const html = renderToStaticMarkup(<GlossarySidebar workspaceSlug="ws" />);
    expect(html).toContain('Payments');
    expect(html).toContain('All terms');
    expect(html).toContain('Unused');
    expect(html).toContain('Missing owner');
  });

  it('marks the selected category checkbox as checked based on the categoryIds search param', () => {
    useQueryMock.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      if (queryKey[1] === 'config') return { data: { termSchemaId: 't', categorySchemaId: 'c' } };
      if (queryKey[0] === 'entities') {
        return { data: { items: [{ _uid: 'cat-1', _name: 'Payments' }] } };
      }
      return { data: { total: 0, items: [] } };
    });

    searchMock.mockReturnValue({ categoryIds: 'cat-1' });
    const checkedHtml = renderToStaticMarkup(<GlossarySidebar workspaceSlug="ws" />);
    expect(checkedHtml).toContain('checked=""');

    searchMock.mockReturnValue({});
    const uncheckedHtml = renderToStaticMarkup(<GlossarySidebar workspaceSlug="ws" />);
    expect(uncheckedHtml).not.toContain('checked=""');
  });
});
