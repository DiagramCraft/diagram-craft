import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MutableRefObject
} from 'react';
import type {
  DocumentGeneratedMetadata,
  DocumentMetadata,
  DocumentTemplate,
  DocumentType,
  DocumentAiAction
} from '@arch-register/api-types/documentContract';
import type { GovernanceInitiationField } from '@arch-register/api-types/governanceInitiationFields';
import type { GovernanceWorkflowConfigRow } from '@arch-register/api-types/governanceWorkflowConfigContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type {
  MarkdownContent,
  MarkdownRevisionSummary
} from '@arch-register/api-types/projectMarkdownContract';
import type { ProjectFile } from '@arch-register/api-types/projectContentContract';
import type { RunAiActionResponse } from '@arch-register/api-types/projectDocumentAiContract';
import { useCreateConversation } from '../../hooks/useAiConversations';
import { useAiStatus } from '../../hooks/useAiConfig';
import {
  useDeleteMarkdownAttachment,
  useUploadMarkdownAttachment
} from '../../hooks/useAttachments';
import {
  useMigrateMarkdownContent,
  useRestoreMarkdownRevision,
  useSaveMarkdownContent,
  useSaveNewMarkdownContent
} from '../../hooks/useMarkdownContent';
import type { ContentScope } from '../../hooks/useContentScope';
import { useMarkdownCloseFlow } from './useMarkdownCloseFlow';
import { extractFirstHeadingTitle } from './preview/markdownTitle';
import {
  deriveMarkdownEditorTitleView,
  getInitialMarkdownEditorScreenState,
  type MarkdownEditorScreenState,
  type MarkdownPaneMode
} from './MarkdownEditorScreen.state';
import { hasWorkflowFields } from './markdownChangeImpact';
import { validateDocMetadata } from './MarkdownPropertiesPanel';
import { ApiError } from '../../lib/http';
import { runDocumentAiAction } from '../../hooks/useDocumentAiActions';
import { writeAiActionSeed } from '../../lib/aiActionSeed';
import type { MarkdownSearchParams } from '../../routes/searchParams';
import type { CommentsDisplayMode } from '../wikiComments/commentsDisplayMode';
import { nextCommentsDisplayMode } from '../wikiComments/commentsDisplayMode';
import type { DiagramSessionRecord } from './markdownDiagramSession';
import type { MarkdownSaveIntent } from './MarkdownChangeImpactDialog';

export type MarkdownEditorSearchUpdate = (
  next: Partial<MarkdownSearchParams>,
  replace?: boolean
) => void;

type MarkdownEditorDiagramLifecycle = {
  sessionId: string;
  createdDiagramsRef: MutableRefObject<DiagramSessionRecord[]>;
  hasPendingDiagramChanges: boolean;
  clearDiagramSessionState: () => void;
  rotateDiagramSession: () => void;
  resetForNewDocument: () => void;
  loadDiagramContentByPath: (path: string) => Promise<unknown>;
  saveDiagramContentByPath: (path: string, content: Record<string, unknown>) => Promise<void>;
  refreshDiagramPreviewCaches: (diagramIds: string[]) => Promise<void>;
};

export type MarkdownEditorControllerOptions = {
  workspaceSlug: string;
  nodeId: string;
  projectId?: string;
  entityId?: string;
  isDraft: boolean;
  isReadOnly: boolean;
  data: MarkdownContent | undefined;
  file: ProjectFile | undefined;
  documentTitle: string;
  draftName: string;
  draftFolder?: string;
  draftType: string | null;
  draftTemplate: string | null;
  draftTemplates: DocumentTemplate[];
  draftTemplatesLoading: boolean;
  documentTypes: DocumentType[];
  documentTypesLoading: boolean;
  governanceWorkflowConfig: { configs: GovernanceWorkflowConfigRow[] } | undefined;
  workspaceEnums: WorkspaceEnum[];
  contentScope: ContentScope;
  requestedMode: MarkdownSearchParams['mode'];
  requestedPanel: MarkdownSearchParams['panel'];
  diagramSessionId: string | undefined;
  historyMode: 'preview' | 'compare';
  compareMode: 'to-current' | 'changes-in-version';
  selectedRevisionId: string | undefined;
  revisions: MarkdownRevisionSummary[];
  updatedLabel: string | null;
  onNavigateBack: () => void;
  onNavigateToSavedDraft: (file: ProjectFile) => void;
  onExit: () => void;
  onNavigateToConversation: (conversationId: string) => void;
  onOpenAttachment: (attachment: ProjectFile) => void;
  onDownloadAttachment: (attachment: ProjectFile) => void;
  renameFile: (newName: string) => Promise<void>;
  deleteFile: () => Promise<void>;
  updateSearch: MarkdownEditorSearchUpdate;
  diagram: MarkdownEditorDiagramLifecycle;
};

