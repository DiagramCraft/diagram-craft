import type { ReactNode } from 'react';
import { MarkdownEditorHeader } from './MarkdownEditorHeader';
import { MarkdownEditorToolbar } from './MarkdownEditorToolbar';
import { MarkdownEditorPane } from './MarkdownEditorPane';
import { MarkdownHistoryPanel } from './MarkdownHistoryPanel';
import { MarkdownPropertiesPanel } from './MarkdownPropertiesPanel';
import { AiActionResultPanel } from './AiActionResultPanel';
import type { MarkdownEditorController } from './useMarkdownEditorController';
import styles from './MarkdownEditorScreen.module.css';
import type { MarkdownRevisionSummary } from '@arch-register/api-types/projectMarkdownContract';

export type MarkdownEditorContentProps = {
  workspaceSlug: string;
  projectId?: string;
  entityId?: string;
  nodeId: string;
  commentId?: string;
  parentLabel: string;
  isDraft: boolean;
  isReadOnly: boolean;
  controller: MarkdownEditorController;
  hasWikiComments: boolean;
  openWikiCommentsCount: number;
  onNavigateBack: () => void;
  revisions: MarkdownRevisionSummary[];
  revisionsLoading: boolean;
  selectedRevisionId: string | undefined;
  historyMode: 'preview' | 'compare';
  compareMode: 'to-current' | 'changes-in-version';
  updatedLabel: string | null;
  dialogs: ReactNode;
};

export const MarkdownEditorContent = ({
  workspaceSlug,
  projectId,
  entityId,
  nodeId,
  commentId,
  parentLabel,
  isDraft,
  isReadOnly,
  controller,
  hasWikiComments,
  openWikiCommentsCount,
  onNavigateBack,
  revisions,
  revisionsLoading,
  selectedRevisionId,
  historyMode,
  compareMode,
  updatedLabel,
  dialogs
}: MarkdownEditorContentProps) => {
  const {
    document: documentState,
    screen,
    save,
    close,
    attachments: attachmentState,
    file: fileActions,
    ai,
    history
  } = controller;

  const {
    selectedDocumentType,
    availableDocumentTypes,
    documentFields,
    workflow,
    body,
    metadata,
    generatedMetadata,
    documentTypeId,
    toc,
    readTime,
    onChange,
    onDocumentTypeChange,
    onMetadataChange
  } = documentState;

  return (
    <div className={styles.screen}>
      <input
        ref={attachmentState.fileInputRef}
        type="file"
        multiple
        className={styles.hiddenInput}
        onChange={attachmentState.onInputChange}
      />

      <MarkdownEditorHeader
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        entityId={entityId}
        parentLabel={parentLabel}
        resolvedTitle={documentState.resolvedTitle}
        description={
          isDraft
            ? (selectedDocumentType?.name ?? 'New markdown document')
            : screen.titleView.description
        }
        isViewMode={screen.titleView.isViewMode && !isReadOnly}
        isDraft={isDraft}
        attachDisabled={screen.titleView.attachDisabled || isReadOnly}
        isUploadingAttachment={attachmentState.isUploading}
        onNavigateBack={onNavigateBack}
        actions={{
          onAttachClick: () => {
            if (!isReadOnly) attachmentState.fileInputRef.current?.click();
          },
          onEnterEdit: screen.onEnterEdit,
          onOpenHistory: history.onOpenHistory,
          onRenameRequest: fileActions.onRequestRename,
          onDeleteRequest: fileActions.onRequestDelete
        }}
        commentsToggle={
          hasWikiComments
            ? {
                mode: screen.commentsMode,
                openCount: openWikiCommentsCount,
                onCycle: screen.cycleCommentsMode
              }
            : null
        }
      />

      {(isDraft || (!isReadOnly && screen.screenState.screenMode === 'edit')) && (
        <MarkdownEditorToolbar
          paneMode={screen.screenState.paneMode}
          hasUnsavedChanges={save.hasUnsavedChanges}
          onSelectPane={screen.onSelectPane}
          onSave={save.onSave}
          onSaveAndClose={save.onSaveAndClose}
          onClose={isDraft ? close.onDraftClose : close.onClose}
        />
      )}

      {!isDraft && screen.screenState.viewPanel === 'history' ? (
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
          isRestoring={history.isRestoring}
          onSelectRevision={history.onSelectRevision}
          onViewVersion={history.onViewVersion}
          onEnterCompare={history.onEnterCompare}
          onRestore={history.onRestore}
          onClose={screen.onPreview}
        />
      ) : (
        <MarkdownEditorPane
          screenMode={isReadOnly ? 'preview' : screen.screenState.screenMode}
          paneMode={isReadOnly ? 'preview' : screen.screenState.paneMode}
          body={body}
          onChange={isReadOnly ? () => undefined : onChange}
          toc={toc}
          updatedLabel={updatedLabel}
          readTime={readTime}
          workspaceId={workspaceSlug}
          nodeId={nodeId}
          initialCommentId={commentId}
          showDiscussion={!isDraft}
          showBacklinks={!isDraft}
          commentsMode={screen.commentsMode}
          aiActions={ai.aiActions}
          runningAiActionId={ai.runningAiActionId}
          onRunAiAction={ai.onRunAiAction}
          attachments={{
            items: attachmentState.items,
            onOpen: attachmentState.onOpen,
            onDeleteRequest: attachmentState.onRequestDelete,
            isDeleting: attachmentState.isDeleting
          }}
          propertiesPanel={
            <MarkdownPropertiesPanel
              key={nodeId}
              documentTypeId={documentTypeId}
              documentTypes={availableDocumentTypes}
              fields={documentFields}
              metadata={metadata}
              generatedMetadata={generatedMetadata}
              workflow={workflow}
              readOnly={isReadOnly || screen.screenState.screenMode !== 'edit'}
              attemptedSave={save.attemptedSave}
              onTypeChange={onDocumentTypeChange}
              onValueChange={onMetadataChange}
            />
          }
        />
      )}

      {save.draftSaveError && (
        <div role="alert" className={styles.loading}>
          {save.draftSaveError}
        </div>
      )}

      <AiActionResultPanel
        open={ai.aiActionPanelOpen}
        result={ai.aiActionResult}
        streamingText={ai.aiActionStreamingText}
        loading={ai.runningAiActionId !== null}
        errorMessage={ai.aiActionError}
        onClose={ai.closeAiActionPanel}
        onContinueInConversation={result => void ai.onContinueInConversation(result)}
      />

      {dialogs}
    </div>
  );
};
