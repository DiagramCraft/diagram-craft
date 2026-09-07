import { useCallback, useState } from 'react';
import type { DocumentAiAction, DocumentType } from '@arch-register/api-types/documentContract';
import type { RunAiActionResponse } from '@arch-register/api-types/projectDocumentAiContract';
import { useCreateConversation } from '../../hooks/useAiConversations';
import { useAiStatus } from '../../hooks/useAiConfig';
import { runDocumentAiAction } from '../../hooks/useDocumentAiActions';
import { writeAiActionSeed } from '../../lib/aiActionSeed';

export type MarkdownEditorAiOptions = {
  workspaceSlug: string;
  nodeId: string;
  isDraft: boolean;
  selectedDocumentType: DocumentType | null;
  onNavigateToConversation: (conversationId: string) => void;
};

export const useMarkdownEditorAi = ({
  workspaceSlug,
  nodeId,
  isDraft,
  selectedDocumentType,
  onNavigateToConversation
}: MarkdownEditorAiOptions) => {
  const createConversationMutation = useCreateConversation(workspaceSlug);
  const { data: aiStatus } = useAiStatus(workspaceSlug, !isDraft);
  const [runningAiActionId, setRunningAiActionId] = useState<string | null>(null);
  const [aiActionResult, setAiActionResult] = useState<RunAiActionResponse | null>(null);
  const [aiActionStreamingText, setAiActionStreamingText] = useState('');
  const [aiActionError, setAiActionError] = useState<string | null>(null);
  const [aiActionPanelOpen, setAiActionPanelOpen] = useState(false);

  const onRunAiAction = useCallback(
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

  const onContinueInConversation = useCallback(
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

  const closeAiActionPanel = useCallback(() => setAiActionPanelOpen(false), []);

  return {
    aiActions: !isDraft && aiStatus?.configured ? selectedDocumentType?.aiActions : undefined,
    runningAiActionId,
    aiActionResult,
    aiActionStreamingText,
    aiActionError,
    aiActionPanelOpen,
    onRunAiAction,
    onContinueInConversation,
    closeAiActionPanel
  };
};
