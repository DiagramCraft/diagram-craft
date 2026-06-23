import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useParams, useSearch, useNavigate } from '@tanstack/react-router';
import {
  TbDeviceFloppy,
  TbDots,
  TbFileText,
  TbHistory,
  TbPencil,
  TbTrash,
  TbX
} from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import {
  useMarkdownContent,
  useMarkdownRevisions,
  useRestoreMarkdownRevision,
  useSaveMarkdownContent,
  useWorkspaceContentNodes,
  useDeleteWorkspaceFile,
  useRenameWorkspaceFile,
  useDeleteProjectFile,
  useRenameProjectFile,
  useDeleteEntityFile,
  useRenameEntityFile
} from '../../hooks/useProjectFiles';
import { useProject, useEntityContentNodes } from '../../hooks/useProjects';
import { useEntity } from '../../hooks/useEntities';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { Title } from '../../components/Title';
import { RenameDialog } from '../../components/RenameDialog';
import { DropdownMenu } from '../../components/DropdownMenu';
import type { FileTree, ProjectFile } from '@arch-register/api-types/projectContract';
import styles from './MarkdownEditorScreen.module.css';
import { PlateMarkdownEditor } from './editor/PlateMarkdownEditor';
import {
  extractFirstHeadingTitle,
} from './preview/markdownTitle';
import { MdxPreview } from './preview/MdxPreview';
import { MarkdownHistoryPanel } from './MarkdownHistoryPanel';
import {
  projectDetailRoute,
  entityDetailRoute,
  asProjectPublicId,
  asEntityPublicId
} from '../../routes/publicObjectRoutes';

type PaneMode = 'edit' | 'raw' | 'preview';
type ViewPanel = 'preview' | 'history';

