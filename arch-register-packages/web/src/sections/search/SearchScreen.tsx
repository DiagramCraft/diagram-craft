import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  TbArrowRight,
  TbChevronRight,
  TbCode,
  TbDatabase,
  TbFolder,
  TbHome,
  TbSearch,
  TbFolders,
  TbX
} from 'react-icons/tb';
import { useNavigate, useSearch as useRouterSearch } from '@tanstack/react-router';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { resolveSchemaColor } from '../../lib/api';
import type {
  EntitySearchResult,
  ProjectFileSearchResult,
  ProjectSearchResult,
  SchemaSearchResult,
  SearchResponse
} from '../../lib/api';
import { TypeBadge } from '../../components/TypeBadge';
import { Chip } from '../../components/Chip';
import { StatusChip } from '../../components/StatusChip';
import { useSearch } from '../../hooks/useSearch';
import styles from './SearchScreen.module.css';
import { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';

type SearchFilter = 'all' | 'entities' | 'projects' | 'files' | 'schemas';
type SearchPreview =
  | { type: 'project'; data: ProjectSearchResult }
  | { type: 'file'; data: ProjectFileSearchResult }
  | { type: 'entity'; data: EntitySearchResult }
  | { type: 'schema'; data: SchemaSearchResult };

type RowId = { kind: string; id: string };

const CATEGORY_DEFS: Array<{ value: SearchFilter; label: string; icon: typeof TbFolders }> = [
  { value: 'all', label: 'All', icon: TbFolders },
  { value: 'entities', label: 'Entities', icon: TbDatabase },
  { value: 'projects', label: 'Projects', icon: TbFolders },
  { value: 'files', label: 'Diagrams', icon: TbFolder },
  { value: 'schemas', label: 'Schemas', icon: TbCode }
];

const EMPTY_RESULTS: SearchResponse = {
  query: '',
  projects: [],
  files: [],
  entities: [],
  schemas: []
};

// ── Match highlighting ───────────────────────────────────────

const Hi = ({ s, q }: { s: string; q: string }) => {
  if (!q) return <>{s}</>;
  const text = String(s ?? '');
  const needle = q.toLowerCase();
  const lower = text.toLowerCase();
  const parts: ReactNode[] = [];
  let cur = 0;
  let idx = lower.indexOf(needle, 0);
  while (idx >= 0) {
    if (idx > cur) parts.push(<span key={`t${cur}`}>{text.slice(cur, idx)}</span>);
    parts.push(<mark key={`m${idx}`}>{text.slice(idx, idx + needle.length)}</mark>);
    cur = idx + needle.length;
    idx = lower.indexOf(needle, cur);
  }
  if (cur < text.length) parts.push(<span key="tail">{text.slice(cur)}</span>);
  return parts.length ? parts : text;
};

const snippetAround = (text: string | null | undefined, q: string, max = 140) => {
  if (!text) return '';
  const t = String(text);
  if (!q) return t.length > max ? `${t.slice(0, max)}…` : t;
  const k = t.toLowerCase().indexOf(q.toLowerCase());
  if (k < 0) return t.length > max ? `${t.slice(0, max)}…` : t;
  const start = Math.max(0, k - 40);
  const end = Math.min(t.length, k + q.length + 80);
  return (start > 0 ? '…' : '') + t.slice(start, end) + (end < t.length ? '…' : '');
};

// ── Screen ───────────────────────────────────────────────────

export const SearchScreen = () => {
  const routerNavigate = useNavigate();
  const routerSearch = useRouterSearch({ strict: false }) as { q?: string };
  const { workspaceSlug, schemas, lifecycleStates } = useWorkspaceContext();
  const workspaceId = workspaceSlug;
  const query = routerSearch.q ?? '';

  const [localQ, setLocalQ] = useState(query);
  const [filter, setFilter] = useState<SearchFilter>('all');
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
        rows: results.entities.map(e => ({ kind: 'entity', id: e.entityId, data: e }))
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
      routerNavigate({ to: '/$workspaceSlug/search', params: { workspaceSlug }, search: { q } });
    },
    [routerNavigate, workspaceSlug]
  );

  const navigateToEntity = useCallback(
    (entityId: string) => {
      routerNavigate({
        to: '/$workspaceSlug/entities/$entityId',
        params: { workspaceSlug, entityId }
      });
    },
    [routerNavigate, workspaceSlug]
  );

  const navigateToProject = useCallback(
    (projectId: string) => {
      routerNavigate({
        to: '/$workspaceSlug/projects/$projectId',
        params: { workspaceSlug, projectId },
        search: { tab: 'projects' as const, section: 'home' as const }
      });
    },
    [routerNavigate, workspaceSlug]
  );

  const navigateToProjectFolder = useCallback(
    (projectId: string, folder: string | null) => {
      routerNavigate({
        to: '/$workspaceSlug/projects/$projectId',
        params: { workspaceSlug, projectId },
        search: {
          tab: 'projects' as const,
          section: 'home' as const,
          folder: folder ?? undefined
        }
      });
    },
    [routerNavigate, workspaceSlug]
  );

  const navigateToSchema = useCallback(
    (schemaId: string) => {
      routerNavigate({
        to: '/$workspaceSlug/model',
        params: { workspaceSlug },
        search: { schema: schemaId }
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
        navigateToProjectFolder(
          f.projectId,
          f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : null
        );
      } else if (row.kind === 'schema') {
        navigateToSchema(row.id);
      }
    },
    [navigateToEntity, navigateToProject, navigateToProjectFolder, navigateToSchema]
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
              title="Start searching"
              sub="Search across entities, projects, diagrams, and schemas."
            />
          ) : loading ? (
            <EmptyState
              title="Searching…"
              sub="Looking through projects, files, entities, and schemas."
            />
          ) : totalResults === 0 ? (
            <EmptyState
              title={`No results for "${trimmed}"`}
              sub="Try a different keyword or remove filters."
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
            onSchemaClick={navigateToSchema}
            q={trimmed}
            lifecycleStates={lifecycleStates}
          />
        </aside>
      </div>
    </div>
  );
};

