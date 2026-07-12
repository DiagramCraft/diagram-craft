import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TbSearch, TbX } from 'react-icons/tb';
import { useNavigate, useSearch as useRouterSearch } from '@tanstack/react-router';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import type { ProjectFileSearchResult } from '@arch-register/api-types/searchContract';
import { useSearch } from '../../hooks/useSearch';
import styles from './SearchScreen.module.css';
import { EmptyState } from '../../components/EmptyState';
import { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityDetailRoute,
  projectDetailRoute
} from '../../routes/publicObjectRoutes';
import {
  CATEGORY_DEFS,
  EMPTY_RESULTS,
  type RowId,
  type SearchFilter,
  type SearchPreview
} from './searchScreenHelpers';
import { ResultRow } from './components/ResultRow';
import { PreviewPane } from './components/PreviewPane';

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
  const [selected, setSelected] = useState<RowId | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Auto-focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 60);
  }, []);

  const schemaMap = useMemo(() => {
    const map = new Map<string, { schema: EntitySchema; index: number }>();
    schemas.forEach((schema, index) => map.set(schema.id, { schema, index }));
    return map;
  }, [schemas]);

  // Build flat row list for keyboard navigation
  const groups = useMemo(() => {
    const g: Array<{
      id: string;
      label: string;
      rows: Array<{ kind: string; id: string; data: unknown }>;
    }> = [];
    if (filter === 'all' || filter === 'entities') {
      g.push({
        id: 'entities',
        label: 'Entities',
        rows: results.entities.map(e => ({ kind: 'entity', id: e.publicId, data: e }))
      });
    }
    if (filter === 'all' || filter === 'projects') {
      g.push({
        id: 'projects',
        label: 'Projects',
        rows: results.projects.map(p => ({ kind: 'project', id: p.id, data: p }))
      });
    }
    if (filter === 'all' || filter === 'files') {
      g.push({
        id: 'files',
        label: 'Diagrams',
        rows: results.files.map(f => ({ kind: 'file', id: f.fileId, data: f }))
      });
    }
    if (filter === 'all' || filter === 'schemas') {
      g.push({
        id: 'schemas',
        label: 'Schemas',
        rows: results.schemas.map(s => ({ kind: 'schema', id: s.schemaId, data: s }))
      });
    }
    return g.filter(g => g.rows.length > 0);
  }, [results, filter]);

  const flatRows = useMemo(() => groups.flatMap(g => g.rows), [groups]);

  const categoryCounts = useMemo(
    () => ({
      all:
        results.entities.length +
        results.projects.length +
        results.files.length +
        results.schemas.length,
      entities: results.entities.length,
      projects: results.projects.length,
      files: results.files.length,
      schemas: results.schemas.length
    }),
    [results]
  );

  const totalResults = categoryCounts.all;

  // Auto-select first result
  useEffect(() => {
    if (flatRows.length > 0) {
      setSelected({ kind: flatRows[0]!.kind, id: flatRows[0]!.id });
    } else {
      setSelected(null);
    }
  }, [flatRows]);

  // Preview from selected
  const preview = useMemo<SearchPreview | null>(() => {
    if (!selected) return null;
    if (selected.kind === 'entity') {
      const data = results.entities.find(e => e.entityId === selected.id);
      return data ? { type: 'entity', data } : null;
    }
    if (selected.kind === 'project') {
      const data = results.projects.find(p => p.id === selected.id);
      return data ? { type: 'project', data } : null;
    }
    if (selected.kind === 'file') {
      const data = results.files.find(f => f.fileId === selected.id);
      return data ? { type: 'file', data } : null;
    }
    if (selected.kind === 'schema') {
      const data = results.schemas.find(s => s.schemaId === selected.id);
      return data ? { type: 'schema', data } : null;
    }
    return null;
  }, [selected, results]);

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
      setSelected(null);
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

  const navigateToEntity = useCallback(
    (entityId: string) => {
      routerNavigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entityId)));
    },
    [routerNavigate, workspaceSlug]
  );

  const navigateToProject = useCallback(
    (projectId: string) => {
      routerNavigate(
        projectDetailRoute(workspaceSlug, asProjectPublicId(projectId), {
          tab: 'projects' as const,
          section: 'home' as const
        })
      );
    },
    [routerNavigate, workspaceSlug]
  );

  const navigateToProjectFolder = useCallback(
    (projectId: string, folder: string | null) => {
      routerNavigate(
        projectDetailRoute(workspaceSlug, asProjectPublicId(projectId), {
          tab: 'projects' as const,
          section: 'home' as const,
          folder: folder ?? undefined
        })
      );
    },
    [routerNavigate, workspaceSlug]
  );

  const navigateToSchema = useCallback(
    (schemaId: string) => {
      routerNavigate({
        to: '/$workspaceSlug/settings/schemas',
        params: { workspaceSlug },
        search: { schema: schemaId }
      });
    },
    [routerNavigate, workspaceSlug]
  );

  const navigateToEntityFolder = useCallback(
    (entityId: string, folder: string | null) => {
      routerNavigate(
        entityDetailRoute(workspaceSlug, asEntityPublicId(entityId), {
          contentFolder: folder ?? undefined
        })
      );
    },
    [routerNavigate, workspaceSlug]
  );

  const navigateToWorkspaceFolder = useCallback(
    (folder: string | null) => {
      routerNavigate({
        to: '/$workspaceSlug/content',
        params: { workspaceSlug },
        search: { contentFolder: folder ?? undefined }
      });
    },
    [routerNavigate, workspaceSlug]
  );

  const openRow = useCallback(
    (row: { kind: string; id: string; data: unknown }) => {
      if (row.kind === 'entity') {
        navigateToEntity(row.id);
      } else if (row.kind === 'project') {
        navigateToProject(row.id);
      } else if (row.kind === 'file') {
        const f = row.data as ProjectFileSearchResult;
        const folder = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : null;
        if (f.scope === 'project' && f.projectId) {
          navigateToProjectFolder(f.projectId, folder);
        } else if (f.scope === 'entity' && f.entityPublicId) {
          navigateToEntityFolder(f.entityPublicId, folder);
        } else if (f.scope === 'workspace') {
          navigateToWorkspaceFolder(folder);
        }
      } else if (row.kind === 'schema') {
        navigateToSchema(row.id);
      }
    },
    [navigateToEntity, navigateToProject, navigateToProjectFolder, navigateToSchema, navigateToEntityFolder, navigateToWorkspaceFolder]
  );

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && localQ) {
        setLocalQ('');
        navigateToSearch('');
        inputRef.current?.focus();
        return;
      }
      if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) return;
      if (!flatRows.length) return;
      const curIdx = Math.max(
        0,
        flatRows.findIndex(r => selected && r.id === selected.id && r.kind === selected.kind)
      );
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = flatRows[Math.min(flatRows.length - 1, curIdx + 1)]!;
        setSelected({ kind: next.kind, id: next.id });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next = flatRows[Math.max(0, curIdx - 1)]!;
        setSelected({ kind: next.kind, id: next.id });
      } else if (e.key === 'Enter') {
        // Only handle Enter when NOT focused on the search input
        if (document.activeElement === inputRef.current) return;
        e.preventDefault();
        const cur = flatRows[curIdx];
        if (cur) openRow(cur);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flatRows, selected, localQ, navigateToSearch, openRow]);

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
        <div className={styles.searchInput}>
          <TbSearch size={14} />
          <input
            ref={inputRef}
            placeholder="Search entities, diagrams, projects, schema…"
            value={localQ}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                handleInputSubmit();
                inputRef.current?.blur();
              }
            }}
          />
          {localQ && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => {
                handleInputChange('');
                navigateToSearch('');
                inputRef.current?.focus();
              }}
              title="Clear (Esc)"
            >
              <TbX size={11} />
            </button>
          )}
          <span className={styles.kbdHints}>
            <kbd className={styles.kbd}>↑</kbd>
            <kbd className={styles.kbd}>↓</kbd>
            <span className={styles.dim}> navigate ·</span>
            <kbd className={styles.kbd}>⏎</kbd>
            <span className={styles.dim}> open</span>
          </span>
        </div>

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

      {/* ── Category chips ── */}
      <div className={styles.cats}>
        {CATEGORY_DEFS.map(c => {
          const Ic = c.icon;
          const n = categoryCounts[c.value];
          return (
            <button
              type="button"
              key={c.value}
              data-testid={`search-category-${c.label}`}
              aria-pressed={filter === c.value}
              className={`${styles.cat} ${filter === c.value ? styles.catActive : ''}`}
              onClick={() => setFilter(c.value)}
            >
              <Ic size={11} />
              <span>{c.label}</span>
              <span
                data-testid={`${c.label.toLowerCase()}-result-count`}
                className={styles.catCount}
              >
                {n}
              </span>
            </button>
          );
        })}
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
                      isSelected={selected?.kind === row.kind && selected?.id === row.id}
                      onSelect={() => setSelected({ kind: row.kind, id: row.id })}
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

        <aside className={styles.preview}>
          <PreviewPane
            preview={preview}
            schemaMap={schemaMap}
            onEntityClick={navigateToEntity}
            onProjectClick={navigateToProject}
            onProjectFolderClick={navigateToProjectFolder}
            onEntityFolderClick={navigateToEntityFolder}
            onWorkspaceFolderClick={navigateToWorkspaceFolder}
            onSchemaClick={navigateToSchema}
            q={trimmed}
            lifecycleStates={lifecycleStates}
          />
        </aside>
      </div>
    </div>
  );
};