const findFileById = (tree: FileTree | undefined, nodeId: string): ProjectFile | undefined => {
  if (!tree) return undefined;
  return [...tree.rootFiles, ...tree.folders.flatMap(folder => folder.files)].find(
    file => file.id === nodeId
  );
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
    historyMode?: 'preview' | 'compare';
    compareMode?: 'to-current' | 'changes-in-version';
  };
  const { workspaceSlug, nodeId, projectId, entityId } = params;
  const navigate = useNavigate();
  const { workspace } = useWorkspaceContext();
  const requestedMode = search.mode === 'edit' ? 'edit' : search.mode === 'raw' ? 'raw' : 'preview';
  const requestedPanel = search.panel === 'history' ? 'history' : 'preview';
  const historyMode = search.historyMode === 'compare' ? 'compare' : 'preview';
  const compareMode = search.compareMode ?? 'to-current';

  const { data, isLoading, isError } = useMarkdownContent(workspaceSlug, nodeId);
  const { data: revisions = [], isLoading: revisionsLoading } = useMarkdownRevisions(
    workspaceSlug,
    nodeId
  );
  const saveMutation = useSaveMarkdownContent(workspaceSlug, nodeId, { projectId, entityId });
  const restoreMutation = useRestoreMarkdownRevision(workspaceSlug, nodeId, {
    projectId,
    entityId
  });
  const deleteWorkspaceFile = useDeleteWorkspaceFile(workspaceSlug);
  const renameWorkspaceFile = useRenameWorkspaceFile(workspaceSlug);
  const deleteProjectFile = useDeleteProjectFile(workspaceSlug, projectId ?? '');
  const renameProjectFile = useRenameProjectFile(workspaceSlug, projectId ?? '');
  const deleteEntityFile = useDeleteEntityFile(workspaceSlug, entityId ?? '');
  const renameEntityFile = useRenameEntityFile(workspaceSlug, entityId ?? '');
  const { data: project } = useProject(workspaceSlug, projectId ?? '', { enabled: !!projectId });
  const { data: entity } = useEntity(workspaceSlug, entityId ?? '');
  const { data: entityFiles } = useEntityContentNodes(workspaceSlug, entityId ?? '', {
    enabled: !!entityId
  });
  const { data: workspaceFiles } = useWorkspaceContentNodes(workspaceSlug, {
    enabled: !projectId && !entityId
  });

  const [body, setBody] = useState('');
  const [paneMode, setPaneMode] = useState<PaneMode>(requestedMode);
  const [viewPanel, setViewPanel] = useState<ViewPanel>(requestedPanel);
  const [dirty, setDirty] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const initializedRef = useRef(false);
  const previousNodeIdRef = useRef(nodeId);

  // editorMode is fully derived from paneMode — edit/raw → editing, preview → viewing
  const editorMode = paneMode === 'preview' ? 'view' : 'edit';

  const selectedRevisionId = search.revisionId;

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
  const toc = useMemo(() => extractToc(body), [body]);
  const readTime = useMemo(() => calcReadTime(body), [body]);
  const updatedLabel = file?.updated_at ? relativeDate(file.updated_at) : null;

  // navigate's function-update form for search means updateSearch only needs navigate as dep
  const updateSearch = useCallback(
    (
      next: Partial<{
        mode: PaneMode;
        panel: ViewPanel;
        revisionId: string | undefined;
        historyMode: 'preview' | 'compare' | undefined;
        compareMode: 'to-current' | 'changes-in-version' | undefined;
      }>
    ) => {
      navigate({
        search: (prev: Record<string, unknown>) =>
          ({
            ...prev,
            mode: next.mode,
            panel: next.panel,
            revisionId: next.revisionId,
            historyMode: next.historyMode,
            compareMode: next.compareMode
          }) as never
      });
    },
    [navigate]
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
    if (selectedRevisionId) return;
    updateSearch({
      mode: 'preview',
      panel: 'history',
      revisionId: revisions[0]!.id
    });
  }, [revisions, selectedRevisionId, updateSearch, viewPanel]);

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
    setPaneMode('preview');
    setViewPanel('preview');
    updateSearch({ mode: 'preview', panel: 'preview', revisionId: undefined });
  }, [body, headingTitle, saveMutation, updateSearch]);

  const handleClose = useCallback(() => {
    if (dirty) {
      setBody(data?.body ?? '');
      setDirty(false);
    }
    setPaneMode('preview');
    setViewPanel('preview');
    updateSearch({
      mode: 'preview',
      panel: 'preview',
      revisionId: undefined,
      historyMode: undefined
    });
  }, [data?.body, dirty, updateSearch]);

  const handleEnterEdit = useCallback(() => {
    setPaneMode('edit');
    updateSearch({ mode: 'edit', panel: undefined, revisionId: undefined });
  }, [updateSearch]);

  const handlePreview = useCallback(() => {
    setPaneMode('preview');
    setViewPanel('preview');
    updateSearch({
      mode: 'preview',
      panel: 'preview',
      revisionId: undefined,
      historyMode: undefined
    });
  }, [updateSearch]);

  const handleOpenHistory = useCallback(() => {
    setPaneMode('preview');
    setViewPanel('history');
    updateSearch({
      mode: 'preview',
      panel: 'history',
      revisionId: revisions[0]?.id
    });
  }, [revisions, updateSearch]);

  const handleRenameConfirm = useCallback(
    async (newName: string) => {
      if (!file) return;
      const trimmed = newName.trim();
      if (!trimmed || trimmed === file.name) {
        setRenameOpen(false);
        return;
      }
      if (projectId) {
        await renameProjectFile.mutateAsync({ file, newName: trimmed });
      } else if (entityId) {
        await renameEntityFile.mutateAsync({ file, newName: trimmed });
      } else {
        await renameWorkspaceFile.mutateAsync({ file, newName: trimmed });
      }
      setRenameOpen(false);
    },
    [file, projectId, entityId, renameProjectFile, renameEntityFile, renameWorkspaceFile]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!file) return;
    if (projectId) {
      await deleteProjectFile.mutateAsync(file.path);
    } else if (entityId) {
      await deleteEntityFile.mutateAsync(file.path);
    } else {
      await deleteWorkspaceFile.mutateAsync(file.path);
    }
    setDeleteOpen(false);
    handleNavigateBack();
  }, [
    file,
    projectId,
    entityId,
    deleteProjectFile,
    deleteEntityFile,
    deleteWorkspaceFile,
    handleNavigateBack
  ]);

  const handleSelectRevision = useCallback(
    (revisionId: string) => {
      updateSearch({
        mode: 'preview',
        panel: 'history',
        revisionId,
        historyMode: historyMode === 'compare' ? 'compare' : undefined,
        compareMode: historyMode === 'compare' ? compareMode : undefined
      });
    },
    [historyMode, compareMode, updateSearch]
  );

  const handleEnterCompare = useCallback(
    (mode: 'to-current' | 'changes-in-version') => {
      updateSearch({
        mode: 'preview',
        panel: 'history',
        historyMode: 'compare',
        compareMode: mode,
        revisionId: selectedRevisionId
      });
    },
    [selectedRevisionId, updateSearch]
  );

  const handleViewVersion = useCallback(() => {
    updateSearch({
      mode: 'preview',
      panel: 'history',
      revisionId: selectedRevisionId,
      historyMode: undefined,
      compareMode: undefined
    });
  }, [selectedRevisionId, updateSearch]);

  const handleRestore = useCallback(
    async (revisionId: string) => {
      if (restoreMutation.isPending) return;
      await restoreMutation.mutateAsync(revisionId);
      setDirty(false);
      setPaneMode('preview');
      setViewPanel('preview');
      updateSearch({
        mode: 'preview',
        panel: 'preview',
        revisionId: undefined,
        historyMode: undefined
      });
    },
    [restoreMutation, updateSearch]
  );

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

  const showPlateEditor = editorMode === 'edit' && paneMode === 'edit';
  const showRawEditor = editorMode === 'edit' && paneMode === 'raw';

  const homeItem = {
    label: 'Home',
    onClick: () => navigate({ to: '/$workspaceSlug/', params: { workspaceSlug } })
  };

  const titleBreadcrumb = projectId
    ? [
        homeItem,
        {
          label: 'Projects',
          onClick: () => navigate({ to: '/$workspaceSlug/projects', params: { workspaceSlug } })
        },
        { label: parentLabel, onClick: handleNavigateBack },
        { label: resolvedTitle }
      ]
    : entityId
      ? [
          homeItem,
          {
            label: 'Entities',
            onClick: () => navigate({ to: '/$workspaceSlug/entities', params: { workspaceSlug } })
          },
          { label: parentLabel, onClick: handleNavigateBack },
          { label: resolvedTitle }
        ]
      : [
          homeItem,
          {
            label: 'Workspace Content',
            onClick: () => navigate({ to: '/$workspaceSlug/content', params: { workspaceSlug } })
          },
          { label: resolvedTitle }
        ];

  const titleIcon = (
    <div className={styles.titleIcon}>
      <TbFileText size={20} />
    </div>
  );

  const titleDescription =
    showPlateEditor || showRawEditor
      ? 'Editing now'
      : viewPanel === 'history'
        ? `Version history${revisions.length > 0 ? ` · ${revisions.length} saved` : ''}`
        : [updatedLabel ? `Updated ${updatedLabel}` : null, `${readTime} min read`]
            .filter(Boolean)
            .join(' · ');

  const isViewMode = editorMode === 'view' && viewPanel === 'preview';

  const titleButtons = (
    <>
      <Button icon={<TbPencil size={13} />} onClick={handleEnterEdit} disabled={!isViewMode}>
        Edit
      </Button>
      <DropdownMenu
        trigger={<Button icon={<TbDots size={13} />} disabled={!isViewMode} />}
        items={[
          { label: 'Versions', icon: <TbHistory size={13} />, onClick: handleOpenHistory },
          { label: 'Rename', icon: <TbPencil size={13} />, onClick: () => setRenameOpen(true) },
          {
            label: 'Delete',
            icon: <TbTrash size={13} />,
            danger: true,
            onClick: () => setDeleteOpen(true)
          }
        ]}
      />
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

      {editorMode === 'edit' && (
        <div className={styles.toolbar}>
          <div className={styles.paneToggle}>
            <button
              type="button"
              className={`${styles.paneToggleBtn} ${paneMode === 'edit' ? styles.paneToggleBtnActive : ''}`}
              onClick={() => setPaneMode('edit')}
            >
              Edit
            </button>
            <button
              type="button"
              className={`${styles.paneToggleBtn} ${paneMode === 'raw' ? styles.paneToggleBtnActive : ''}`}
              onClick={() => setPaneMode('raw')}
            >
              Raw
            </button>
            <button
              type="button"
              className={`${styles.paneToggleBtn} ${paneMode === 'preview' ? styles.paneToggleBtnActive : ''}`}
              onClick={() => setPaneMode('preview')}
            >
              Preview
            </button>
          </div>

          <span className={dirty ? styles.dirty : styles.clean}>
            {dirty ? (
              <>
                <span className={styles.dirtyDot} /> Unsaved changes
              </>
            ) : (
              'All changes saved'
            )}
          </span>

          <div className={styles.toolbarActions}>
            <Button icon={<TbDeviceFloppy size={13} />} variant="secondary" onClick={handleSave}>
              Save
            </Button>
            <Button
              icon={<TbDeviceFloppy size={13} />}
              variant="secondary"
              onClick={handleSaveAndClose}
            >
              Save & Close
            </Button>
            <Button icon={<TbX size={13} />} variant="secondary" onClick={handleClose}>
              Close
            </Button>
          </div>
        </div>
      )}

      {showPlateEditor ? (
        <PlateMarkdownEditor value={body} onChange={handleChange} />
      ) : showRawEditor ? (
        <div className={styles.editPane}>
          <textarea
            className={styles.textarea}
            value={body}
            onChange={e => handleChange(e.target.value)}
            placeholder="Start writing in Markdown…"
            spellCheck
          />
        </div>
      ) : editorMode === 'edit' ? (
        <div className={styles.bodyGrid}>
          <article className={styles.article}>
            {body.trim() ? (
              <MdxPreview body={body} withoutFirstHeading />
            ) : (
              <div className={styles.previewEmpty}>Nothing to preview yet.</div>
            )}
          </article>
          {toc.length > 0 && (
            <aside className={styles.toc}>
              <div className={styles.tocLabel}>On this page</div>
              {toc.map((h, i) => (
                <div key={i} className={styles.tocItem}>
                  {h}
                </div>
              ))}
            </aside>
          )}
        </div>
      ) : viewPanel === 'history' ? (
        <MarkdownHistoryPanel
          workspaceSlug={workspaceSlug}
          nodeId={nodeId}
          currentBody={body}
          revisions={revisions}
          revisionsLoading={revisionsLoading}
          selectedRevisionId={selectedRevisionId}
          historyMode={historyMode}
          compareMode={compareMode}
          isRestoring={restoreMutation.isPending}
          onSelectRevision={handleSelectRevision}
          onViewVersion={handleViewVersion}
          onEnterCompare={handleEnterCompare}
          onRestore={handleRestore}
          onClose={handlePreview}
        />
      ) : (
        <div className={styles.bodyGrid}>
          <article className={styles.article}>
            {body.trim() ? (
              <>
                <MdxPreview body={body} withoutFirstHeading />
                <div className={styles.articleFooter}>
                  {updatedLabel && <>Last edited {updatedLabel} · </>}
                  {readTime} min read
                </div>
              </>
            ) : (
              <div className={styles.previewEmpty}>Preview will appear here as you type.</div>
            )}
          </article>
          {toc.length > 0 && (
            <aside className={styles.toc}>
              <div className={styles.tocLabel}>On this page</div>
              {toc.map((h, i) => (
                <div key={i} className={styles.tocItem}>
                  {h}
                </div>
              ))}
            </aside>
          )}
        </div>
      )}

      <RenameDialog
        open={renameOpen}
        currentName={file?.name ?? ''}
        entityType="document"
        onRename={handleRenameConfirm}
        onCancel={() => setRenameOpen(false)}
      />

      <DeleteConfirmationDialog
        open={deleteOpen}
        title="Delete document?"
        message={
          <>
            The document <b>{file?.name ?? ''}</b> will be permanently deleted.
          </>
        }
        detail="This can't be undone."
        confirmLabel="Delete document"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
};
