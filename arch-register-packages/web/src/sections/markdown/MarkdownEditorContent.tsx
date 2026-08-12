import type { ReactNode } from 'react';
import { MarkdownEditorHeader } from './MarkdownEditorHeader';
import { MarkdownEditorToolbar } from './MarkdownEditorToolbar';
import { MarkdownEditorPane } from './MarkdownEditorPane';
import { MarkdownHistoryPanel } from './MarkdownHistoryPanel';
import { MarkdownPropertiesPanel } from './MarkdownPropertiesPanel';
import { AiActionResultPanel } from './AiActionResultPanel';
import type { MarkdownEditorController } from './useMarkdownEditorController';
import styles from './MarkdownEditorScreen.module.css';
import type { CommentsDisplayMode } from '../wikiComments/commentsDisplayMode';
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
  commentsMode: CommentsDisplayMode;
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
  commentsMode,
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
    screenState,
    titleView,
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
    hasUnsavedChanges,
    attachments,
    fileInputRef,
    onAttachmentInputChange,
    onSelectPane,
    onSave,
    onSaveAndClose,
    onDraftClose,
    onClose,
    onEnterEdit,
    onOpenHistory,
    onRequestRename,
    onRequestDelete,
    onChange,
    onAttachmentOpen,
    onRequestAttachmentDelete,
    onDocumentTypeChange,
    onMetadataChange,
    aiActions,
    runningAiActionId,
    onRunAiAction,
    isUploadingAttachment,
    isDeletingAttachment,
    draftSaveError,
    aiActionPanelOpen,
    aiActionResult,
    aiActionStreamingText,
    aiActionError,
    closeAiActionPanel,
    onContinueInConversation,
    isRestoring,
    onSelectRevision,
    onViewVersion,
    onEnterCompare,
    onRestore,
    attemptedSave
  } = controller;

  return (
    <div className={styles.screen}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className={styles.hiddenInput}
        onChange={onAttachmentInputChange}
      />

      <MarkdownEditorHeader
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        entityId={entityId}
        parentLabel={parentLabel}
        resolvedTitle={controller.resolvedTitle}
        description={
          isDraft ? (selectedDocumentType?.name ?? 'New markdown document') : titleView.description
        }
        isViewMode={titleView.isViewMode && !isReadOnly}
        isDraft={isDraft}
        attachDisabled={titleView.attachDisabled || isReadOnly}
        isUploadingAttachment={isUploadingAttachment}
        onNavigateBack={onNavigateBack}
        actions={{
          onAttachClick: () => {
            if (!isReadOnly) fileInputRef.current?.click();
          },
          onEnterEdit,
          onOpenHistory,
          onRenameRequest: onRequestRename,
          onDeleteRequest: onRequestDelete
        }}
        commentsToggle={
          hasWikiComments
            ? {
                mode: commentsMode,
                openCount: openWikiCommentsCount,
                onCycle: controller.cycleCommentsMode
              }
            : null
        }
      />

      {(isDraft || (!isReadOnly && screenState.screenMode === 'edit')) && (
        <MarkdownEditorToolbar
          paneMode={screenState.paneMode}
          hasUnsavedChanges={hasUnsavedChanges}
          onSelectPane={onSelectPane}
          onSave={onSave}
          onSaveAndClose={onSaveAndClose}
          onClose={isDraft ? onDraftClose : onClose}
        />
      )}

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
          isRestoring={isRestoring}
          onSelectRevision={onSelectRevision}
          onViewVersion={onViewVersion}
          onEnterCompare={onEnterCompare}
          onRestore={onRestore}
          onClose={controller.onPreview}
        />
      ) : (
        <MarkdownEditorPane
          screenMode={isReadOnly ? 'preview' : screenState.screenMode}
          paneMode={isReadOnly ? 'preview' : screenState.paneMode}
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
          commentsMode={commentsMode}
          aiActions={aiActions}
          runningAiActionId={runningAiActionId}
          onRunAiAction={onRunAiAction}
          attachments={{
            items: attachments,
            onOpen: onAttachmentOpen,
            onDeleteRequest: onRequestAttachmentDelete,
            isDeleting: isDeletingAttachment
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
              readOnly={isReadOnly || screenState.screenMode !== 'edit'}
              attemptedSave={attemptedSave}
              onTypeChange={onDocumentTypeChange}
              onValueChange={onMetadataChange}
            />
          }
        />
      )}

      {draftSaveError && (
        <div role="alert" className={styles.loading}>
          {draftSaveError}
        </div>
      )}

      <AiActionResultPanel
        open={aiActionPanelOpen}
        result={aiActionResult}
        streamingText={aiActionStreamingText}
        loading={runningAiActionId !== null}
        errorMessage={aiActionError}
        onClose={closeAiActionPanel}
        onContinueInConversation={result => void onContinueInConversation(result)}
      />

      {dialogs}
    </div>
  );
};
