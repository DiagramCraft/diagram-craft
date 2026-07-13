import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { newid } from '@diagram-craft/utils/id';
import { orpcClient } from '../../lib/orpcClient';
import { projectFileKeys } from '../../queries/content';
import {
  clearMarkdownDiagramSession,
  getMarkdownDiagramRollbackRecords,
  type DiagramSessionRecord
} from './markdownDiagramSession';

export const useMarkdownDiagramSessionTracking = (params: {
  workspaceSlug: string;
  projectId?: string;
  entityId?: string;
  initialSessionId: string;
  onSessionIdChange: (sessionId: string) => void;
}) => {
  const { workspaceSlug, projectId, entityId, initialSessionId, onSessionIdChange } = params;
  const queryClient = useQueryClient();
  const sessionIdRef = useRef(initialSessionId);
  const createdDiagramsRef = useRef<DiagramSessionRecord[]>([]);

  const trackCreatedDiagram = useCallback((record: DiagramSessionRecord) => {
    createdDiagramsRef.current.push(record);
  }, []);

  const hasPendingDiagramChanges =
    createdDiagramsRef.current.length > 0 ||
    getMarkdownDiagramRollbackRecords(sessionIdRef.current).some(
      record => !!record.lastSavedContentHash
    );

  const clearDiagramSessionState = useCallback(() => {
    clearMarkdownDiagramSession(sessionIdRef.current);
    createdDiagramsRef.current = [];
  }, []);

  const rotateDiagramSession = useCallback(() => {
    clearMarkdownDiagramSession(sessionIdRef.current);
    createdDiagramsRef.current = [];
    sessionIdRef.current = newid();
    onSessionIdChange(sessionIdRef.current);
  }, [onSessionIdChange]);

  const resetForNewDocument = useCallback(() => {
    clearMarkdownDiagramSession(sessionIdRef.current);
    sessionIdRef.current = newid();
    createdDiagramsRef.current = [];
  }, []);

  const loadDiagramContentByPath = useCallback(
    async (path: string) => {
      if (!projectId && !entityId) {
        return await orpcClient.projects.getWorkspaceFileContent({
          params: { workspace: workspaceSlug },
          query: { path }
        });
      }

      return await orpcClient.projects.getFileContent({
        params: { workspace: workspaceSlug, id: projectId ?? entityId ?? '' },
        query: { path }
      });
    },
    [entityId, projectId, workspaceSlug]
  );

  const saveDiagramContentByPath = useCallback(
    async (path: string, content: Record<string, unknown>) => {
      if (!projectId && !entityId) {
        await orpcClient.projects.saveWorkspaceFile({
          params: { workspace: workspaceSlug },
          query: { path },
          body: content
        });
        return;
      }

      await orpcClient.projects.saveFile({
        params: { workspace: workspaceSlug, id: projectId ?? entityId ?? '' },
        query: { path },
        body: content
      });
    },
    [entityId, projectId, workspaceSlug]
  );

  const refreshDiagramPreviewCaches = useCallback(
    async (diagramIds: string[]) => {
      await Promise.all(
        diagramIds.flatMap(diagramId => [
          queryClient.invalidateQueries({ queryKey: projectFileKeys.detail(workspaceSlug, diagramId) }),
          queryClient.invalidateQueries({ queryKey: projectFileKeys.content(workspaceSlug, diagramId) })
        ])
      );
    },
    [queryClient, workspaceSlug]
  );

  return {
    sessionId: sessionIdRef.current,
    createdDiagramsRef,
    trackCreatedDiagram,
    hasPendingDiagramChanges,
    clearDiagramSessionState,
    rotateDiagramSession,
    resetForNewDocument,
    loadDiagramContentByPath,
    saveDiagramContentByPath,
    refreshDiagramPreviewCaches
  };
};