// ── Result row ───────────────────────────────────────────────

const ResultRow = ({
  row,
  q,
  isSelected,
  onSelect,
  onOpen,
  schemaMap,
  lifecycleStates
}: {
  row: { kind: string; id: string; data: unknown };
  q: string;
  isSelected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  lifecycleStates: WorkspaceLifecycleState[];
}) => {
  if (row.kind === 'entity') {
    const e = row.data as EntitySearchResult;
    const schemaMeta = schemaMap.get(e.schemaId);
    return (
      <div
        className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}
        onMouseEnter={onSelect}
        onClick={onSelect}
        onDoubleClick={onOpen}
      >
        {schemaMeta ? (
          <TypeBadge
            color={resolveSchemaColor(schemaMeta.schema, schemaMeta.index)}
            name={e.schemaName}
            icon={schemaMeta.schema.icon}
            size={22}
          />
        ) : (
          <span className={styles.rowIcon}>
            <TbDatabase size={14} />
          </span>
        )}
        <div className={styles.rowBody}>
          <div className={styles.rowTitle}>
            <button
              type="button"
              className={styles.rowName}
              aria-label={`Search result: ${e._name || e._slug}`}
              onClick={ev => {
                ev.stopPropagation();
                onOpen();
              }}
            >
              <Hi s={e._name || e._slug} q={q} />
            </button>
            <Chip tone="ghost">{e.schemaName}</Chip>
            {e._lifecycle && (
              <StatusChip value={e._lifecycle.id} lifecycleStates={lifecycleStates} />
            )}
          </div>
          {e._description && (
            <div className={styles.rowSnippet}>
              <Hi s={snippetAround(e._description, q)} q={q} />
            </div>
          )}
          <div className={styles.rowMeta}>
            <span className={styles.rowPath}>
              <TbHome size={10} /> Entities
              <span className={styles.dim}>/</span>
              <Hi s={e.schemaName} q={q} />
              <span className={styles.dim}>/</span>
              <Hi s={e._slug} q={q} />
            </span>
            {e._owner && <Chip tone="ghost">{e._owner.name}</Chip>}
            {e.matchedFields.slice(0, 3).map(f => (
              <Chip key={f} tone="ghost">
                field:{f}
              </Chip>
            ))}
          </div>
        </div>
        <RowGo onOpen={onOpen} />
      </div>
    );
  }

  if (row.kind === 'project') {
    const p = row.data as ProjectSearchResult;
    return (
      <div
        className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}
        onMouseEnter={onSelect}
        onClick={onSelect}
        onDoubleClick={onOpen}
      >
        <span className={styles.rowIcon}>
          <TbFolders size={14} />
        </span>
        <div className={styles.rowBody}>
          <div className={styles.rowTitle}>
            <button
              type="button"
              className={styles.rowName}
              onClick={ev => {
                ev.stopPropagation();
                onOpen();
              }}
            >
              <Hi s={p.name} q={q} />
            </button>
            <StatusChip value={p.status} />
          </div>
          {p.description && (
            <div className={styles.rowSnippet}>
              <Hi s={snippetAround(p.description, q)} q={q} />
            </div>
          )}
          <div className={styles.rowMeta}>
            <span className={styles.rowPath}>
              <TbHome size={10} /> Projects
            </span>
          </div>
        </div>
        <RowGo onOpen={onOpen} />
      </div>
    );
  }

  if (row.kind === 'file') {
    const f = row.data as ProjectFileSearchResult;
    return (
      <div
        className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}
        onMouseEnter={onSelect}
        onClick={onSelect}
        onDoubleClick={onOpen}
      >
        <span className={styles.rowIcon}>
          <TbFolder size={14} />
        </span>
        <div className={styles.rowBody}>
          <div className={styles.rowTitle}>
            <button
              type="button"
              className={styles.rowName}
              onClick={ev => {
                ev.stopPropagation();
                onOpen();
              }}
            >
              <Hi s={f.name} q={q} />
            </button>
            <Chip tone="ghost">Diagram</Chip>
          </div>
          <div className={styles.rowMeta}>
            <span className={styles.rowPath}>
              <TbHome size={10} /> <Hi s={f.projectName} q={q} />
              {f.path.includes('/') && (
                <>
                  <span className={styles.dim}>/</span>
                  {f.path.slice(0, f.path.lastIndexOf('/'))}
                </>
              )}
            </span>
          </div>
        </div>
        <RowGo onOpen={onOpen} />
      </div>
    );
  }

  if (row.kind === 'schema') {
    const s = row.data as SchemaSearchResult;
    const schemaMeta = schemaMap.get(s.schemaId);
    return (
      <div
        className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}
        onMouseEnter={onSelect}
        onClick={onSelect}
        onDoubleClick={onOpen}
      >
        {schemaMeta ? (
          <TypeBadge
            color={resolveSchemaColor(schemaMeta.schema, schemaMeta.index)}
            name={s.name}
            icon={schemaMeta.schema.icon}
            size={22}
          />
        ) : (
          <span className={styles.rowIcon}>
            <TbCode size={14} />
          </span>
        )}
        <div className={styles.rowBody}>
          <div className={styles.rowTitle}>
            <button
              type="button"
              className={styles.rowName}
              onClick={ev => {
                ev.stopPropagation();
                onOpen();
              }}
            >
              <Hi s={s.name} q={q} />
            </button>
            <Chip tone="ghost">{s.fieldMatches.length} field matches</Chip>
          </div>
          {s.fieldMatches.length > 0 && (
            <div className={styles.rowSnippet}>
              Fields: {s.fieldMatches.map(f => f.fieldName).join(', ')}
            </div>
          )}
          <div className={styles.rowMeta}>
            <span className={styles.rowPath}>
              <TbCode size={10} /> Data model
              <span className={styles.dim}>/</span>
              <Hi s={s.name} q={q} />
              <span className={styles.dim}>/</span>
              fields
            </span>
          </div>
        </div>
        <RowGo onOpen={onOpen} />
      </div>
    );
  }

  return null;
};

