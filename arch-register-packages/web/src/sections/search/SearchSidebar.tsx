import { useMemo } from 'react';
import { useNavigate, useSearch as useRouterSearch } from '@tanstack/react-router';
import styles from '../../shell/SidePanel.module.css';
import { TreeRow } from '../../components/TreeRow';
import { SidebarGroupLabel, SidebarTitleHeader } from '../../components/sidebar/SidebarPrimitives';
import { useSearch } from '../../hooks/useSearch';
import {
  CATEGORY_DEFS,
  EMPTY_RESULTS,
  getSearchCategoryCounts,
  type SearchFilter
} from './searchScreenHelpers';

export const SearchSidebar = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const navigate = useNavigate();
  const routerSearch = useRouterSearch({ strict: false }) as {
    q?: string;
    category?: SearchFilter;
  };
  const trimmed = (routerSearch.q ?? '').trim();
  const filter = routerSearch.category ?? 'all';

  // Same params as the unfiltered search screen query, so the request is shared via the query cache
  const { data: results = EMPTY_RESULTS } = useSearch(
    workspaceSlug,
    { q: trimmed, limitPerType: 8, types: null },
    { enabled: trimmed !== '' }
  );
  const counts = useMemo(() => getSearchCategoryCounts(results), [results]);

  return (
    <>
      <SidebarTitleHeader title="Search" />
      <div className={styles.scroll}>
        <SidebarGroupLabel>Type</SidebarGroupLabel>
        {CATEGORY_DEFS.map(c => {
          const Ic = c.icon;
          return (
            <TreeRow
              key={c.value}
              testId={`search-category-${c.label}`}
              icon={<Ic size={12} />}
              label={c.label}
              active={filter === c.value}
              onClick={() =>
                navigate({
                  to: '/$workspaceSlug/search',
                  params: { workspaceSlug },
                  search: (previous: Record<string, unknown>) => ({
                    ...previous,
                    category: c.value === 'all' ? undefined : c.value
                  })
                })
              }
              trailing={
                trimmed ? (
                  <span data-testid={`${c.label.toLowerCase()}-result-count`} className="dim mono">
                    {counts[c.value]}
                  </span>
                ) : undefined
              }
            />
          );
        })}
      </div>
    </>
  );
};
