import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useParams, useSearch, useNavigate } from '@tanstack/react-router';
import { TbDeviceFloppy, TbFileText, TbHistory, TbRestore } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import {
  useMarkdownContent,
  useMarkdownRevision,
  useMarkdownRevisions,
  useRestoreMarkdownRevision,
  useSaveMarkdownContent,
  useWorkspaceContentNodes
} from '../../hooks/useProjectFiles';
import { useProject, useEntityContentNodes } from '../../hooks/useProjects';
import { useEntity } from '../../hooks/useEntities';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { Title } from '../../components/Title';
import type {
  FileTree,
  MarkdownRevisionSummary,
  ProjectFile
} from '@arch-register/api-types/projectContract';
import styles from './MarkdownEditorScreen.module.css';
import { extractFirstHeadingTitle, renderMarkdownWithoutFirstHeading } from './markdownTitle';
import {
  projectDetailRoute,
  entityDetailRoute,
  asProjectPublicId,
  asEntityPublicId
} from '../../routes/publicObjectRoutes';

type EditorMode = 'view' | 'edit';
type PaneMode = 'edit' | 'preview';
type ViewPanel = 'preview' | 'history';

const findFileById = (tree: FileTree | undefined, nodeId: string): ProjectFile | undefined => {
  if (!tree) return undefined;
  return [...tree.rootFiles, ...tree.folders.flatMap(folder => folder.files)].find(file => file.id === nodeId);
};

const extractToc = (markdown: string): string[] =>
  markdown.match(/^## .+$/gm)?.map(l => l.slice(3).trim()) ?? [];

const calcReadTime = (text: string): number =>
  Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 200));

const relativeDate = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return '1 week ago';
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1 month ago';
  return `${months} months ago`;
};

const formatRevisionDate = (iso: string): string =>
  new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(iso));

const RevisionListItem = (props: {
  revision: MarkdownRevisionSummary;
  active: boolean;
  onClick: () => void;
}) => {
  const { revision, active, onClick } = props;
  return (
    <button
      type="button"
      className={`${styles.revisionItem} ${active ? styles.revisionItemActive : ''}`}
      onClick={onClick}
    >
      <div className={styles.revisionItemHead}>
        <span className={styles.revisionBadge}>v{revision.revision_number}</span>
        {revision.restored_from_revision_id ? (
          <span className={styles.restoreBadge}>Restore</span>
        ) : null}
      </div>
      <div className={styles.revisionTitle}>{revision.title ?? 'Untitled revision'}</div>
      <div className={styles.revisionMeta}>
        {revision.created_by_name ?? 'Unknown author'} · {relativeDate(revision.created_at)}
      </div>
    </button>
  );
};

