import { useCallback, useState } from 'react';
import type { MarkdownContent } from '@arch-register/api-types/projectMarkdownContract';
import {
  useMigrateMarkdownContent,
  useSaveMarkdownContent,
  useSaveNewMarkdownContent
} from '../../hooks/useMarkdownContent';
import type { ContentScope } from '../../hooks/useContentScope';
import { validateDocMetadata } from './MarkdownPropertiesPanel';
import type { useMarkdownEditorDocumentState } from './useMarkdownEditorDocumentState';
import type { useMarkdownEditorTransitions } from './useMarkdownEditorTransitions';
import type { useMarkdownCloseFlow } from './useMarkdownCloseFlow';
import type { MarkdownSaveIntent } from './MarkdownChangeImpactDialog';
import { ApiError } from '../../lib/http';

type MarkdownEditorDocument = ReturnType<typeof useMarkdownEditorDocumentState>;
type MarkdownEditorTransitions = ReturnType<typeof useMarkdownEditorTransitions>;
type MarkdownEditorCloseFlow = Pick<ReturnType<typeof useMarkdownCloseFlow>, 'clearCloseSummary'>;

type MarkdownEditorDiagramSaveState = {
  hasPendingDiagramChanges: boolean;
  rotateDiagramSession: () => void;
};

export type MarkdownEditorSaveWorkflowOptions = {
  context: {
    workspaceSlug: string;
    nodeId: string;
    isDraft: boolean;
    isReadOnly: boolean;
    contentScope: ContentScope;
    draftFolder?: string;
  };
  data: MarkdownContent | undefined;
  document: MarkdownEditorDocument;
  diagram: MarkdownEditorDiagramSaveState;
  close: MarkdownEditorCloseFlow;
  transitions: MarkdownEditorTransitions;
};

export const useMarkdownEditorSaveWorkflow = ({
  context,
  data,
  document,
  diagram,
  close,
  transitions
}: MarkdownEditorSaveWorkflowOptions) => {
  const saveMutation = useSaveMarkdownContent(context.contentScope, context.nodeId);
  const migrateMutation = useMigrateMarkdownContent(context.contentScope, context.nodeId);
  const saveNewMutation = useSaveNewMarkdownContent(context.contentScope);

  const [changeKind, setChangeKind] = useState<'minor' | 'major'>('minor');
  const [pendingSaveIntent, setPendingSaveIntent] = useState<MarkdownSaveIntent | null>(null);
  const [initiationFieldValues, setInitiationFieldValues] = useState<Record<string, unknown>>({});
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);

  const saveExistingDocument = useCallback(
    async (kind: 'minor' | 'major') => {
      const currentDocumentTypeId = data?.document_type_id ?? null;
      const input = {
        body: document.body,
        name: document.headingTitle ?? undefined,
        document_type_id: document.documentTypeId,
        metadata: document.metadata,
        change_kind: kind,
        initiation_fields: initiationFieldValues
      };

      if (document.documentTypeId !== currentDocumentTypeId) {
        await migrateMutation.mutateAsync(input);
      } else {
        await saveMutation.mutateAsync(input);
      }
    },
    [data?.document_type_id, document, initiationFieldValues, migrateMutation, saveMutation]
  );

  const completeExistingSave = useCallback(
    async (kind: 'minor' | 'major', closeAfterSave: boolean) => {
      await saveExistingDocument(kind);
      document.markClean();
      setAttemptedSave(false);

      if (closeAfterSave) {
        close.clearCloseSummary();
        transitions.finalizeExit();
      } else {
        diagram.rotateDiagramSession();
        close.clearCloseSummary();
      }
    },
    [close, diagram, document, saveExistingDocument, transitions]
  );

  const validateExistingSave = useCallback(() => {
    if (
      Object.keys(validateDocMetadata(document.documentFields, document.metadata).errors).length > 0
    ) {
      setAttemptedSave(true);
      return false;
    }
    if (saveMutation.isPending || migrateMutation.isPending) return false;
    return true;
  }, [
    document.documentFields,
    document.metadata,
    migrateMutation.isPending,
    saveMutation.isPending
  ]);

  const requestExistingSave = useCallback(
    async (intent: MarkdownSaveIntent) => {
      if (!validateExistingSave()) return;
      if (document.workflowEnabled) {
        setPendingSaveIntent(intent);
        return;
      }
      await completeExistingSave('minor', intent === 'save-and-close');
    },
    [completeExistingSave, document.workflowEnabled, validateExistingSave]
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
    const title = document.resolvedTitle.trim();
    if (!title) return null;
    setDraftSaveError(null);
    try {
      return await saveNewMutation.mutateAsync({
        name: title,
        folder: context.draftFolder,
        body: document.body,
        document_type_id: document.documentTypeId,
        metadata: document.metadata
      });
    } catch (cause) {
      setDraftSaveError(cause instanceof ApiError ? cause.message : 'Unable to save document');
      return null;
    }
  }, [context.draftFolder, document, saveNewMutation]);

  const handleSave = useCallback(async () => {
    if (context.isDraft) {
      if (saveNewMutation.isPending) return;
      const savedFile = await saveDraftDocument();
      if (!savedFile) return;
      document.markClean();
      transitions.finalizeSavedDraft(savedFile);
      return;
    }
    if (context.isReadOnly) return;
    if (!document.dirty) {
      if (diagram.hasPendingDiagramChanges) {
        diagram.rotateDiagramSession();
        close.clearCloseSummary();
      }
      return;
    }
    await requestExistingSave('save');
  }, [
    close,
    context.isDraft,
    context.isReadOnly,
    diagram,
    document,
    requestExistingSave,
    saveDraftDocument,
    saveNewMutation.isPending,
    transitions
  ]);

  const handleSaveAndClose = useCallback(async () => {
    if (context.isDraft) {
      if (saveNewMutation.isPending) return;
      const savedFile = await saveDraftDocument();
      if (!savedFile) return;
      document.markClean();
      transitions.finalizeBack();
      return;
    }
    if (context.isReadOnly) {
      close.clearCloseSummary();
      transitions.finalizeExit();
      return;
    }
    if (document.dirty) {
      await requestExistingSave('save-and-close');
      return;
    }
    close.clearCloseSummary();
    transitions.finalizeExit();
  }, [
    close,
    context.isDraft,
    context.isReadOnly,
    document.dirty,
    document.markClean,
    requestExistingSave,
    saveDraftDocument,
    saveNewMutation.isPending,
    transitions
  ]);

  return {
    dirty: document.dirty,
    hasUnsavedChanges: document.dirty || diagram.hasPendingDiagramChanges,
    attemptedSave,
    draftSaveError,
    onSave: handleSave,
    onSaveAndClose: handleSaveAndClose,
    onDraftClose: transitions.finalizeBack,
    workflow: {
      pendingSaveIntent,
      changeKind,
      initiationFields: document.documentInitiationFields,
      initiationFieldValues,
      setChangeKind,
      setInitiationFieldValues,
      cancel: handleChangeImpactCancel,
      confirm: handleChangeImpactConfirm
    }
  };
};
