import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GlossaryScreen } from './GlossaryScreen';

const mocks = vi.hoisted(() => ({
  params: { workspaceSlug: 'workspace-1', termId: 'TERM-001' },
  search: {},
  navigate: vi.fn()
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => mocks.params,
  useSearch: () => mocks.search
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[1] === 'config') {
      return { data: { categorySchemaId: 'category' }, isLoading: false };
    }
    if (queryKey[0] === 'entities') {
      return { data: { items: [] }, isLoading: false };
    }
    return {
      data: {
        total: 1,
        items: [
          {
            entity: { _uid: 'term-1', _publicId: 'TERM-001', _name: 'Customer Account' },
            canonicalName: 'Customer Account',
            aliases: [],
            categories: [],
            status: 'approved',
            usageCount: 0,
            quality: { unused: true, conflicting: false, deprecated: false, ownerless: false }
          }
        ]
      },
      isLoading: false
    };
  }
}));

vi.mock('../glossaryQueries', () => ({
  glossaryConfigQuery: () => ({ queryKey: ['glossary', 'config'] }),
  glossaryTermsQuery: () => ({ queryKey: ['glossary', 'terms'] })
}));

vi.mock('../../../queries/entities', () => ({
  entitiesQuery: () => ({ queryKey: ['entities', 'list'] })
}));

vi.mock('../../../hooks/useWorkspaceConfig', () => ({
  useTeams: () => ({ data: [] }),
  useLifecycleStates: () => ({ data: [] })
}));

vi.mock('../../../components/table/useTableSort', () => ({
  useTableSort: <T, K>(items: T[]) => ({
    sorted: items,
    sort: { key: 'name' as K, dir: 'asc' },
    toggleSort: vi.fn()
  })
}));

vi.mock('../../../components/Title', () => ({
  Title: ({ title, children }: { title: string; children?: ReactNode }) => (
    <div>
      {title}
      {children}
    </div>
  )
}));

vi.mock('../../../components/SearchInput', () => ({ SearchInput: () => <input /> }));
vi.mock('../../../components/FilterDropdown', () => ({ FilterDropdown: () => <select /> }));
vi.mock('../../../components/Chip', () => ({ Chip: ({ children }: { children: ReactNode }) => <span>{children}</span> }));
vi.mock('../../../components/StatusChip', () => ({ StatusChip: () => <span /> }));
vi.mock('../../../components/table/Table', () => {
  const passthrough = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Table: {
      Root: passthrough,
      Head: passthrough,
      Row: passthrough,
      Body: passthrough,
      HeaderCell: passthrough,
      SortableHeaderCell: passthrough,
      EmptyRow: passthrough,
      NameCell: ({ title }: { title: string }) => <span>{title}</span>,
      Cell: passthrough
    }
  };
});
vi.mock('@diagram-craft/app-components/Popover', () => ({
  Popover: {
    Root: ({ children }: { children?: ReactNode }) => <>{children}</>,
    Trigger: ({ element }: { element: ReactNode }) => element,
    Content: ({ children }: { children?: ReactNode }) => <>{children}</>
  }
}));
vi.mock('@diagram-craft/app-components/Button', () => ({
  Button: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button>
}));
vi.mock('./GlossaryQualityBadges', () => ({ GlossaryQualityBadges: () => null }));
vi.mock('./GlossaryTermDrawer', () => ({
  GlossaryTermDrawer: ({ termId }: { termId: string }) => <div>drawer:{termId}</div>
}));

describe('GlossaryScreen', () => {
  it('renders the deep-linked term drawer using the route public ID', () => {
    const markup = renderToStaticMarkup(<GlossaryScreen />);

    expect(markup).toContain('drawer:TERM-001');
    expect(markup).toContain('Customer Account');
  });
});