export const MarkdownEditorScreen = () => {
  const params = useParams({ strict: false }) as {
    workspaceSlug: string;
    nodeId: string;
    projectId?: string;
    entityId?: string;
  };
  const search = useSearch({ strict: false }) as {
    mode?: PaneMode;
    panel?: ViewPanel;
    revisionId?: string;
  };
  const { workspaceSlug, nodeId, projectId, entityId } = params;
  const navigate = useNavigate();
  const { workspace } = useWorkspaceContext();
  const requestedMode = search.mode === 'edit' ? 'edit' : 'preview';
  const requestedPanel = search.panel === 'history' ? 'history' : 'preview';

  const { data, isLoading, isError } = useMarkdownContent(workspaceSlug, nodeId);
  const { data: revisions = [], isLoading: revisionsLoading } = useMarkdownRevisions(workspaceSlug, nodeId);
  const saveMutation = useSaveMarkdownContent(workspaceSlug, nodeId, { projectId, entityId });
  const restoreMutation = useRestoreMarkdownRevision(workspaceSlug, nodeId, { projectId, entityId });
  const { data: project } = useProject(workspaceSlug, projectId ?? '', { enabled: !!projectId });
  const { data: entity } = useEntity(workspaceSlug, entityId ?? '');
  const { data: entityFiles } = useEntityContentNodes(workspaceSlug, entityId ?? '', { enabled: !!entityId });
  const { data: workspaceFiles } = useWorkspaceContentNodes(workspaceSlug, { enabled: !projectId && !entityId });

  const [body, setBody] = useState('');
  const [editorMode, setEditorMode] = useState<EditorMode>(requestedMode === 'edit' ? 'edit' : 'view');
  const [paneMode, setPaneMode] = useState<PaneMode>(requestedMode);
  const [viewPanel, setViewPanel] = useState<ViewPanel>(requestedPanel);
  const [dirty, setDirty] = useState(false);
  const initializedRef = useRef(false);
  const previousNodeIdRef = useRef(nodeId);

  const selectedRevisionId = search.revisionId;
  const selectedRevisionSummary = useMemo(
    () => revisions.find(revision => revision.id === selectedRevisionId) ?? null,
    [revisions, selectedRevisionId]
  );
  const { data: selectedRevision, isLoading: revisionLoading } = useMarkdownRevision(
    workspaceSlug,
    nodeId,
    selectedRevisionSummary?.id
  );

  const file = useMemo(() => {
    return projectId
      ? findFileById(project?.files, nodeId)
      : entityId
        ? findFileById(entityFiles, nodeId)
        : findFileById(workspaceFiles, nodeId);
  }, [entityFiles, entityId, nodeId, project?.files, projectId, workspaceFiles]);

  const documentTitle = file?.name ?? 'Markdown document';
  const headingTitle = useMemo(() => extractFirstHeadingTitle(body), [body]);
  const resolvedTitle = headingTitle ?? documentTitle;
  const previewHtml = useMemo(() => renderMarkdownWithoutFirstHeading(body), [body]);
  const toc = useMemo(() => extractToc(body), [body]);
  const readTime = useMemo(() => calcReadTime(body), [body]);
  const updatedLabel = file?.updated_at ? relativeDate(file.updated_at) : null;
  const selectedRevisionHtml = useMemo(
    () => renderMarkdownWithoutFirstHeading(selectedRevision?.body ?? ''),
    [selectedRevision?.body]
  );
  const selectedRevisionReadTime = useMemo(
    () => calcReadTime(selectedRevision?.body ?? ''),
    [selectedRevision?.body]
  );

  const updateSearch = useCallback(
    (next: Partial<{ mode: PaneMode; panel: ViewPanel; revisionId: string }>) => {
      navigate({
        search: {
          ...(search as Record<string, unknown>),
          mode: next.mode,
          panel: next.panel,
          revisionId: next.revisionId
        } as never
      });
    },
    [navigate, search]
  );

  const parentLabel: string = projectId
    ? (project?.name ?? 'Project')
    : entityId
      ? (entity?._name ?? 'Entity')
      : (workspace?.name ?? workspaceSlug);

  const handleNavigateBack = useCallback(() => {
    if (projectId) {
      navigate(projectDetailRoute(workspaceSlug, asProjectPublicId(projectId)));
    } else if (entityId) {
      navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entityId)));
    } else {
      navigate({ to: '/$workspaceSlug/content', params: { workspaceSlug } });
    }
  }, [navigate, workspaceSlug, projectId, entityId]);

  useEffect(() => {
    if (previousNodeIdRef.current === nodeId) return;
    previousNodeIdRef.current = nodeId;
    initializedRef.current = false;
    setBody('');
    setDirty(false);
  }, [nodeId]);

  useEffect(() => {
    setEditorMode(requestedMode === 'edit' ? 'edit' : 'view');
    setPaneMode(requestedMode);
    setViewPanel(requestedPanel);
  }, [requestedMode, requestedPanel]);

  useEffect(() => {
    if (!data) return;
    if (!initializedRef.current) {
      setBody(data.body);
      initializedRef.current = true;
      setDirty(false);
      return;
    }
    if (!dirty) {
      setBody(data.body);
    }
  }, [data, dirty]);

  useEffect(() => {
    if (viewPanel !== 'history' || revisions.length === 0) return;
    if (selectedRevisionSummary) return;
    updateSearch({
      mode: 'preview',
      panel: 'history',
      revisionId: revisions[0]!.id
    });
  }, [revisions, selectedRevisionSummary, updateSearch, viewPanel]);

  const handleChange = useCallback((value: string) => {
    setBody(value);
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (saveMutation.isPending) return;
    await saveMutation.mutateAsync({ body, name: headingTitle ?? undefined });
    setDirty(false);
  }, [body, headingTitle, saveMutation]);

  const handleSaveAndClose = useCallback(async () => {
    if (saveMutation.isPending) return;
    await saveMutation.mutateAsync({ body, name: headingTitle ?? undefined });
    setDirty(false);
    setEditorMode('view');
    setPaneMode('preview');
    setViewPanel('preview');
    updateSearch({ mode: 'preview', panel: 'preview', revisionId: undefined });
  }, [body, headingTitle, saveMutation, updateSearch]);

  const handleClose = useCallback(() => {
    setEditorMode('view');
    setPaneMode('preview');
    setViewPanel('preview');
    updateSearch({ mode: 'preview', panel: 'preview', revisionId: undefined });
  }, [updateSearch]);

  const handleEnterEdit = useCallback(() => {
    setEditorMode('edit');
    setPaneMode('edit');
    updateSearch({ mode: 'edit', panel: undefined, revisionId: undefined });
  }, [updateSearch]);

  const handlePreview = useCallback(() => {
    setPaneMode('preview');
    setViewPanel('preview');
    updateSearch({ mode: 'preview', panel: 'preview', revisionId: undefined });
  }, [updateSearch]);

  const handleOpenHistory = useCallback(() => {
    setEditorMode('view');
    setPaneMode('preview');
    setViewPanel('history');
    updateSearch({
      mode: 'preview',
      panel: 'history',
      revisionId: revisions[0]?.id
    });
  }, [revisions, updateSearch]);

  const handleSelectRevision = useCallback(
    (revisionId: string) => {
      updateSearch({ mode: 'preview', panel: 'history', revisionId });
    },
    [updateSearch]
  );

  const handleRestore = useCallback(async () => {
    if (!selectedRevisionSummary || restoreMutation.isPending) return;
    await restoreMutation.mutateAsync(selectedRevisionSummary.id);
    setDirty(false);
    setEditorMode('view');
    setPaneMode('preview');
    setViewPanel('preview');
    updateSearch({ mode: 'preview', panel: 'preview', revisionId: undefined });
  }, [restoreMutation, selectedRevisionSummary, updateSearch]);

  if (isLoading) {
    return (
      <div className={styles.screen}>
        <div className={styles.loading}>Loading…</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.screen}>
        <div className={styles.loading}>Failed to load document.</div>
      </div>
    );
  }

  const showEditor = editorMode === 'edit' && paneMode === 'edit';

  const homeItem = { label: 'Home', onClick: () => navigate({ to: '/$workspaceSlug/', params: { workspaceSlug } }) };

  const titleBreadcrumb = projectId
    ? [
        homeItem,
        { label: 'Projects', onClick: () => navigate({ to: '/$workspaceSlug/projects', params: { workspaceSlug } }) },
        { label: parentLabel, onClick: handleNavigateBack },
        { label: resolvedTitle }
      ]
    : entityId
      ? [
          homeItem,
          { label: 'Entities', onClick: () => navigate({ to: '/$workspaceSlug/entities', params: { workspaceSlug } }) },
          { label: parentLabel, onClick: handleNavigateBack },
          { label: resolvedTitle }
        ]
      : [
          homeItem,
          { label: 'Workspace Content', onClick: () => navigate({ to: '/$workspaceSlug/content', params: { workspaceSlug } }) },
          { label: resolvedTitle }
        ];

  const titleIcon = (
    <div className={styles.titleIcon}>
      <TbFileText size={20} />
    </div>
  );

  const titleDescription = showEditor
    ? 'Editing now'
    : viewPanel === 'history'
      ? `Version history${revisions.length > 0 ? ` · ${revisions.length} saved` : ''}`
      : [
          updatedLabel ? `Updated ${updatedLabel}` : null,
          `${readTime} min read`
        ].filter(Boolean).join(' · ');

  const titleButtons = showEditor
    ? (
        <>
          <Button onClick={handleClose}>
            Close
          </Button>
          <Button onClick={handlePreview}>
            Preview
          </Button>
          <Button
            icon={<TbDeviceFloppy size={13} />}
            onClick={handleSave}
          >
            Save
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveAndClose}
          >
            Save & Close
          </Button>
        </>
      )
    : viewPanel === 'history'
      ? (
          <Button onClick={handleEnterEdit}>
            Edit
          </Button>
        )
      : (
          <>
            <Button icon={<TbHistory size={13} />} onClick={handleOpenHistory}>
              Versions
            </Button>
            <Button onClick={handleEnterEdit}>
              Edit
            </Button>
          </>
        );

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <Title
          breadcrumb={titleBreadcrumb}
          icon={titleIcon}
          title={resolvedTitle}
          description={titleDescription}
          buttons={titleButtons}
        />
      </div>

      {showEditor ? (
        <>
          <div className={styles.editPane}>
            <textarea
              className={styles.textarea}
              value={body}
              onChange={e => handleChange(e.target.value)}
              placeholder="Start writing in Markdown…"
              spellCheck
            />
          </div>
          <div className={styles.editorFooter}>
            <span className={dirty ? styles.dirty : styles.clean}>
              {dirty
                ? <><span className={styles.dirtyDot} /> Unsaved changes</>
                : 'All changes saved'
              }
            </span>
          </div>
        </>
      ) : viewPanel === 'history' ? (
        <div className={styles.historyGrid}>
          <section className={styles.historyPreview}>
            {revisionLoading ? (
              <div className={styles.previewEmpty}>Loading selected version…</div>
            ) : selectedRevision ? (
              <>
                <div className={styles.historyPreviewHead}>
                  <div>
                    <div className={styles.historyPreviewLabel}>
                      Version {selectedRevision.revision_number}
                    </div>
                    <div className={styles.historyPreviewMeta}>
                      {selectedRevision.created_by_name ?? 'Unknown author'} ·{' '}
                      {formatRevisionDate(selectedRevision.created_at)} · {selectedRevisionReadTime} min read
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    icon={<TbRestore size={13} />}
                    onClick={handleRestore}
                  >
                    Restore this version
                  </Button>
                </div>
                <article className={styles.article}>
                  {selectedRevisionHtml.trim() ? (
                    <>
                      <div dangerouslySetInnerHTML={{ __html: selectedRevisionHtml }} />
                      <div className={styles.articleFooter}>
                        Saved {formatRevisionDate(selectedRevision.created_at)}
                      </div>
                    </>
                  ) : (
                    <div className={styles.previewEmpty}>This revision is empty.</div>
                  )}
                </article>
              </>
            ) : (
              <div className={styles.previewEmpty}>
                Select a version to preview it here.
              </div>
            )}
          </section>
          <aside className={styles.historySidebar}>
            <div className={styles.historySidebarHead}>
              <div className={styles.historySidebarHeadRow}>
                <div className={styles.historySidebarLabel}>Saved versions</div>
                <Button onClick={handlePreview}>
                  Close
                </Button>
              </div>
              <div className={styles.historySidebarSub}>
                {revisions.length === 0 ? 'No saved versions yet' : `${revisions.length} revisions`}
              </div>
            </div>
            <div className={styles.historySidebarBody}>
              {revisionsLoading ? (
                <div className={styles.previewEmpty}>Loading versions…</div>
              ) : revisions.length === 0 ? (
                <div className={styles.previewEmpty}>
                  No saved versions yet. Save this document to start a history.
                </div>
              ) : (
                revisions.map(revision => (
                  <RevisionListItem
                    key={revision.id}
                    revision={revision}
                    active={revision.id === selectedRevisionSummary?.id}
                    onClick={() => handleSelectRevision(revision.id)}
                  />
                ))
              )}
            </div>
          </aside>
        </div>
      ) : (
        <div className={styles.bodyGrid}>
          <article className={styles.article}>
            {previewHtml.trim() ? (
              <>
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                <div className={styles.articleFooter}>
                  {updatedLabel && <>Last edited {updatedLabel} · </>}
                  {readTime} min read
                </div>
              </>
            ) : (
              <div className={styles.previewEmpty}>
                Preview will appear here as you type.
              </div>
            )}
          </article>
          {toc.length > 0 && (
            <aside className={styles.toc}>
              <div className={styles.tocLabel}>On this page</div>
              {toc.map((h, i) => (
                <div key={i} className={styles.tocItem}>{h}</div>
              ))}
            </aside>
          )}
        </div>
      )}
    </div>
  );
};
