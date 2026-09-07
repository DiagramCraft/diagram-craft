import { useEffect, useRef, type MutableRefObject } from 'react';
import type { DocumentTemplate, DocumentType } from '@arch-register/api-types/documentContract';
import type { GovernanceWorkflowConfigRow } from '@arch-register/api-types/governanceWorkflowConfigContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type {
  MarkdownContent,
  MarkdownRevisionSummary
} from '@arch-register/api-types/projectMarkdownContract';
import type { ProjectFile } from '@arch-register/api-types/projectContentContract';
import type { ContentScope } from '../../hooks/useContentScope';
import type { MarkdownSearchParams } from '../../routes/searchParams';
import type { DiagramSessionRecord } from './markdownDiagramSession';
import { useMarkdownCloseFlow } from './useMarkdownCloseFlow';
import { useMarkdownEditorAi } from './useMarkdownEditorAi';
import { useMarkdownEditorAttachments } from './useMarkdownEditorAttachments';
import { useMarkdownEditorDocumentState } from './useMarkdownEditorDocumentState';
import { useMarkdownEditorFileActions } from './useMarkdownEditorFileActions';
import { useMarkdownEditorHistory } from './useMarkdownEditorHistory';
import { useMarkdownEditorSaveWorkflow } from './useMarkdownEditorSaveWorkflow';
import {
  useMarkdownEditorScreenNavigation,
  type MarkdownEditorSearchUpdate
} from './useMarkdownEditorScreenNavigation';
import { useMarkdownEditorTransitions } from './useMarkdownEditorTransitions';

export type { MarkdownEditorSearchUpdate } from './useMarkdownEditorScreenNavigation';

export type MarkdownEditorDiagramLifecycle = {
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
  context: {
    workspaceSlug: string;
    nodeId: string;
    isDraft: boolean;
    isReadOnly: boolean;
    data: MarkdownContent | undefined;
    file: ProjectFile | undefined;
    documentTitle: string;
    contentScope: ContentScope;
  };
  draft: {
    name: string;
    folder?: string;
    type: string | null;
    template: string | null;
    templates: DocumentTemplate[];
    templatesLoading: boolean;
  };
  config: {
    documentTypes: DocumentType[];
    documentTypesLoading: boolean;
    governanceWorkflowConfig: { configs: GovernanceWorkflowConfigRow[] } | undefined;
    workspaceEnums: WorkspaceEnum[];
  };
  navigation: {
    requestedMode: MarkdownSearchParams['mode'];
    requestedPanel: MarkdownSearchParams['panel'];
    diagramSessionId: string | undefined;
    historyMode: 'preview' | 'compare';
    compareMode: 'to-current' | 'changes-in-version';
    selectedRevisionId: string | undefined;
    revisions: MarkdownRevisionSummary[];
    revisionsLoading: boolean;
    updatedLabel: string | null;
    updateSearch: MarkdownEditorSearchUpdate;
    onNavigateBack: () => void;
    onNavigateToSavedDraft: (file: ProjectFile) => void;
    onExit: () => void;
    onNavigateToConversation: (conversationId: string) => void;
  };
  attachments: {
    onOpenAttachment: (attachment: ProjectFile) => void;
    onDownloadAttachment: (attachment: ProjectFile) => void;
  };
  file: {
    renameFile: (newName: string) => Promise<void>;
    deleteFile: () => Promise<void>;
  };
  diagram: MarkdownEditorDiagramLifecycle;
};

