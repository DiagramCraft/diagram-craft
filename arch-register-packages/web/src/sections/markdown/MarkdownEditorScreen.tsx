import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useParams, useSearch, useNavigate } from '@tanstack/react-router';
import type { MarkdownSearchParams } from '../../routes/searchParams';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import {
  useMarkdownContent,
  useMarkdownRevisions,
  useRestoreMarkdownRevision,
  useSaveMarkdownContent,
  useSaveNewMarkdownContent,
  useMigrateMarkdownContent
} from '../../hooks/useMarkdownContent';
import {
  useUploadMarkdownAttachment,
  useDeleteMarkdownAttachment
} from '../../hooks/useAttachments';
import { RenameDialog } from '../../components/RenameDialog';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import { newid } from '@diagram-craft/utils/id';
import styles from './MarkdownEditorScreen.module.css';
import { MdxContext } from './MdxContext';
import { extractFirstHeadingTitle } from './preview/markdownTitle';
import { MarkdownEditorHeader } from './MarkdownEditorHeader';
import { MarkdownEditorToolbar } from './MarkdownEditorToolbar';
import { MarkdownEditorPane } from './MarkdownEditorPane';
import { MarkdownHistoryPanel } from './MarkdownHistoryPanel';
import { LoadingState } from '../../components/LoadingState';
import {
  projectDetailRoute,
  entityDetailRoute,
  asProjectPublicId,
  asEntityPublicId,
  projectDiagramRoute,
  entityDiagramRoute,
  projectMarkdownRoute,
  entityMarkdownRoute,
  workspaceMarkdownRoute
} from '../../routes/publicObjectRoutes';
import {
  deriveMarkdownEditorTitleView,
  getInitialMarkdownEditorScreenState,
  type MarkdownPaneMode,
  type MarkdownEditorScreenState
} from './MarkdownEditorScreen.state';
import { MarkdownDiagramSessionContext } from './MarkdownDiagramSessionContext';
import { MarkdownCloseDialog } from './MarkdownCloseDialog';
import { useMarkdownDiagramSessionTracking } from './useMarkdownDiagramSessionTracking';
import { useMarkdownCloseFlow } from './useMarkdownCloseFlow';
import { useMarkdownDocumentScope } from './useMarkdownDocumentScope';
import type { ContentScope } from '../../hooks/useContentScope';
import { downloadUrl } from '../../lib/browserDownload';
import { useDocumentTemplates, useDocumentTypes } from '../../hooks/useDocuments';
import { MarkdownPropertiesPanel, validateDocMetadata } from './MarkdownPropertiesPanel';
import { ApiError } from '../../lib/http';

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
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false });
  // workspaceSlug is always present: this screen only mounts under the entity/project/content
  // wiki routes, all of which define it. nodeId is only present on the "existing document"
  // routes (.../wiki/$nodeId) -- the "new document" routes (.../wiki/new) omit it, which is
  // the signal we use to distinguish draft (new, unsaved) mode from editing an existing doc.
  const workspaceSlug = params.workspaceSlug!;
  const nodeId = params.nodeId ?? '';
  const isDraft = !params.nodeId;
  const { projectId, entityId } = params;
  const navigate = useNavigate();
  const requestedMode = search.mode;
  const requestedPanel = search.panel;
  const historyMode = search.historyMode === 'compare' ? 'compare' : 'preview';
  const compareMode = search.compareMode ?? 'to-current';
  const draftName = search.draftName ?? 'Untitled document';
  const draftFolder = search.draftFolder;
  const draftType = search.draftType ?? null;
  const draftTemplate = search.draftTemplate ?? null;
  const contentScope: ContentScope = projectId
    ? { kind: 'project', workspaceId: workspaceSlug, projectId }
    : entityId
      ? { kind: 'entity', workspaceId: workspaceSlug, entityId }
      : { kind: 'workspace', workspaceId: workspaceSlug };

  const { data, isLoading, isError } = useMarkdownContent(workspaceSlug, nodeId);
  const { data: documentTypes = [], isLoading: documentTypesLoading } =
    useDocumentTypes(workspaceSlug);
  const { data: workspaceTemplates = [], isLoading: workspaceTemplatesLoading } =
    useDocumentTemplates(workspaceSlug, null);
  const { data: projectTemplates = [], isLoading: projectTemplatesLoading } = useDocumentTemplates(
    workspaceSlug,
    projectId ?? null
  );
  const draftTemplates = projectId
    ? [...workspaceTemplates, ...projectTemplates]
    : workspaceTemplates;
  const draftTemplatesLoading = workspaceTemplatesLoading || projectTemplatesLoading;
  const { data: revisions = [], isLoading: revisionsLoading } = useMarkdownRevisions(
    workspaceSlug,
    nodeId
  );
  const saveMutation = useSaveMarkdownContent(contentScope, nodeId);
  const migrateMutation = useMigrateMarkdownContent(contentScope, nodeId);
  const saveNewMutation = useSaveNewMarkdownContent(contentScope);
  const restoreMutation = useRestoreMarkdownRevision(contentScope, nodeId);
  const uploadAttachmentMutation = useUploadMarkdownAttachment(contentScope, nodeId);
  const deleteAttachmentMutation = useDeleteMarkdownAttachment(contentScope, nodeId);
  const { file, parentLabel, renameFile, deleteFile } = useMarkdownDocumentScope({
    workspaceSlug,
    nodeId,
    projectId,
    entityId
  });

  const [body, setBody] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState<string | null>(isDraft ? draftType : null);
  const [metadata, setMetadata] = useState<NonNullable<typeof data>['metadata']>({});
  const [paneMode, setPaneMode] = useState<MarkdownPaneMode>(
    isDraft || requestedMode === 'edit' ? 'edit' : 'preview'
  );
  const screenState = useMemo<MarkdownEditorScreenState>(
    () =>
      isDraft
        ? { screenMode: 'edit', paneMode, viewPanel: 'preview' }
        : { ...getInitialMarkdownEditorScreenState(requestedMode, requestedPanel), paneMode },
    [isDraft, paneMode, requestedMode, requestedPanel]
  );
  const [dirty, setDirty] = useState(isDraft);
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [attachmentDeleteTarget, setAttachmentDeleteTarget] = useState<ProjectFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);
  const previousNodeIdRef = useRef(nodeId);

  const selectedRevisionId = search.revisionId;

  const documentTitle = isDraft ? draftName : (file?.name ?? 'Markdown document');
  const isReadOnly = !!file?.read_only;
  const attachments = data?.attachments ?? [];
  const headingTitle = useMemo(() => extractFirstHeadingTitle(body), [body]);
  const resolvedTitle = headingTitle ?? documentTitle;
  const toc = useMemo(() => extractToc(body), [body]);
  const readTime = useMemo(() => calcReadTime(body), [body]);
  const updatedLabel = file?.updated_at ? relativeDate(file.updated_at) : null;
  const availableDocumentTypes = useMemo(() => {
    if (!data?.document_type || documentTypes.some(type => type.id === data.document_type?.id))
      return documentTypes;
    return [...documentTypes, data.document_type];
  }, [data?.document_type, documentTypes]);
  const selectedDocumentType = documentTypeId
    ? (availableDocumentTypes.find(type => type.id === documentTypeId) ?? null)
    : null;
  const documentFields =
    documentTypeId == null ? [] : (selectedDocumentType?.fields ?? data?.available_fields ?? []);
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
        mode: MarkdownEditorScreenState['screenMode'] | undefined;
        panel: MarkdownEditorScreenState['viewPanel'] | undefined;
        revisionId: string | undefined;
        historyMode: 'preview' | 'compare' | undefined;
        compareMode: 'to-current' | 'changes-in-version' | undefined;
        diagramSessionId: string | undefined;
      }>,
      replace = false
    ) => {
      // This screen is shared across three sibling wiki routes with identical
      // search schemas; there's no single static route to scope `navigate` to,
      // so the search-updater type can't be inferred and needs a manual cast.
      navigate({
        search: ((prev: MarkdownSearchParams) => ({
          ...prev,
          ...next
        })) as never,
        replace
      });
    },
    [navigate]
  );

  useEffect(() => {
    if (!isReadOnly || requestedMode !== 'edit') return;
    setPaneMode('preview');
    updateSearch({ mode: 'preview', panel: 'preview' }, true);
  }, [isReadOnly, requestedMode, updateSearch]);

  useEffect(() => {
    // Draft mode manages paneMode purely locally via the toolbar; it never round-trips
    // through `mode` search params the way the existing-document editor does.
    if (isDraft) return;
    setPaneMode(requestedMode === 'edit' ? 'edit' : 'preview');
  }, [isDraft, requestedMode]);

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
    onSessionIdChange: sid => updateSearch({ diagramSessionId: sid }, true)
  });

  const hasUnsavedChanges = dirty || hasPendingDiagramChanges;

  const handleNavigateBack = useCallback(() => {
    if (projectId) {
      navigate(projectDetailRoute(workspaceSlug, asProjectPublicId(projectId)));
    } else if (entityId) {
      navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entityId)));
    } else {
      navigate({ to: '/$workspaceSlug/content', params: { workspaceSlug } });
    }
  }, [navigate, workspaceSlug, projectId, entityId]);

  const exitMarkdownEditor = useCallback(() => {
    updateSearch({
      mode: 'preview',
      panel: 'preview',
      revisionId: undefined,
      historyMode: undefined,
      compareMode: undefined,
      diagramSessionId: undefined
    });
  }, [updateSearch]);

  const handleCloseFlowExit = useCallback(() => {
    setBody(data?.body ?? '');
    setDirty(false);
    exitMarkdownEditor();
  }, [data?.body, exitMarkdownEditor]);

  const deleteAttachment = useCallback(
    (path: string) => deleteAttachmentMutation.mutateAsync(path),
    [deleteAttachmentMutation]
  );

  const {
    closeDialogOpen,
    closeSummary,
    clearCloseSummary,
    handleClose,
    handleCancelClose,
    handleKeepDiagramChanges,
    handleRevertEligibleDiagramChanges
  } = useMarkdownCloseFlow({
    dirty,
    hasPendingDiagramChanges,
    savedBody: data?.body ?? '',
    sessionId,
    createdDiagramsRef,
    loadDiagramContentByPath,
    saveDiagramContentByPath,
    refreshDiagramPreviewCaches,
    clearDiagramSessionState,
    deleteAttachment,
    onExit: handleCloseFlowExit
  });

  // Discarding a fresh, never-saved draft is a plain exit -- there's no saved state to protect
  // and no confirmation dialog today, unlike closing an existing (already-saved) document.
  const handleDraftClose = useCallback(() => {
    clearDiagramSessionState();
    handleNavigateBack();
  }, [clearDiagramSessionState, handleNavigateBack]);

  useEffect(() => {
    if (previousNodeIdRef.current === nodeId) return;
    resetForNewDocument();
    previousNodeIdRef.current = nodeId;
    initializedRef.current = false;
    setBody('');
    setDirty(false);
    setAttemptedSave(false);
    handleCancelClose();
    clearCloseSummary();
  }, [nodeId, resetForNewDocument, handleCancelClose, clearCloseSummary]);

  useEffect(() => {
    if (requestedMode !== 'edit') return;
    if (search.diagramSessionId === sessionId) return;
    updateSearch({ diagramSessionId: sessionId }, true);
  }, [requestedMode, search.diagramSessionId, sessionId, updateSearch]);

  useEffect(() => {
    if (isDraft || !data) return;
    if (!initializedRef.current) {
      setBody(data.body);
      setDocumentTypeId(data.document_type_id);
      setMetadata(data.metadata);
      initializedRef.current = true;
      setDirty(false);
      return;
    }
    if (!dirty) {
      setBody(data.body);
      setDocumentTypeId(data.document_type_id);
      setMetadata(data.metadata);
    }
  }, [isDraft, data, dirty]);

  useEffect(() => {
    if (!isDraft) return;
    if (initializedRef.current || documentTypesLoading || draftTemplatesLoading) return;
    const template = draftTemplates.find(item => item.id === draftTemplate);
    setBody(template ? template.body.split('{{title}}').join(draftName) : '');
    setDocumentTypeId(template?.document_type_id ?? draftType);
    setMetadata(template?.metadata_defaults ?? {});
    setDirty(true);
    initializedRef.current = true;
  }, [
    isDraft,
    documentTypesLoading,
    draftTemplatesLoading,
    draftTemplates,
    draftTemplate,
    draftType,
    draftName
  ]);

  useEffect(() => {
    if (screenState.viewPanel !== 'history' || revisions.length === 0) return;
    if (selectedRevisionId) return;
    updateSearch(
      {
        mode: 'preview',
        panel: 'history',
        revisionId: revisions[0]!.id
      },
      true
    );
  }, [revisions, screenState.viewPanel, selectedRevisionId, updateSearch]);

  const handleChange = useCallback((value: string) => {
    setBody(value);
    setDirty(true);
  }, []);

  const handleDocumentTypeChange = useCallback((id: string | null) => {
    setDocumentTypeId(id);
    setDirty(true);
  }, []);

  const handleMetadataChange = useCallback(
    (fieldId: string, value: string | number | boolean | string[] | null | undefined) => {
      setMetadata(current => {
        if (value === undefined) {
          const next = { ...current };
          delete next[fieldId];
          return next;
        }
        return { ...current, [fieldId]: value };
      });
      setDirty(true);
    },
    []
  );

  const saveExistingDocument = useCallback(async () => {
    const currentDocumentTypeId = data?.document_type_id ?? null;
    const input = {
      body,
      name: headingTitle ?? undefined,
      document_type_id: documentTypeId,
      metadata
    };
    if (documentTypeId !== currentDocumentTypeId) {
      await migrateMutation.mutateAsync(input);
    } else {
      await saveMutation.mutateAsync(input);
    }
  }, [
    body,
    data?.document_type_id,
    documentTypeId,
    headingTitle,
    metadata,
    migrateMutation,
    saveMutation
  ]);

  const saveDraftDocument = useCallback(async () => {
    const title = resolvedTitle.trim();
    if (!title) return null;
    setDraftSaveError(null);
    try {
      return await saveNewMutation.mutateAsync({
        name: title,
        folder: draftFolder,
        body,
        document_type_id: documentTypeId,
        metadata
      });
    } catch (cause) {
      setDraftSaveError(cause instanceof ApiError ? cause.message : 'Unable to save document');
      return null;
    }
  }, [resolvedTitle, draftFolder, body, documentTypeId, metadata, saveNewMutation]);

  const navigateToSavedDraft = useCallback(
    (savedFile: ProjectFile) => {
      if (projectId) {
        navigate(
          projectMarkdownRoute(workspaceSlug, asProjectPublicId(projectId), savedFile.id, {
            mode: 'edit'
          })
        );
      } else if (entityId) {
        navigate(
          entityMarkdownRoute(workspaceSlug, asEntityPublicId(entityId), savedFile.id, {
            mode: 'edit'
          })
        );
      } else {
        navigate(workspaceMarkdownRoute(workspaceSlug, savedFile.id, { mode: 'edit' }));
      }
    },
    [entityId, navigate, projectId, workspaceSlug]
  );

  const handleSave = useCallback(async () => {
    if (isDraft) {
      if (saveNewMutation.isPending) return;
      const savedFile = await saveDraftDocument();
      if (!savedFile) return;
      setDirty(false);
      navigateToSavedDraft(savedFile);
      return;
    }
    if (isReadOnly) return;
    if (!dirty) {
      if (hasPendingDiagramChanges) {
        rotateDiagramSession();
        clearCloseSummary();
      }
      return;
    }
    if (Object.keys(validateDocMetadata(documentFields, metadata).errors).length > 0) {
      setAttemptedSave(true);
      return;
    }
    if (saveMutation.isPending || migrateMutation.isPending) return;
    await saveExistingDocument();
    setDirty(false);
    setAttemptedSave(false);
    rotateDiagramSession();
    clearCloseSummary();
  }, [
    isDraft,
    saveNewMutation.isPending,
    saveDraftDocument,
    navigateToSavedDraft,
    dirty,
    hasPendingDiagramChanges,
    saveMutation,
    migrateMutation,
    saveExistingDocument,
    rotateDiagramSession,
    clearCloseSummary,
    isReadOnly,
    documentFields,
    metadata
  ]);

  const handleSaveAndClose = useCallback(async () => {
    if (isDraft) {
      if (saveNewMutation.isPending) return;
      const savedFile = await saveDraftDocument();
      if (!savedFile) return;
      setDirty(false);
      clearDiagramSessionState();
      handleNavigateBack();
      return;
    }
    if (isReadOnly) {
      clearDiagramSessionState();
      clearCloseSummary();
      exitMarkdownEditor();
      return;
    }
    if (dirty) {
      if (Object.keys(validateDocMetadata(documentFields, metadata).errors).length > 0) {
        setAttemptedSave(true);
        return;
      }
      if (saveMutation.isPending || migrateMutation.isPending) return;
      await saveExistingDocument();
      setDirty(false);
      setAttemptedSave(false);
    }
    clearDiagramSessionState();
    clearCloseSummary();
    exitMarkdownEditor();
  }, [
    isDraft,
    saveNewMutation.isPending,
    saveDraftDocument,
    clearDiagramSessionState,
    handleNavigateBack,
    dirty,
    saveMutation,
    migrateMutation,
    saveExistingDocument,
    clearCloseSummary,
    exitMarkdownEditor,
    isReadOnly,
    documentFields,
    metadata
  ]);

  const handleEnterEdit = useCallback(() => {
    if (isReadOnly) return;
    setPaneMode('edit');
    updateSearch({
      mode: 'edit',
      panel: undefined,
      revisionId: undefined,
      historyMode: undefined,
      compareMode: undefined,
      diagramSessionId: sessionId
    });
  }, [isReadOnly, sessionId, updateSearch]);

  const handlePreview = useCallback(() => {
    updateSearch({
      mode: 'preview',
      panel: 'preview',
      revisionId: undefined,
      historyMode: undefined,
      compareMode: undefined,
      diagramSessionId: undefined
    });
  }, [updateSearch]);

  const handleOpenHistory = useCallback(() => {
    updateSearch({
      mode: 'preview',
      panel: 'history',
      revisionId: revisions[0]?.id,
      historyMode: undefined,
      compareMode: undefined,
      diagramSessionId: undefined
    });
  }, [revisions, updateSearch]);

  const handleSelectPane = useCallback((mode: MarkdownPaneMode) => {
    setPaneMode(mode);
  }, []);

  const handleRenameConfirm = useCallback(
    async (newName: string) => {
      if (!file || isReadOnly) return;
      await renameFile(newName);
      setRenameOpen(false);
    },
    [file, isReadOnly, renameFile]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!file || isReadOnly) return;
    await deleteFile();
    setDeleteOpen(false);
    handleNavigateBack();
  }, [file, isReadOnly, deleteFile, handleNavigateBack]);

  const handleAttachmentDeleteConfirm = useCallback(async () => {
    if (!attachmentDeleteTarget || isReadOnly) return;
    await deleteAttachment(attachmentDeleteTarget.path);
    setAttachmentDeleteTarget(null);
  }, [attachmentDeleteTarget, isReadOnly, deleteAttachment]);

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
      if (isReadOnly || restoreMutation.isPending) return;
      await restoreMutation.mutateAsync(revisionId);
      setDirty(false);
      clearDiagramSessionState();
      exitMarkdownEditor();
    },
    [isReadOnly, restoreMutation, clearDiagramSessionState, exitMarkdownEditor]
  );

  const handleOpenAttachment = useCallback(
    (attachment: ProjectFile) => {
      if (attachment.type === 'file') {
        const href = projectId
          ? `/api/${workspaceSlug}/projects/${projectId}/files/download?path=${encodeURIComponent(attachment.path)}`
          : entityId
            ? `/api/${workspaceSlug}/entities/${entityId}/content/files/download?path=${encodeURIComponent(attachment.path)}`
            : `/api/${workspaceSlug}/content/files/download?path=${encodeURIComponent(attachment.path)}`;
        downloadUrl(href, attachment.original_filename ?? attachment.name);
        return;
      }

      if (attachment.type === 'markdown') {
        if (projectId) {
          navigate(
            projectMarkdownRoute(workspaceSlug, asProjectPublicId(projectId), attachment.id)
          );
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

  if (!isDraft && isLoading) {
    return (
      <div className={styles.screen}>
        <LoadingState text="Loading…" />
      </div>
    );
  }

  if (!isDraft && isError) {
    return (
      <div className={styles.screen}>
        <div className={styles.loading}>Failed to load document.</div>
      </div>
    );
  }

  return (
    <MdxContext.Provider
      value={{ workspaceSlug, projectId, entityId, nodeId: isDraft ? undefined : nodeId }}
    >
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
            description={
              isDraft
                ? (selectedDocumentType?.name ?? 'New markdown document')
                : titleView.description
            }
            isViewMode={titleView.isViewMode && !isReadOnly}
            isDraft={isDraft}
            attachDisabled={titleView.attachDisabled || isReadOnly}
            isUploadingAttachment={uploadAttachmentMutation.isPending}
            onNavigateBack={handleNavigateBack}
            actions={{
              onAttachClick: () => {
                if (!isReadOnly) fileInputRef.current?.click();
              },
              onEnterEdit: handleEnterEdit,
              onOpenHistory: handleOpenHistory,
              onRenameRequest: () => setRenameOpen(true),
              onDeleteRequest: () => setDeleteOpen(true)
            }}
          />

          {(isDraft || (!isReadOnly && screenState.screenMode === 'edit')) && (
            <MarkdownEditorToolbar
              paneMode={screenState.paneMode}
              hasUnsavedChanges={hasUnsavedChanges}
              onSelectPane={handleSelectPane}
              onSave={handleSave}
              onSaveAndClose={handleSaveAndClose}
              onClose={isDraft ? handleDraftClose : handleClose}
            />
          )}

          {/* viewPanel is only ever 'history' while screenMode is 'preview' (see MarkdownEditorScreen.state.ts); never true in draft mode */}
          {!isDraft && screenState.viewPanel === 'history' ? (
            <MarkdownHistoryPanel
              workspaceSlug={workspaceSlug}
              nodeId={nodeId}
              currentBody={body}
              currentMetadata={metadata}
              currentDocumentTypeId={documentTypeId}
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
              screenMode={isReadOnly ? 'preview' : screenState.screenMode}
              paneMode={isReadOnly ? 'preview' : screenState.paneMode}
              body={body}
              onChange={isReadOnly ? () => {} : handleChange}
              toc={toc}
              updatedLabel={updatedLabel}
              readTime={readTime}
              workspaceId={workspaceSlug}
              nodeId={nodeId}
              showDiscussion={!isDraft}
              attachments={{
                items: attachments,
                onOpen: handleOpenAttachment,
                onDeleteRequest: setAttachmentDeleteTarget,
                isDeleting: deleteAttachmentMutation.isPending
              }}
              propertiesPanel={
                <MarkdownPropertiesPanel
                  documentTypeId={documentTypeId}
                  documentTypes={availableDocumentTypes}
                  fields={documentFields}
                  metadata={metadata}
                  readOnly={isReadOnly || screenState.screenMode !== 'edit'}
                  attemptedSave={attemptedSave}
                  onTypeChange={handleDocumentTypeChange}
                  onValueChange={handleMetadataChange}
                />
              }
            />
          )}

          {draftSaveError && (
            <div role="alert" className={styles.loading}>
              {draftSaveError}
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

          <DeleteConfirmationDialog
            open={attachmentDeleteTarget !== null}
            title="Delete attachment?"
            message={
              <>
                The attachment{' '}
                <b>
                  {attachmentDeleteTarget?.original_filename ?? attachmentDeleteTarget?.name ?? ''}
                </b>{' '}
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
            onCancel={handleCancelClose}
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
