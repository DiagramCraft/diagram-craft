import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TbSearch } from 'react-icons/tb';
import { useNavigate, useSearch as useRouterSearch } from '@tanstack/react-router';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useSearch } from '../../hooks/useSearch';
import { SearchInput } from '../../components/SearchInput';
import styles from './SearchScreen.module.css';
import { EmptyState } from '../../components/EmptyState';
import { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  EMPTY_RESULTS,
  buildSearchGroups,
  getSearchCategoryCounts,
  type SearchFilter
} from './searchScreenHelpers';
import { ResultRow } from './components/ResultRow';
import { useAutoFocus } from '../../hooks/useAutoFocus';
import { useOpenSearchRow } from './useOpenSearchRow';

// ── Screen ───────────────────────────────────────────────────

export const SearchScreen = () => {
  const routerNavigate = useNavigate();
  const routerSearch = useRouterSearch({ strict: false }) as {
    q?: string;
    category?: SearchFilter;
  };
  const { workspaceSlug, schemas, lifecycleStates } = useWorkspaceContext();
  const workspaceId = workspaceSlug;
  const query = routerSearch.q ?? '';

  const [localQ, setLocalQ] = useState(query);
  const filter = routerSearch.category ?? 'all';
  const inputRef = useRef<HTMLInputElement>(null);
  useAutoFocus(inputRef, { delay: 60 });

  const trimmed = query.trim();

  // Query hook - only enabled when there's a query
  const { data: results = EMPTY_RESULTS, isLoading: loading } = useSearch(
    workspaceId,
    {
      q: trimmed,
      limitPerType: filter === 'all' ? 8 : 24,
      types: filter === 'all' ? null : [filter]
    },
    { enabled: trimmed !== '' }
  );

  // Sync URL query → local
  // biome-ignore lint/correctness/useExhaustiveDependencies: localQ intentionally excluded to prevent circular updates
  useEffect(() => {
    if (query !== localQ) setLocalQ(query);
  }, [query]);

  const schemaMap = useMemo(() => {
    const map = new Map<string, { schema: EntitySchema; index: number }>();
    schemas.forEach((schema, index) => map.set(schema.id, { schema, index }));
    return map;
  }, [schemas]);

  const groups = useMemo(() => buildSearchGroups(results, filter), [results, filter]);

  const categoryCounts = useMemo(() => getSearchCategoryCounts(results), [results]);

  const totalResults = categoryCounts.all;

  const navigateToSearch = useCallback(
    (q: string) => {
      routerNavigate({
        to: '/$workspaceSlug/search',
        params: { workspaceSlug },
        search: (previous: Record<string, unknown>) => ({ ...previous, q })
      });
    },
    [routerNavigate, workspaceSlug]
  );

  const setFilter = useCallback(
    (category: SearchFilter) => {
      routerNavigate({
        to: '/$workspaceSlug/search',
        params: { workspaceSlug },
        search: (previous: Record<string, unknown>) => ({
          ...previous,
          category: category === 'all' ? undefined : category
        })
      });
    },
    [routerNavigate, workspaceSlug]
  );

  const openRow = useOpenSearchRow();

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && localQ) {
        setLocalQ('');
        navigateToSearch('');
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [localQ, navigateToSearch]);

  const handleInputChange = (val: string) => {
    setLocalQ(val);
  };

  const handleInputSubmit = () => {
    const trimmedQuery = localQ.trim();
    navigateToSearch(trimmedQuery);
  };

  return (
    <div className={styles.screen}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <SearchInput
          ref={inputRef}
          size="md"
          placeholder="Search entities, diagrams, projects, schema…"
          value={localQ}
          onChange={handleInputChange}
          onClear={() => {
            handleInputChange('');
            navigateToSearch('');
            inputRef.current?.focus();
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              handleInputSubmit();
              inputRef.current?.blur();
            }
          }}
        />

        <div className={styles.summary}>
          {trimmed ? (
            <>
              <span data-testid="search-result-count" className={styles.summaryCount}>
                {totalResults}
              </span>
              <span className={styles.dim}>{totalResults === 1 ? 'result' : 'results'} for</span>
              <span className={styles.summaryQ}>"{trimmed}"</span>
            </>
          ) : (
            <span className={styles.dim}>Start typing to search across the workspace.</span>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className={styles.body}>
        <div className={styles.resultsList}>
          {trimmed === '' ? (
            <EmptyState
              icon={<TbSearch size={18} />}
              title="Start searching"
              subtitle="Search across entities, projects, diagrams, and schemas."
            />
          ) : loading ? (
            <EmptyState
              icon={<TbSearch size={18} />}
              title="Searching…"
              subtitle="Looking through projects, files, entities, and schemas."
            />
          ) : totalResults === 0 ? (
            <EmptyState
              icon={<TbSearch size={18} />}
              title={`No results for "${trimmed}"`}
              subtitle="Try a different keyword or remove filters."
            />
          ) : (
            groups.map(g => (
              <div key={g.id} className={styles.group}>
                <div className={styles.groupHead}>
                  <span className={styles.groupLabel}>{g.label}</span>
                  <span className={styles.groupCount}>{g.rows.length}</span>
                  {filter === 'all' && g.rows.length > 5 && (
                    <button
                      type="button"
                      className={styles.viewAll}
                      onClick={() => setFilter(g.id as SearchFilter)}
                    >
                      View all →
                    </button>
                  )}
                </div>
                <div className={styles.groupRows}>
                  {g.rows.slice(0, filter === 'all' ? 5 : 999).map(row => (
                    <ResultRow
                      key={`${row.kind}-${row.id}`}
                      row={row}
                      q={trimmed}
                      onOpen={() => openRow(row)}
                      schemaMap={schemaMap}
                      lifecycleStates={lifecycleStates}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