export const useMarkdownEditorController = ({
  context,
  draft,
  config,
  navigation,
  attachments: attachmentActions,
  file: fileActions,
  diagram
}: MarkdownEditorControllerOptions) => {
  const transitionKey = [
    context.nodeId,
    navigation.requestedMode ?? '',
    navigation.requestedPanel ?? '',
    navigation.selectedRevisionId ?? ''
  ].join('|');

  const document = useMarkdownEditorDocumentState({
    nodeId: context.nodeId,
    isDraft: context.isDraft,
    data: context.data,
    documentTitle: context.documentTitle,
    draft,
    documentTypes: config.documentTypes,
    documentTypesLoading: config.documentTypesLoading,
    governanceWorkflowConfig: config.governanceWorkflowConfig,
    workspaceEnums: config.workspaceEnums
  });

  const transitions = useMarkdownEditorTransitions({
    transitionKey,
    clearDiagramSessionState: diagram.clearDiagramSessionState,
    onExit: navigation.onExit,
    onNavigateBack: navigation.onNavigateBack,
    onNavigateToSavedDraft: navigation.onNavigateToSavedDraft
  });

  const editorAttachments = useMarkdownEditorAttachments({
    contentScope: context.contentScope,
    nodeId: context.nodeId,
    isReadOnly: context.isReadOnly,
    data: context.data,
    onOpenAttachment: attachmentActions.onOpenAttachment,
    onDownloadAttachment: attachmentActions.onDownloadAttachment
  });

  const closeFlow = useMarkdownCloseFlow({
    dirty: document.dirty,
    hasPendingDiagramChanges: diagram.hasPendingDiagramChanges,
    savedBody: context.data?.body ?? '',
    sessionId: diagram.sessionId,
    createdDiagramsRef: diagram.createdDiagramsRef,
    loadDiagramContentByPath: diagram.loadDiagramContentByPath,
    saveDiagramContentByPath: diagram.saveDiagramContentByPath,
    refreshDiagramPreviewCaches: diagram.refreshDiagramPreviewCaches,
    deleteAttachment: editorAttachments.deleteAttachment,
    transitionKey,
    onFinalize: () => {
      document.resetToSaved();
      return transitions.finalizeExit();
    }
  });

  const save = useMarkdownEditorSaveWorkflow({
    context: {
      workspaceSlug: context.workspaceSlug,
      nodeId: context.nodeId,
      isDraft: context.isDraft,
      isReadOnly: context.isReadOnly,
      contentScope: context.contentScope,
      draftFolder: draft.folder
    },
    data: context.data,
    document,
    diagram: {
      hasPendingDiagramChanges: diagram.hasPendingDiagramChanges,
      rotateDiagramSession: diagram.rotateDiagramSession
    },
    close: closeFlow,
    transitions
  });

  const history = useMarkdownEditorHistory({
    nodeId: context.nodeId,
    isDraft: context.isDraft,
    isReadOnly: context.isReadOnly,
    contentScope: context.contentScope,
    requestedPanel: navigation.requestedPanel,
    historyMode: navigation.historyMode,
    compareMode: navigation.compareMode,
    selectedRevisionId: navigation.selectedRevisionId,
    revisions: navigation.revisions,
    revisionsLoading: navigation.revisionsLoading,
    updateSearch: navigation.updateSearch,
    document: { markClean: document.markClean },
    transitions
  });

  const screen = useMarkdownEditorScreenNavigation({
    isDraft: context.isDraft,
    isReadOnly: context.isReadOnly,
    requestedMode: navigation.requestedMode,
    requestedPanel: navigation.requestedPanel,
    diagramSessionId: navigation.diagramSessionId,
    currentDiagramSessionId: diagram.sessionId,
    revisionsCount: navigation.revisions.length,
    updatedLabel: navigation.updatedLabel,
    readTime: document.readTime,
    updateSearch: navigation.updateSearch
  });

  const ai = useMarkdownEditorAi({
    workspaceSlug: context.workspaceSlug,
    nodeId: context.nodeId,
    isDraft: context.isDraft,
    selectedDocumentType: document.selectedDocumentType,
    onNavigateToConversation: navigation.onNavigateToConversation
  });

  const file = useMarkdownEditorFileActions({
    file: context.file,
    isReadOnly: context.isReadOnly,
    transitionKey,
    renameFile: fileActions.renameFile,
    deleteFile: fileActions.deleteFile,
    onNavigateBack: transitions.finalizeBack
  });

  const previousNodeIdRef = useRef(context.nodeId);
  useEffect(() => {
    if (previousNodeIdRef.current === context.nodeId) return;
    previousNodeIdRef.current = context.nodeId;
    diagram.resetForNewDocument();
    closeFlow.handleCancelClose();
    closeFlow.clearCloseSummary();
  }, [
    closeFlow.clearCloseSummary,
    closeFlow.handleCancelClose,
    context.nodeId,
    diagram.resetForNewDocument
  ]);

  return {
    document,
    screen,
    save,
    close: {
      closeDialogOpen: closeFlow.closeDialogOpen,
      closeSummary: closeFlow.closeSummary,
      onClose: closeFlow.handleClose,
      onDraftClose: save.onDraftClose,
      cancelClose: closeFlow.handleCancelClose,
      keepDiagramChanges: closeFlow.handleKeepDiagramChanges,
      revertEligibleDiagramChanges: closeFlow.handleRevertEligibleDiagramChanges
    },
    attachments: editorAttachments,
    file,
    history,
    ai
  };
};

export type MarkdownEditorController = ReturnType<typeof useMarkdownEditorController>;
