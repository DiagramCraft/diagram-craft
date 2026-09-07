import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectFile } from '@arch-register/api-types/projectContentContract';

export type MarkdownEditorFileActionsOptions = {
  file: ProjectFile | undefined;
  isReadOnly: boolean;
  transitionKey: string;
  renameFile: (newName: string) => Promise<void>;
  deleteFile: () => Promise<void>;
  onNavigateBack: () => void;
};

export const useMarkdownEditorFileActions = ({
  file,
  isReadOnly,
  transitionKey,
  renameFile,
  deleteFile,
  onNavigateBack
}: MarkdownEditorFileActionsOptions) => {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteInFlightRef = useRef(false);
  const deleteCompletedRef = useRef(false);
  const previousTransitionKeyRef = useRef(transitionKey);

  useEffect(() => {
    if (previousTransitionKeyRef.current === transitionKey) return;
    previousTransitionKeyRef.current = transitionKey;
    deleteInFlightRef.current = false;
    deleteCompletedRef.current = false;
  }, [transitionKey]);

  const onRenameConfirm = useCallback(
    async (newName: string) => {
      if (!file || isReadOnly) return;
      await renameFile(newName);
      setRenameOpen(false);
    },
    [file, isReadOnly, renameFile]
  );

  const onDeleteConfirm = useCallback(async () => {
    if (!file || isReadOnly || deleteInFlightRef.current || deleteCompletedRef.current) return;
    deleteInFlightRef.current = true;
    try {
      await deleteFile();
      deleteCompletedRef.current = true;
      setDeleteOpen(false);
      onNavigateBack();
    } finally {
      deleteInFlightRef.current = false;
    }
  }, [deleteFile, file, isReadOnly, onNavigateBack]);

  const onRequestRename = useCallback(() => setRenameOpen(true), []);
  const onRequestDelete = useCallback(() => setDeleteOpen(true), []);
  const cancelRename = useCallback(() => setRenameOpen(false), []);
  const cancelDelete = useCallback(() => setDeleteOpen(false), []);

  return {
    renameOpen,
    deleteOpen,
    onRequestRename,
    onRequestDelete,
    onRenameConfirm,
    onDeleteConfirm,
    cancelRename,
    cancelDelete
  };
};
