import { useCallback, useEffect, useRef } from 'react';
import type { ProjectFile } from '@arch-register/api-types/projectContentContract';

export type MarkdownEditorTransitionsOptions = {
  transitionKey: string;
  clearDiagramSessionState: () => void;
  onExit: () => void;
  onNavigateBack: () => void;
  onNavigateToSavedDraft: (file: ProjectFile) => void;
};

export const useMarkdownEditorTransitions = ({
  transitionKey,
  clearDiagramSessionState,
  onExit,
  onNavigateBack,
  onNavigateToSavedDraft
}: MarkdownEditorTransitionsOptions) => {
  const transitionInFlightRef = useRef(false);
  const previousTransitionKeyRef = useRef(transitionKey);

  useEffect(() => {
    if (previousTransitionKeyRef.current === transitionKey) return;
    previousTransitionKeyRef.current = transitionKey;
    transitionInFlightRef.current = false;
  }, [transitionKey]);

  const runTransition = useCallback(
    (navigate: () => void, cleanup = true) => {
      if (transitionInFlightRef.current) return false;
      transitionInFlightRef.current = true;

      try {
        if (cleanup) clearDiagramSessionState();
        navigate();
        return true;
      } catch (cause) {
        transitionInFlightRef.current = false;
        throw cause;
      }
    },
    [clearDiagramSessionState]
  );

  const finalizeExit = useCallback(() => runTransition(onExit), [onExit, runTransition]);
  const finalizeBack = useCallback(
    () => runTransition(onNavigateBack),
    [onNavigateBack, runTransition]
  );
  const finalizeSavedDraft = useCallback(
    (file: ProjectFile) => runTransition(() => onNavigateToSavedDraft(file), false),
    [onNavigateToSavedDraft, runTransition]
  );

  return { finalizeExit, finalizeBack, finalizeSavedDraft };
};
