import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useParams, useSearch, useNavigate } from '@tanstack/react-router';
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
  useRenameEntityFile,
  useUploadMarkdownAttachment,
  useDeleteMarkdownAttachment
} from '../../hooks/useProjectFiles';
import { useProject, useEntityContentNodes } from '../../hooks/useProjects';
import { useEntity } from '../../hooks/useEntities';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { RenameDialog } from '../../components/RenameDialog';
import type { FileTree, ProjectFile } from '@arch-register/api-types/projectContract';
import { newid } from '@diagram-craft/utils/id';
import styles from './MarkdownEditorScreen.module.css';
import { MdxContext } from './MdxContext';
import { extractFirstHeadingTitle } from './preview/markdownTitle';
import { MarkdownEditorHeader } from './MarkdownEditorHeader';
import { MarkdownEditorToolbar } from './MarkdownEditorToolbar';
import { MarkdownEditorPane } from './MarkdownEditorPane';
import { MarkdownHistoryPanel } from './MarkdownHistoryPanel';
import {
  projectDetailRoute,
  entityDetailRoute,
  asProjectPublicId,
  asEntityPublicId,
  projectDiagramRoute,
  entityDiagramRoute,
  projectMarkdownRoute,
  entityMarkdownRoute
} from '../../routes/publicObjectRoutes';
import {
  deriveMarkdownEditorTitleView,
  enterMarkdownEditMode,
  exitMarkdownEditMode,
  getInitialMarkdownEditorScreenState,
  openMarkdownHistory,
  selectMarkdownEditPane,
  syncMarkdownEditorScreenState,
  type MarkdownPaneMode,
  type MarkdownScreenMode,
  type MarkdownViewPanel
} from './MarkdownEditorScreen.state';
import { MarkdownDiagramSessionContext } from './MarkdownDiagramSessionContext';
import { MarkdownCloseDialog } from './MarkdownCloseDialog';
import {
  buildMarkdownCloseImpactSummary,
  getMarkdownDiagramRollbackRecords,
  hashDiagramContent,
  type MarkdownCloseImpactSummary
} from './markdownDiagramSession';
import { useMarkdownDiagramSessionTracking } from './useMarkdownDiagramSessionTracking';

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
    mode?: MarkdownScreenMode;
    panel?: MarkdownViewPanel;
    revisionId?: string;
    historyMode?: 'preview' | 'compare';
    compareMode?: 'to-current' | 'changes-in-version';
    diagramSessionId?: string;
  };
  const { workspaceSlug, nodeId, projectId, entityId } = params;
  const navigate = useNavigate();
  const { workspace } = useWorkspaceContext();
  const requestedMode = search.mode;
  const requestedPanel = search.panel;
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
  const uploadAttachmentMutation = useUploadMarkdownAttachment(workspaceSlug, nodeId, {
    projectId,
    entityId
  });
  const deleteAttachmentMutation = useDeleteMarkdownAttachment(workspaceSlug, nodeId, {
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
  const [screenState, setScreenState] = useState(() =>
    getInitialMarkdownEditorScreenState(requestedMode, requestedPanel)
  );
  const [dirty, setDirty] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [attachmentDeleteTarget, setAttachmentDeleteTarget] = useState<ProjectFile | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeSummary, setCloseSummary] = useState<MarkdownCloseImpactSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);
  const previousNodeIdRef = useRef(nodeId);

  const selectedRevisionId = search.revisionId;

  const file = useMemo(() => {
    return projectId
      ? findFileById(project?.files, nodeId)
      : entityId
        ? findFileById(entityFiles, nodeId)
        : findFileById(workspaceFiles, nodeId);
  }, [entityFiles, entityId, nodeId, project?.files, projectId, workspaceFiles]);

  const documentTitle = file?.name ?? 'Markdown document';
  const attachments = data?.attachments ?? [];
  const headingTitle = useMemo(() => extractFirstHeadingTitle(body), [body]);
  const resolvedTitle = headingTitle ?? documentTitle;
  const toc = useMemo(() => extractToc(body), [body]);
  const readTime = useMemo(() => calcReadTime(body), [body]);
  const updatedLabel = file?.updated_at ? relativeDate(file.updated_at) : null;
  const titleView = useMemo(
    () =>
      deriveMarkdownEditorTitleView(screenState, {
        revisionsCount: revisions.length,
        updatedLabel,
        readTime
      }),
    [screenState, revisions.length, updatedLabel, readTime]
  );

  // navigate's function-update form for search means updateSearch only needs navigate as dep
  const updateSearch = useCallback(
    (
      next: Partial<{
        mode: MarkdownScreenMode | undefined;
        panel: MarkdownViewPanel | undefined;
        revisionId: string | undefined;
        historyMode: 'preview' | 'compare' | undefined;
        compareMode: 'to-current' | 'changes-in-version' | undefined;
        diagramSessionId: string | undefined;
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
            compareMode: next.compareMode,
            diagramSessionId: next.diagramSessionId
          }) as never
      });
    },
    [navigate]
  );

  const {
    sessionId,
    createdDiagramsRef,
    trackCreatedDiagram,
    hasPendingDiagramChanges,
    clearDiagramSessionState,
    rotateDiagramSession,
    resetForNewDocument,
    loadDiagramContentByPath,
    saveDiagramContentByPath,
    refreshDiagramPreviewCaches
  } = useMarkdownDiagramSessionTracking({
    workspaceSlug,
    projectId,
    entityId,
    initialSessionId: search.diagramSessionId ?? newid(),
    onSessionIdChange: sid => updateSearch({ diagramSessionId: sid })
  });

  const hasUnsavedChanges = dirty || hasPendingDiagramChanges;

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
    resetForNewDocument();
    previousNodeIdRef.current = nodeId;
    initializedRef.current = false;
    setBody('');
    setDirty(false);
    setCloseDialogOpen(false);
    setCloseSummary(null);
  }, [nodeId, resetForNewDocument]);

  useEffect(() => {
    setScreenState(current => syncMarkdownEditorScreenState(current, requestedMode, requestedPanel));
  }, [requestedMode, requestedPanel]);

  useEffect(() => {
    if (requestedMode !== 'edit') return;
    if (search.diagramSessionId === sessionId) return;
    updateSearch({ diagramSessionId: sessionId });
  }, [requestedMode, search.diagramSessionId, sessionId, updateSearch]);

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
    if (screenState.viewPanel !== 'history' || revisions.length === 0) return;
    if (selectedRevisionId) return;
    updateSearch({
      mode: 'preview',
      panel: 'history',
      revisionId: revisions[0]!.id
    });
  }, [revisions, screenState.viewPanel, selectedRevisionId, updateSearch]);

  const handleChange = useCallback((value: string) => {
    setBody(value);
    setDirty(true);
  }, []);

  const buildCloseSummary = useCallback(async () => {
    const records = getMarkdownDiagramRollbackRecords(sessionId);
    const currentContentHashes = Object.fromEntries(
      await Promise.all(
        records
          .filter(record => !!record.lastSavedContentHash)
          .map(async record => {
            try {
              const content = await loadDiagramContentByPath(record.path);
              return [record.diagramId, hashDiagramContent(JSON.stringify(content))] as const;
            } catch {
              return [record.diagramId, undefined] as const;
            }
          })
      )
    );

    return buildMarkdownCloseImpactSummary({
      createdDiagrams: createdDiagramsRef.current,
      records,
      savedBody: data?.body ?? '',
      currentContentHashes
    });
  }, [createdDiagramsRef, data?.body, loadDiagramContentByPath, sessionId]);

  const exitMarkdownEditor = useCallback(() => {
    setScreenState(exitMarkdownEditMode());
    updateSearch({
      mode: 'preview',
      panel: 'preview',
      revisionId: undefined,
      historyMode: undefined,
      diagramSessionId: undefined
    });
  }, [updateSearch]);

  const handleSave = useCallback(async () => {
    if (!dirty) {
      if (hasPendingDiagramChanges) {
        rotateDiagramSession();
        setCloseSummary(null);
      }
      return;
    }
    if (saveMutation.isPending) return;
    await saveMutation.mutateAsync({ body, name: headingTitle ?? undefined });
    setDirty(false);
    rotateDiagramSession();
    setCloseSummary(null);
  }, [body, dirty, hasPendingDiagramChanges, headingTitle, saveMutation, rotateDiagramSession]);

  const handleSaveAndClose = useCallback(async () => {
    if (dirty) {
      if (saveMutation.isPending) return;
      await saveMutation.mutateAsync({ body, name: headingTitle ?? undefined });
      setDirty(false);
    }
    clearDiagramSessionState();
    setCloseSummary(null);
    exitMarkdownEditor();
  }, [body, dirty, headingTitle, saveMutation, clearDiagramSessionState, exitMarkdownEditor]);

  const finalizeClose = useCallback(async () => {
    setBody(data?.body ?? '');
    setDirty(false);
    setCloseDialogOpen(false);
    setCloseSummary(null);
    clearDiagramSessionState();
    exitMarkdownEditor();
  }, [clearDiagramSessionState, data?.body, exitMarkdownEditor]);

  const handleKeepDiagramChanges = useCallback(async () => {
    const savedBody = data?.body ?? '';
    const touchedDiagramIds = getMarkdownDiagramRollbackRecords(sessionId).map(
      record => record.diagramId
    );

    for (const { id, path } of createdDiagramsRef.current) {
      if (!savedBody.includes(id)) {
        await deleteAttachmentMutation.mutateAsync(path);
      }
    }

    await refreshDiagramPreviewCaches(touchedDiagramIds);
    await finalizeClose();
  }, [
    createdDiagramsRef,
    data?.body,
    deleteAttachmentMutation,
    finalizeClose,
    refreshDiagramPreviewCaches,
    sessionId
  ]);

  const handleRevertEligibleDiagramChanges = useCallback(
    async (diagramIds: string[]) => {
      const summary = closeSummary;
      if (!summary) {
        await handleKeepDiagramChanges();
        return;
      }

      const recordsById = new Map(
        getMarkdownDiagramRollbackRecords(sessionId).map(record => [record.diagramId, record])
      );

      for (const diagram of summary.createdDiagramsToDelete) {
        await deleteAttachmentMutation.mutateAsync(diagram.path);
      }

      const revertedDiagramIds = summary.revertableDiagrams
        .filter(diagram => diagramIds.includes(diagram.diagramId))
        .map(diagram => diagram.diagramId);

      for (const diagram of summary.revertableDiagrams.filter(diagram =>
        diagramIds.includes(diagram.diagramId)
      )) {
        const record = recordsById.get(diagram.diagramId);
        if (!record) continue;
        await saveDiagramContentByPath(
          record.path,
          JSON.parse(record.originalContent) as Record<string, unknown>
        );
      }

      await refreshDiagramPreviewCaches(
        Array.from(
          new Set([
            ...summary.createdDiagramsToDelete.map(diagram => diagram.id),
            ...summary.revertableDiagrams.map(diagram => diagram.diagramId),
            ...summary.nonRevertableDiagrams.map(diagram => diagram.diagramId),
            ...revertedDiagramIds
          ])
        )
      );

      await finalizeClose();
    },
    [
      closeSummary,
      deleteAttachmentMutation,
      finalizeClose,
      handleKeepDiagramChanges,
      refreshDiagramPreviewCaches,
      saveDiagramContentByPath,
      sessionId
    ]
  );

  const handleClose = useCallback(async () => {
    if (!dirty && !hasPendingDiagramChanges) {
      exitMarkdownEditor();
      return;
    }

    const summary = await buildCloseSummary();
    setCloseSummary(summary);
    setCloseDialogOpen(true);
  }, [buildCloseSummary, dirty, exitMarkdownEditor, hasPendingDiagramChanges]);

  const handleEnterEdit = useCallback(() => {
    setScreenState(enterMarkdownEditMode());
    updateSearch({
      mode: 'edit',
      panel: undefined,
      revisionId: undefined,
      diagramSessionId: sessionId
    });
  }, [sessionId, updateSearch]);

  const handlePreview = useCallback(() => {
    setScreenState(exitMarkdownEditMode());
    updateSearch({
      mode: 'preview',
      panel: 'preview',
      revisionId: undefined,
      historyMode: undefined,
      diagramSessionId: undefined
    });
  }, [updateSearch]);

  const handleOpenHistory = useCallback(() => {
    setScreenState(openMarkdownHistory());
    updateSearch({
      mode: 'preview',
      panel: 'history',
      revisionId: revisions[0]?.id,
      diagramSessionId: undefined
    });
  }, [revisions, updateSearch]);

  const handleSelectPane = useCallback((paneMode: MarkdownPaneMode) => {
    setScreenState(selectMarkdownEditPane(paneMode));
  }, []);

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

  const handleAttachmentDeleteConfirm = useCallback(async () => {
    if (!attachmentDeleteTarget) return;
    await deleteAttachmentMutation.mutateAsync(attachmentDeleteTarget.path);
    setAttachmentDeleteTarget(null);
  }, [attachmentDeleteTarget, deleteAttachmentMutation]);

  const handleSelectRevision = useCallback(
    (revisionId: string) => {
      updateSearch({
        mode: 'preview',
        panel: 'history',
        revisionId,
        historyMode: historyMode === 'compare' ? 'compare' : undefined,
        compareMode: historyMode === 'compare' ? compareMode : undefined,
        diagramSessionId: undefined
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
        revisionId: selectedRevisionId,
        diagramSessionId: undefined
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
      compareMode: undefined,
      diagramSessionId: undefined
    });
  }, [selectedRevisionId, updateSearch]);

  const handleRestore = useCallback(
    async (revisionId: string) => {
      if (restoreMutation.isPending) return;
      await restoreMutation.mutateAsync(revisionId);
      setDirty(false);
      clearDiagramSessionState();
      exitMarkdownEditor();
    },
    [restoreMutation, clearDiagramSessionState, exitMarkdownEditor]
  );

  const handleOpenAttachment = useCallback(
    (attachment: ProjectFile) => {
      if (attachment.type === 'file') {
        const href = projectId
          ? `/api/${workspaceSlug}/projects/${projectId}/files/download?path=${encodeURIComponent(attachment.path)}`
          : entityId
            ? `/api/${workspaceSlug}/entities/${entityId}/content/files/download?path=${encodeURIComponent(attachment.path)}`
            : `/api/${workspaceSlug}/content/files/download?path=${encodeURIComponent(attachment.path)}`;
        const a = document.createElement('a');
        a.href = href;
        a.download = attachment.original_filename ?? attachment.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      if (attachment.type === 'markdown') {
        if (projectId) {
          navigate(projectMarkdownRoute(workspaceSlug, asProjectPublicId(projectId), attachment.id));
        } else if (entityId) {
          navigate(entityMarkdownRoute(workspaceSlug, asEntityPublicId(entityId), attachment.id));
        } else {
          navigate({
            to: '/$workspaceSlug/content/wiki/$nodeId',
            params: { workspaceSlug, nodeId: attachment.id }
          });
        }
        return;
      }

      if (projectId) {
        navigate(projectDiagramRoute(workspaceSlug, asProjectPublicId(projectId), attachment.id));
      } else if (entityId) {
        navigate(entityDiagramRoute(workspaceSlug, asEntityPublicId(entityId), attachment.id));
      } else {
        navigate({
          to: '/$workspaceSlug/content/diagrams/$diagramId',
          params: { workspaceSlug, diagramId: attachment.id }
        });
      }
    },
    [entityId, navigate, projectId, workspaceSlug]
  );

  const handleAttachmentInputChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = '';
      for (const file of files) {
        await uploadAttachmentMutation.mutateAsync(file);
      }
    },
    [uploadAttachmentMutation]
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

  return (
    <MdxContext.Provider value={{ projectId }}>
    <MarkdownDiagramSessionContext.Provider value={{ sessionId, trackCreatedDiagram }}>
    <div className={styles.screen}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className={styles.hiddenInput}
        onChange={handleAttachmentInputChange}
      />

      <MarkdownEditorHeader
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        entityId={entityId}
        parentLabel={parentLabel}
        resolvedTitle={resolvedTitle}
        description={titleView.description}
        isViewMode={titleView.isViewMode}
        attachDisabled={titleView.attachDisabled}
        isUploadingAttachment={uploadAttachmentMutation.isPending}
        onNavigateBack={handleNavigateBack}
        actions={{
          onAttachClick: () => fileInputRef.current?.click(),
          onEnterEdit: handleEnterEdit,
          onOpenHistory: handleOpenHistory,
          onRenameRequest: () => setRenameOpen(true),
          onDeleteRequest: () => setDeleteOpen(true)
        }}
      />

      {screenState.screenMode === 'edit' && (
        <MarkdownEditorToolbar
          paneMode={screenState.paneMode}
          hasUnsavedChanges={hasUnsavedChanges}
          onSelectPane={handleSelectPane}
          onSave={handleSave}
          onSaveAndClose={handleSaveAndClose}
          onClose={handleClose}
        />
      )}

      {/* viewPanel is only ever 'history' while screenMode is 'preview' (see MarkdownEditorScreen.state.ts) */}
      {screenState.viewPanel === 'history' ? (
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
        <MarkdownEditorPane
          screenMode={screenState.screenMode}
          paneMode={screenState.paneMode}
          body={body}
          onChange={handleChange}
          toc={toc}
          updatedLabel={updatedLabel}
          readTime={readTime}
          attachments={{
            items: attachments,
            onOpen: handleOpenAttachment,
            onDeleteRequest: setAttachmentDeleteTarget,
            isDeleting: deleteAttachmentMutation.isPending
          }}
        />
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

      <DeleteConfirmationDialog
        open={attachmentDeleteTarget !== null}
        title="Delete attachment?"
        message={
          <>
            The attachment <b>{attachmentDeleteTarget?.original_filename ?? attachmentDeleteTarget?.name ?? ''}</b>{' '}
            will be permanently deleted.
          </>
        }
        detail="This can't be undone."
        confirmLabel="Delete attachment"
        onConfirm={handleAttachmentDeleteConfirm}
        onCancel={() => setAttachmentDeleteTarget(null)}
      />

      <MarkdownCloseDialog
        open={closeDialogOpen}
        summary={closeSummary}
        onCancel={() => setCloseDialogOpen(false)}
        onCloseWithSelection={diagramIds =>
          void (diagramIds.length > 0
            ? handleRevertEligibleDiagramChanges(diagramIds)
            : handleKeepDiagramChanges())
        }
      />
    </div>
    </MarkdownDiagramSessionContext.Provider>
    </MdxContext.Provider>
  );
};