const RowGo = ({ onOpen }: { onOpen: () => void }) => (
  <button
    type="button"
    className={styles.rowGo}
    onClick={e => {
      e.stopPropagation();
      onOpen();
    }}
    title="Open"
  >
    <TbChevronRight size={12} />
  </button>
);

// ── Preview pane ─────────────────────────────────────────────

const PreviewPane = ({
  preview,
  schemaMap,
  onEntityClick,
  onProjectClick,
  onProjectFolderClick,
  onSchemaClick,
  q,
  lifecycleStates
}: {
  preview: SearchPreview | null;
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  onEntityClick: (entityId: string) => void;
  onProjectClick: (projectId: string) => void;
  onProjectFolderClick: (projectId: string, folder: string | null) => void;
  onSchemaClick: (schemaId: string) => void;
  q: string;
  lifecycleStates: WorkspaceLifecycleState[];
}) => {
  if (!preview) {
    return (
      <div className={styles.previewEmpty}>
        Hover or use <kbd className={styles.kbd}>↑</kbd>
        <kbd className={styles.kbd}>↓</kbd> to preview a result.
      </div>
    );
  }

  if (preview.type === 'entity') {
    const e = preview.data;
    const schemaMeta = schemaMap.get(e.schemaId);
    return (
      <div className={styles.previewBody}>
        <div className={styles.previewHead}>
          {schemaMeta ? (
            <TypeBadge
              color={resolveSchemaColor(schemaMeta.schema, schemaMeta.index)}
              name={e.schemaName}
              icon={schemaMeta.schema.icon}
              size={28}
            />
          ) : (
            <span className={styles.previewIcon}>
              <TbDatabase size={16} />
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={styles.previewEyebrow}>{e.schemaName}</div>
            <div className={styles.previewTitle}>
              <Hi s={e._name || e._slug} q={q} />
            </div>
          </div>
          {e._lifecycle && <StatusChip value={e._lifecycle.id} lifecycleStates={lifecycleStates} />}
        </div>
        {e._description && (
          <div className={styles.previewDesc}>
            <Hi s={e._description} q={q} />
          </div>
        )}
        <dl className={styles.previewProps}>
          <dt>Name</dt>
          <dd>
            <Hi s={e._name} q={q} />
          </dd>
          <dt>Slug</dt>
          <dd className={styles.mono}>
            <Hi s={e._slug} q={q} />
          </dd>
          <dt>Schema</dt>
          <dd>
            <Hi s={e.schemaName} q={q} />
          </dd>
          <dt>Owner</dt>
          <dd>
            <Hi s={e._owner?.name ?? '—'} q={q} />
          </dd>
          <dt>Lifecycle</dt>
          <dd>
            <Hi s={e._lifecycle?.name ?? '—'} q={q} />
          </dd>
        </dl>
        <div className={styles.previewActions}>
          <button
            type="button"
            className={styles.previewBtn}
            onClick={() => onEntityClick(e.entityId)}
          >
            Open entity <TbArrowRight size={11} />
          </button>
        </div>
      </div>
    );
  }

  if (preview.type === 'project') {
    const p = preview.data;
    return (
      <div className={styles.previewBody}>
        <div className={styles.previewHead}>
          <span className={styles.previewIcon}>
            <TbFolders size={16} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={styles.previewEyebrow}>Project</div>
            <div className={styles.previewTitle}>
              <Hi s={p.name} q={q} />
            </div>
          </div>
          <StatusChip value={p.status} />
        </div>
        {p.description && (
          <div className={styles.previewDesc}>
            <Hi s={p.description} q={q} />
          </div>
        )}
        <dl className={styles.previewProps}>
          <dt>Name</dt>
          <dd>
            <Hi s={p.name} q={q} />
          </dd>
          <dt>Status</dt>
          <dd>
            <Hi s={p.status} q={q} />
          </dd>
          {p.description && (
            <>
              <dt>Description</dt>
              <dd>
                <Hi s={p.description} q={q} />
              </dd>
            </>
          )}
        </dl>
        <div className={styles.previewActions}>
          <button type="button" className={styles.previewBtn} onClick={() => onProjectClick(p.id)}>
            Open project <TbArrowRight size={11} />
          </button>
        </div>
      </div>
    );
  }

  if (preview.type === 'file') {
    const f = preview.data;
    const folder = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : 'Root';
    return (
      <div className={styles.previewBody}>
        <div className={styles.previewHead}>
          <span className={styles.previewIcon}>
            <TbFolder size={14} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={styles.previewEyebrow}>Diagram</div>
            <div className={styles.previewTitle}>
              <Hi s={f.name} q={q} />
            </div>
          </div>
        </div>
        <dl className={styles.previewProps}>
          <dt>Name</dt>
          <dd>
            <Hi s={f.name} q={q} />
          </dd>
          <dt>Project</dt>
          <dd>
            <Hi s={f.projectName} q={q} />
          </dd>
          <dt>Folder</dt>
          <dd>
            <Hi s={folder} q={q} />
          </dd>
          <dt>Path</dt>
          <dd className={styles.mono}>
            <Hi s={f.path} q={q} />
          </dd>
        </dl>
        <div className={styles.previewActions}>
          <button
            type="button"
            className={styles.previewBtn}
            onClick={() => onProjectFolderClick(f.projectId, f.path.includes('/') ? folder : null)}
          >
            Open in project <TbArrowRight size={11} />
          </button>
        </div>
      </div>
    );
  }

  // schema
  const s = preview.data;
  const schemaMeta = schemaMap.get(s.schemaId);
  const allFields = schemaMeta?.schema.fields ?? [];
  return (
    <div className={styles.previewBody}>
      <div className={styles.previewHead}>
        {schemaMeta ? (
          <TypeBadge
            color={resolveSchemaColor(schemaMeta.schema, schemaMeta.index)}
            name={s.name}
            icon={schemaMeta.schema.icon}
            size={28}
          />
        ) : (
          <span className={styles.previewIcon}>
            <TbCode size={14} />
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={styles.previewEyebrow}>Schema</div>
          <div className={styles.previewTitle}>
            <Hi s={s.name} q={q} />
          </div>
        </div>
      </div>
      <dl className={styles.previewProps}>
        <dt>Name</dt>
        <dd>
          <Hi s={s.name} q={q} />
        </dd>
        <dt>Fields</dt>
        <dd>{allFields.length}</dd>
      </dl>
      {allFields.length > 0 && (
        <>
          <div className={styles.sectionLabel}>Fields</div>
          <div className={styles.fieldList}>
            {allFields.map(f => (
              <div key={f.id} className={styles.fieldRow}>
                <span className={styles.fieldName}>
                  <Hi s={f.name} q={q} />
                </span>
                <span className={styles.fieldId}>
                  <Hi s={f.id} q={q} />
                </span>
                <span className={styles.fieldType}>{f.type}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <div className={styles.previewActions}>
        <button
          type="button"
          className={styles.previewBtn}
          onClick={() => onSchemaClick(s.schemaId)}
        >
          Open in data model <TbArrowRight size={11} />
        </button>
      </div>
    </div>
  );
};

// ── Empty states ─────────────────────────────────────────────

const EmptyState = ({ title, sub }: { title: string; sub: string }) => (
  <div className={styles.empty}>
    <div className={styles.emptyIcon}>
      <TbSearch size={18} />
    </div>
    <div className={styles.emptyTitle}>{title}</div>
    <div className={styles.emptySub}>{sub}</div>
  </div>
);