export const useMarkdownEditorController = ({
  workspaceSlug,
  nodeId,
  isDraft,
  isReadOnly,
  data,
  file,
  documentTitle,
  draftName,
  draftFolder,
  draftType,
  draftTemplate,
  draftTemplates,
  draftTemplatesLoading,
  documentTypes,
  documentTypesLoading,
  governanceWorkflowConfig,
  workspaceEnums,
  contentScope,
  requestedMode,
  requestedPanel,
  diagramSessionId,
  historyMode,
  compareMode,
  selectedRevisionId,
  revisions,
  updatedLabel,
  onNavigateBack,
  onNavigateToSavedDraft,
  onExit,
  onNavigateToConversation,
  onOpenAttachment,
  onDownloadAttachment,
  renameFile,
  deleteFile,
  updateSearch,
  diagram
}: MarkdownEditorControllerOptions) => {
  const saveMutation = useSaveMarkdownContent(contentScope, nodeId);
  const migrateMutation = useMigrateMarkdownContent(contentScope, nodeId);
  const saveNewMutation = useSaveNewMarkdownContent(contentScope);
  const restoreMutation = useRestoreMarkdownRevision(contentScope, nodeId);
  const uploadAttachmentMutation = useUploadMarkdownAttachment(contentScope, nodeId);
  const deleteAttachmentMutation = useDeleteMarkdownAttachment(contentScope, nodeId);
  const createConversationMutation = useCreateConversation(workspaceSlug);
  const { data: aiStatus } = useAiStatus(workspaceSlug, !isDraft);

  const [body, setBody] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState<string | null>(isDraft ? draftType : null);
  const [metadata, setMetadata] = useState<DocumentMetadata>({});
  const [generatedMetadata, setGeneratedMetadata] = useState<DocumentGeneratedMetadata>({});
  const [paneMode, setPaneMode] = useState<MarkdownPaneMode>(
    isDraft || requestedMode === 'edit' ? 'edit' : 'preview'
  );
  const [commentsMode, setCommentsMode] = useState<CommentsDisplayMode>('side');
  const [dirty, setDirty] = useState(isDraft);
  const [changeKind, setChangeKind] = useState<'minor' | 'major'>('minor');
  const [pendingSaveIntent, setPendingSaveIntent] = useState<MarkdownSaveIntent | null>(null);
  const [initiationFieldValues, setInitiationFieldValues] = useState<Record<string, unknown>>({});
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [attachmentDeleteTarget, setAttachmentDeleteTarget] = useState<ProjectFile | null>(null);
  const [runningAiActionId, setRunningAiActionId] = useState<string | null>(null);
  const [aiActionResult, setAiActionResult] = useState<RunAiActionResponse | null>(null);
  const [aiActionStreamingText, setAiActionStreamingText] = useState('');
  const [aiActionError, setAiActionError] = useState<string | null>(null);
  const [aiActionPanelOpen, setAiActionPanelOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);
  const previousNodeIdRef = useRef(nodeId);

  const screenState = useMemo<MarkdownEditorScreenState>(
    () =>
      isDraft
        ? { screenMode: 'edit', paneMode, viewPanel: 'preview' }
        : { ...getInitialMarkdownEditorScreenState(requestedMode, requestedPanel), paneMode },
    [isDraft, paneMode, requestedMode, requestedPanel]
  );

  const headingTitle = useMemo(() => extractFirstHeadingTitle(body), [body]);
  const resolvedTitle = headingTitle ?? documentTitle;
  const toc = useMemo(
    () => body.match(/^## .+$/gm)?.map(line => line.slice(3).trim()) ?? [],
    [body]
  );
  const readTime = useMemo(
    () => Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 200)),
    [body]
  );
  const availableDocumentTypes = useMemo(() => {
    if (!data?.document_type || documentTypes.some(type => type.id === data.document_type?.id)) {
      return documentTypes;
    }
    return [...documentTypes, data.document_type];
  }, [data?.document_type, documentTypes]);
  const selectedDocumentType = documentTypeId
    ? (availableDocumentTypes.find(type => type.id === documentTypeId) ?? null)
    : null;
  const documentFields =
    documentTypeId == null ? [] : (selectedDocumentType?.fields ?? data?.available_fields ?? []);
  const workflowEnabled = hasWorkflowFields(documentFields);
  const documentInitiationFields = useMemo<GovernanceInitiationField[]>(() => {
    if (!documentTypeId) return [];
    const seen = new Set<string>();
    return (governanceWorkflowConfig?.configs ?? [])
      .filter(
        row =>
          row.case_kind === 'document.status' && row.case_subkind?.startsWith(`${documentTypeId}:`)
      )
      .flatMap(row => row.config.initiationFields ?? [])
      .map(field =>
        field.type === 'enum' && !field.options && field.enumId
          ? {
              ...field,
              options: workspaceEnums.find(item => item.id === field.enumId)?.options ?? []
            }
          : field
      )
      .filter(field => {
        if (seen.has(field.id)) return false;
        seen.add(field.id);
        return true;
      });
  }, [documentTypeId, governanceWorkflowConfig?.configs, workspaceEnums]);
  const titleView = useMemo(
    () =>
      deriveMarkdownEditorTitleView(screenState, {
        revisionsCount: revisions.length,
        updatedLabel,
        readTime
      }),
    [readTime, revisions.length, screenState, updatedLabel]
  );

  const hasUnsavedChanges = dirty || diagram.hasPendingDiagramChanges;

  useEffect(() => {
    if (!isReadOnly || requestedMode !== 'edit') return;
    setPaneMode('preview');
    updateSearch({ mode: 'preview', panel: 'preview' }, true);
  }, [isReadOnly, requestedMode, updateSearch]);

  useEffect(() => {
    if (isDraft) return;
    setPaneMode(requestedMode === 'edit' ? 'edit' : 'preview');
  }, [isDraft, requestedMode]);

  const handleCloseFlowExit = useCallback(() => {
    setBody(data?.body ?? '');
    setDirty(false);
    onExit();
  }, [data?.body, onExit]);

  const deleteAttachment = useCallback(
    (path: string) => deleteAttachmentMutation.mutateAsync(path),
    [deleteAttachmentMutation]
  );

  const closeFlow = useMarkdownCloseFlow({
    dirty,
    hasPendingDiagramChanges: diagram.hasPendingDiagramChanges,
    savedBody: data?.body ?? '',
    sessionId: diagram.sessionId,
    createdDiagramsRef: diagram.createdDiagramsRef,
    loadDiagramContentByPath: diagram.loadDiagramContentByPath,
    saveDiagramContentByPath: diagram.saveDiagramContentByPath,
    refreshDiagramPreviewCaches: diagram.refreshDiagramPreviewCaches,
    clearDiagramSessionState: diagram.clearDiagramSessionState,
    deleteAttachment,
    onExit: handleCloseFlowExit
  });

  const handleDraftClose = useCallback(() => {
    diagram.clearDiagramSessionState();
    onNavigateBack();
  }, [diagram.clearDiagramSessionState, onNavigateBack]);

  useEffect(() => {
    if (previousNodeIdRef.current === nodeId) return;
    diagram.resetForNewDocument();
    previousNodeIdRef.current = nodeId;
    initializedRef.current = false;
    setBody('');
    setDocumentTypeId(null);
    setMetadata({});
    setGeneratedMetadata({});
    setDirty(false);
    setAttemptedSave(false);
    setPendingSaveIntent(null);
    setChangeKind('minor');
    closeFlow.handleCancelClose();
    closeFlow.clearCloseSummary();
  }, [closeFlow, diagram, nodeId]);

  useEffect(() => {
    if (requestedMode !== 'edit') return;
    if (diagramSessionId === diagram.sessionId) return;
    updateSearch({ diagramSessionId: diagram.sessionId }, true);
  }, [diagram.sessionId, diagramSessionId, requestedMode, updateSearch]);

  useEffect(() => {
    if (isDraft || !data) return;
    if (!initializedRef.current) {
      setBody(data.body);
      setDocumentTypeId(data.document_type_id);
      setMetadata(data.metadata);
      setGeneratedMetadata(data.generated_metadata ?? {});
      initializedRef.current = true;
      setDirty(false);
      return;
    }
    if (!dirty) {
      setBody(data.body);
      setDocumentTypeId(data.document_type_id);
      setMetadata(data.metadata);
      setGeneratedMetadata(data.generated_metadata ?? {});
    }
  }, [data, dirty, isDraft]);

  useEffect(() => {
    if (!isDraft || initializedRef.current || documentTypesLoading || draftTemplatesLoading) return;
    const template = draftTemplates.find(item => item.id === draftTemplate);
    setBody(template ? template.body.split('{{title}}').join(draftName) : '');
    setDocumentTypeId(template?.document_type_id ?? draftType);
    setMetadata(template?.metadata_defaults ?? {});
    setDirty(true);
    initializedRef.current = true;
  }, [
    documentTypesLoading,
    draftName,
    draftTemplate,
    draftTemplates,
    draftTemplatesLoading,
    draftType,
    isDraft
  ]);

  useEffect(() => {
    if (screenState.viewPanel !== 'history' || revisions.length === 0 || selectedRevisionId) {
      return;
    }
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

  const saveExistingDocument = useCallback(
    async (kind: 'minor' | 'major') => {
      const currentDocumentTypeId = data?.document_type_id ?? null;
      const input = {
        body,
        name: headingTitle ?? undefined,
        document_type_id: documentTypeId,
        metadata,
        change_kind: kind,
        initiation_fields: initiationFieldValues
      };
      if (documentTypeId !== currentDocumentTypeId) {
        await migrateMutation.mutateAsync(input);
      } else {
        await saveMutation.mutateAsync(input);
      }
    },
    [
      body,
      data?.document_type_id,
      documentTypeId,
      headingTitle,
      initiationFieldValues,
      metadata,
      migrateMutation,
      saveMutation
    ]
  );

  const completeExistingSave = useCallback(
    async (kind: 'minor' | 'major', closeAfterSave: boolean) => {
      await saveExistingDocument(kind);
      setDirty(false);
      setAttemptedSave(false);
      if (closeAfterSave) {
        diagram.clearDiagramSessionState();
        closeFlow.clearCloseSummary();
        onExit();
      } else {
        diagram.rotateDiagramSession();
        closeFlow.clearCloseSummary();
      }
    },
    [closeFlow, diagram, onExit, saveExistingDocument]
  );

  const validateExistingSave = useCallback(() => {
    if (Object.keys(validateDocMetadata(documentFields, metadata).errors).length > 0) {
      setAttemptedSave(true);
      return false;
    }
    if (saveMutation.isPending || migrateMutation.isPending) return false;
    return true;
  }, [documentFields, metadata, migrateMutation.isPending, saveMutation.isPending]);

  const requestExistingSave = useCallback(
    async (intent: MarkdownSaveIntent) => {
      if (!validateExistingSave()) return;
      if (workflowEnabled) {
        setPendingSaveIntent(intent);
        return;
      }
      await completeExistingSave('minor', intent === 'save-and-close');
    },
    [completeExistingSave, validateExistingSave, workflowEnabled]
  );

  const handleChangeImpactCancel = useCallback(() => {
    setPendingSaveIntent(null);
    setChangeKind('minor');
  }, []);

  const handleChangeImpactConfirm = useCallback(async () => {
    const intent = pendingSaveIntent;
    if (!intent) return;
    setPendingSaveIntent(null);
    const kind = changeKind;
    setChangeKind('minor');
    await completeExistingSave(kind, intent === 'save-and-close');
  }, [changeKind, completeExistingSave, pendingSaveIntent]);

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
  }, [body, documentTypeId, draftFolder, metadata, resolvedTitle, saveNewMutation]);

  const handleSave = useCallback(async () => {
    if (isDraft) {
      if (saveNewMutation.isPending) return;
      const savedFile = await saveDraftDocument();
      if (!savedFile) return;
      setDirty(false);
      onNavigateToSavedDraft(savedFile);
      return;
    }
    if (isReadOnly) return;
    if (!dirty) {
      if (diagram.hasPendingDiagramChanges) {
        diagram.rotateDiagramSession();
        closeFlow.clearCloseSummary();
      }
      return;
    }
    await requestExistingSave('save');
  }, [
    closeFlow,
    diagram,
    dirty,
    isDraft,
    isReadOnly,
    onNavigateToSavedDraft,
    requestExistingSave,
    saveDraftDocument,
    saveNewMutation.isPending
  ]);

  const handleSaveAndClose = useCallback(async () => {
    if (isDraft) {
      if (saveNewMutation.isPending) return;
      const savedFile = await saveDraftDocument();
      if (!savedFile) return;
      setDirty(false);
      diagram.clearDiagramSessionState();
      onNavigateBack();
      return;
    }
    if (isReadOnly) {
      diagram.clearDiagramSessionState();
      closeFlow.clearCloseSummary();
      onExit();
      return;
    }
    if (dirty) {
      await requestExistingSave('save-and-close');
      return;
    }
    diagram.clearDiagramSessionState();
    closeFlow.clearCloseSummary();
    onExit();
  }, [
    closeFlow,
    diagram,
    dirty,
    isDraft,
    isReadOnly,
    onExit,
    onNavigateBack,
    requestExistingSave,
    saveDraftDocument,
    saveNewMutation.isPending
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
      diagramSessionId: diagram.sessionId
    });
  }, [diagram.sessionId, isReadOnly, updateSearch]);

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
    onNavigateBack();
  }, [deleteFile, file, isReadOnly, onNavigateBack]);

  const handleAttachmentDeleteConfirm = useCallback(async () => {
    if (!attachmentDeleteTarget || isReadOnly) return;
    await deleteAttachment(attachmentDeleteTarget.path);
    setAttachmentDeleteTarget(null);
  }, [attachmentDeleteTarget, deleteAttachment, isReadOnly]);

  const handleRunAiAction = useCallback(
    async (action: DocumentAiAction) => {
      setRunningAiActionId(action.id);
      setAiActionError(null);
      setAiActionResult(null);
      setAiActionStreamingText('');
      setAiActionPanelOpen(true);
      try {
        const result = await runDocumentAiAction(workspaceSlug, nodeId, action.id, delta =>
          setAiActionStreamingText(current => current + delta)
        );
        setAiActionResult(result);
      } catch (cause) {
        setAiActionError(cause instanceof Error ? cause.message : 'Failed to run AI action');
      } finally {
        setRunningAiActionId(null);
      }
    },
    [nodeId, workspaceSlug]
  );

  const handleContinueInConversation = useCallback(
    async (result: RunAiActionResponse) => {
      writeAiActionSeed({
        documentTitle: result.documentTitle,
        documentLink: window.location.href,
        actionPrompt: result.prompt,
        answer: result.answer
      });
      const conversation = await createConversationMutation.mutateAsync(undefined);
      setAiActionPanelOpen(false);
      onNavigateToConversation(conversation.id);
    },
    [createConversationMutation, onNavigateToConversation]
  );

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
    [compareMode, historyMode, updateSearch]
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
      await restoreMutation.mutateAsync({ revisionId, change_kind: 'major' });
      setDirty(false);
      diagram.clearDiagramSessionState();
      onExit();
    },
    [diagram, isReadOnly, onExit, restoreMutation]
  );

  const handleOpenAttachment = useCallback(
    (attachment: ProjectFile) => {
      if (attachment.type === 'file') {
        onDownloadAttachment(attachment);
        return;
      }
      onOpenAttachment(attachment);
    },
    [onDownloadAttachment, onOpenAttachment]
  );

  const handleAttachmentInputChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = '';
      for (const fileItem of files) {
        await uploadAttachmentMutation.mutateAsync(fileItem);
      }
    },
    [uploadAttachmentMutation]
  );

  return {
    body,
    documentTypeId,
    metadata,
    generatedMetadata,
    dirty,
    hasUnsavedChanges,
    attemptedSave,
    draftSaveError,
    resolvedTitle,
    toc,
    readTime,
    screenState,
    titleView,
    paneMode,
    commentsMode,
    cycleCommentsMode: () => setCommentsMode(nextCommentsDisplayMode),
    availableDocumentTypes,
    selectedDocumentType,
    documentFields,
    workflowEnabled,
    documentInitiationFields,
    attachments: data?.attachments ?? [],
    workflow: data?.workflow,
    aiActions: !isDraft && aiStatus?.configured ? selectedDocumentType?.aiActions : undefined,
    isUploadingAttachment: uploadAttachmentMutation.isPending,
    isDeletingAttachment: deleteAttachmentMutation.isPending,
    isRestoring: restoreMutation.isPending,
    fileInputRef,
    onChange: handleChange,
    onDocumentTypeChange: handleDocumentTypeChange,
    onMetadataChange: handleMetadataChange,
    onSelectPane: handleSelectPane,
    onSave: handleSave,
    onSaveAndClose: handleSaveAndClose,
    onDraftClose: handleDraftClose,
    onClose: closeFlow.handleClose,
    onEnterEdit: handleEnterEdit,
    onPreview: handlePreview,
    onOpenHistory: handleOpenHistory,
    onSelectRevision: handleSelectRevision,
    onEnterCompare: handleEnterCompare,
    onViewVersion: handleViewVersion,
    onRestore: handleRestore,
    onAttachmentOpen: handleOpenAttachment,
    onAttachmentInputChange: handleAttachmentInputChange,
    onRequestRename: () => setRenameOpen(true),
    onRequestDelete: () => setDeleteOpen(true),
    onRequestAttachmentDelete: (attachment: ProjectFile) => setAttachmentDeleteTarget(attachment),
    onRenameConfirm: handleRenameConfirm,
    onDeleteConfirm: handleDeleteConfirm,
    onAttachmentDeleteConfirm: handleAttachmentDeleteConfirm,
    renameOpen,
    deleteOpen,
    attachmentDeleteTarget,
    cancelRename: () => setRenameOpen(false),
    cancelDelete: () => setDeleteOpen(false),
    cancelAttachmentDelete: () => setAttachmentDeleteTarget(null),
    runningAiActionId,
    aiActionResult,
    aiActionStreamingText,
    aiActionError,
    aiActionPanelOpen,
    onRunAiAction: handleRunAiAction,
    onContinueInConversation: handleContinueInConversation,
    closeAiActionPanel: () => setAiActionPanelOpen(false),
    closeDialogOpen: closeFlow.closeDialogOpen,
    closeSummary: closeFlow.closeSummary,
    cancelClose: closeFlow.handleCancelClose,
    keepDiagramChanges: closeFlow.handleKeepDiagramChanges,
    revertEligibleDiagramChanges: closeFlow.handleRevertEligibleDiagramChanges,
    pendingSaveIntent,
    changeKind,
    initiationFieldValues,
    setChangeKind,
    setInitiationFieldValues,
    cancelChangeImpact: handleChangeImpactCancel,
    confirmChangeImpact: handleChangeImpactConfirm
  };
};

export type MarkdownEditorController = ReturnType<typeof useMarkdownEditorController>;
