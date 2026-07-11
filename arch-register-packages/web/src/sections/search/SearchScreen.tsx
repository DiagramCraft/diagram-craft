import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TbArrowRight, TbCode, TbDatabase, TbFolder, TbFolders, TbSearch, TbX } from 'react-icons/tb';
import { useNavigate, useSearch as useRouterSearch } from '@tanstack/react-router';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { resolveSchemaColor } from '../../lib/schemaPresentation';
import type { ProjectFileSearchResult } from '@arch-register/api-types/searchContract';
import { TypeBadge } from '../../components/TypeBadge';
import { Chip } from '../../components/Chip';
import { StatusChip } from '../../components/StatusChip';
import { useSearch } from '../../hooks/useSearch';
import styles from './SearchScreen.module.css';
import { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityDetailRoute,
  projectDetailRoute
} from '../../routes/publicObjectRoutes';
import {
  CATEGORY_DEFS,
  EMPTY_RESULTS,
  getFileContextLabel,
  getFileFolder,
  type RowId,
  type SearchFilter,
  type SearchPreview
} from './searchScreenHelpers';
import { ResultRow } from './components/ResultRow';
import { Hi } from './components/Hi';

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

const PreviewPane = ({
  preview,
  schemaMap,
  onEntityClick,
  onProjectClick,
  onProjectFolderClick,
  onEntityFolderClick,
  onWorkspaceFolderClick,
  onSchemaClick,
  q,
  lifecycleStates
}: {
  preview: SearchPreview | null;
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  onEntityClick: (entityId: string) => void;
  onProjectClick: (projectId: string) => void;
  onProjectFolderClick: (projectId: string, folder: string | null) => void;
  onEntityFolderClick: (entityId: string, folder: string | null) => void;
  onWorkspaceFolderClick: (folder: string | null) => void;
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
            onClick={() => onEntityClick(e.publicId)}
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
    const folder = getFileFolder(f.path);
    const locationLabel =
      f.scope === 'project' ? 'Project' : f.scope === 'entity' ? 'Entity' : 'Workspace';
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
          {f.content_metadata?.title && (
            <>
              <dt>Metadata title</dt>
              <dd>
                <Hi s={f.content_metadata.title} q={q} />
              </dd>
            </>
          )}
          <dt>{locationLabel}</dt>
          <dd>
            <Hi s={getFileContextLabel(f)} q={q} />
          </dd>
          <dt>Folder</dt>
          <dd>
            <Hi s={folder} q={q} />
          </dd>
          <dt>Path</dt>
          <dd className={styles.mono}>
            <Hi s={f.path} q={q} />
          </dd>
          {f.content_metadata?.description && (
            <>
              <dt>Description</dt>
              <dd>
                <Hi s={f.content_metadata.description} q={q} />
              </dd>
            </>
          )}
          {f.content_metadata?.category && (
            <>
              <dt>Category</dt>
              <dd>
                <Hi s={f.content_metadata.category} q={q} />
              </dd>
            </>
          )}
          {f.content_metadata?.keywords.length ? (
            <>
              <dt>Keywords</dt>
              <dd className={styles.tags}>
                {f.content_metadata.keywords.map(keyword => (
                  <Chip key={keyword} tone="ghost">
                    <Hi s={keyword} q={q} />
                  </Chip>
                ))}
              </dd>
            </>
          ) : null}
        </dl>
        <div className={styles.previewActions}>
          <button
            type="button"
            className={styles.previewBtn}
            onClick={() => {
              if (f.scope === 'project' && f.projectId) {
                onProjectFolderClick(f.projectId!, f.path.includes('/') ? folder : null);
                return;
              }
              if (f.scope === 'entity' && f.entityPublicId) {
                onEntityFolderClick(f.entityPublicId, f.path.includes('/') ? folder : null);
                return;
              }
              if (f.scope === 'workspace') {
                onWorkspaceFolderClick(f.path.includes('/') ? folder : null);
              }
            }}
          >
            Open {f.scope === 'project' ? 'in project' : f.scope === 'entity' ? 'entity' : 'workspace'} <TbArrowRight size={11} />
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
