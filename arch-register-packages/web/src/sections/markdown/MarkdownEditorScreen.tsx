import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useParams, useSearch, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  TbDeviceFloppy,
  TbDots,
  TbFileText,
  TbHistory,
  TbPencil,
  TbTrash,
  TbUpload,
  TbX
} from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import {
  useMarkdownContent,
  useMarkdownRevisions,
  useRestoreMarkdownRevision,
  useSaveMarkdownContent,
  useWorkspaceContentNodes,
  useDeleteWorkspaceFile,
  useRenameWorkspaceFile,
  useDeleteProjectFile,
  useRenameProjectFile,
  useDeleteEntityFile,
  useRenameEntityFile,
  useUploadMarkdownAttachment,
  useDeleteMarkdownAttachment
} from '../../hooks/useProjectFiles';
import { useProject, useEntityContentNodes } from '../../hooks/useProjects';
import { useEntity } from '../../hooks/useEntities';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { Title } from '../../components/Title';
import { RenameDialog } from '../../components/RenameDialog';
import { DropdownMenu } from '../../components/DropdownMenu';
import type { FileTree, ProjectFile } from '@arch-register/api-types/projectContract';
import { getFileNodeIcon } from '../../lib/contentNode';
import { newid } from '@diagram-craft/utils/id';
import { orpcClient } from '../../lib/orpcClient';
import styles from './MarkdownEditorScreen.module.css';
import { PlateMarkdownEditor } from './editor/PlateMarkdownEditor';
import { extractFirstHeadingTitle } from './preview/markdownTitle';
import { MdxPreview } from './preview/MdxPreview';
import { MarkdownHistoryPanel } from './MarkdownHistoryPanel';
import {
  projectDetailRoute,
  entityDetailRoute,
  asProjectPublicId,
  asEntityPublicId,
  projectDiagramRoute,
  entityDiagramRoute,
  projectMarkdownRoute,
  entityMarkdownRoute
} from '../../routes/publicObjectRoutes';
import {
  enterMarkdownEditMode,
  exitMarkdownEditMode,
  getInitialMarkdownEditorScreenState,
  openMarkdownHistory,
  selectMarkdownEditPane,
  syncMarkdownEditorScreenState,
  type MarkdownScreenMode,
  type MarkdownViewPanel
} from './MarkdownEditorScreen.state';
import { MarkdownDiagramSessionContext } from './MarkdownDiagramSessionContext';
import { MarkdownCloseDialog } from './MarkdownCloseDialog';
import {
  buildMarkdownCloseImpactSummary,
  clearMarkdownDiagramSession,
  getMarkdownDiagramRollbackRecords,
  hashDiagramContent,
  type DiagramSessionRecord,
  type MarkdownCloseImpactSummary
} from './markdownDiagramSession';
import { projectFileKeys } from '../../hooks/queryKeys';

const findFileById = (tree: FileTree | undefined, nodeId: string): ProjectFile | undefined => {
  if (!tree) return undefined;
  return [...tree.rootFiles, ...tree.folders.flatMap(folder => folder.files)].find(
    file => file.id === nodeId
  );
};

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
  const params = useParams({ strict: false }) as {
    workspaceSlug: string;
    nodeId: string;
    projectId?: string;
    entityId?: string;
  };
  const search = useSearch({ strict: false }) as {
    mode?: MarkdownScreenMode;
    panel?: MarkdownViewPanel;
    revisionId?: string;
    historyMode?: 'preview' | 'compare';
    compareMode?: 'to-current' | 'changes-in-version';
    diagramSessionId?: string;
  };
  const { workspaceSlug, nodeId, projectId, entityId } = params;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { workspace } = useWorkspaceContext();
  const requestedMode = search.mode;
  const requestedPanel = search.panel;
  const historyMode = search.historyMode === 'compare' ? 'compare' : 'preview';
  const compareMode = search.compareMode ?? 'to-current';

  const { data, isLoading, isError } = useMarkdownContent(workspaceSlug, nodeId);
  const { data: revisions = [], isLoading: revisionsLoading } = useMarkdownRevisions(
    workspaceSlug,
    nodeId
  );
  const saveMutation = useSaveMarkdownContent(workspaceSlug, nodeId, { projectId, entityId });
  const restoreMutation = useRestoreMarkdownRevision(workspaceSlug, nodeId, {
    projectId,
    entityId
  });
  const uploadAttachmentMutation = useUploadMarkdownAttachment(workspaceSlug, nodeId, {
    projectId,
    entityId
  });
  const deleteAttachmentMutation = useDeleteMarkdownAttachment(workspaceSlug, nodeId, {
    projectId,
    entityId
  });
  const deleteWorkspaceFile = useDeleteWorkspaceFile(workspaceSlug);
  const renameWorkspaceFile = useRenameWorkspaceFile(workspaceSlug);
  const deleteProjectFile = useDeleteProjectFile(workspaceSlug, projectId ?? '');
  const renameProjectFile = useRenameProjectFile(workspaceSlug, projectId ?? '');
  const deleteEntityFile = useDeleteEntityFile(workspaceSlug, entityId ?? '');
  const renameEntityFile = useRenameEntityFile(workspaceSlug, entityId ?? '');
  const { data: project } = useProject(workspaceSlug, projectId ?? '', { enabled: !!projectId });
  const { data: entity } = useEntity(workspaceSlug, entityId ?? '');
  const { data: entityFiles } = useEntityContentNodes(workspaceSlug, entityId ?? '', {
    enabled: !!entityId
  });
  const { data: workspaceFiles } = useWorkspaceContentNodes(workspaceSlug, {
    enabled: !projectId && !entityId
  });

  const [body, setBody] = useState('');
  const [screenState, setScreenState] = useState(() =>
    getInitialMarkdownEditorScreenState(requestedMode, requestedPanel)
  );
  const [dirty, setDirty] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [attachmentDeleteTarget, setAttachmentDeleteTarget] = useState<ProjectFile | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeSummary, setCloseSummary] = useState<MarkdownCloseImpactSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);
  const previousNodeIdRef = useRef(nodeId);
  const createdDiagramsRef = useRef<DiagramSessionRecord[]>([]);
  const sessionIdRef = useRef(search.diagramSessionId ?? newid());

  const trackCreatedDiagram = useCallback((record: { id: string; path: string; name?: string }) => {
    createdDiagramsRef.current.push(record);
  }, []);

  const selectedRevisionId = search.revisionId;

  const file = useMemo(() => {
    return projectId
      ? findFileById(project?.files, nodeId)
      : entityId
        ? findFileById(entityFiles, nodeId)
        : findFileById(workspaceFiles, nodeId);
  }, [entityFiles, entityId, nodeId, project?.files, projectId, workspaceFiles]);

  const documentTitle = file?.name ?? 'Markdown document';
  const attachments = data?.attachments ?? [];
  const headingTitle = useMemo(() => extractFirstHeadingTitle(body), [body]);
  const resolvedTitle = headingTitle ?? documentTitle;
  const toc = useMemo(() => extractToc(body), [body]);
  const readTime = useMemo(() => calcReadTime(body), [body]);
  const updatedLabel = file?.updated_at ? relativeDate(file.updated_at) : null;
  const hasPendingDiagramChanges =
    createdDiagramsRef.current.length > 0 ||
    getMarkdownDiagramRollbackRecords(sessionIdRef.current).some(record => !!record.lastSavedContentHash);
  const hasUnsavedChanges = dirty || hasPendingDiagramChanges;

  // navigate's function-update form for search means updateSearch only needs navigate as dep
  const updateSearch = useCallback(
    (
      next: Partial<{
        mode: MarkdownScreenMode | undefined;
        panel: MarkdownViewPanel | undefined;
        revisionId: string | undefined;
        historyMode: 'preview' | 'compare' | undefined;
        compareMode: 'to-current' | 'changes-in-version' | undefined;
        diagramSessionId: string | undefined;
      }>
    ) => {
      navigate({
        search: (prev: Record<string, unknown>) =>
          ({
            ...prev,
            mode: next.mode,
            panel: next.panel,
            revisionId: next.revisionId,
            historyMode: next.historyMode,
            compareMode: next.compareMode,
            diagramSessionId: next.diagramSessionId
          }) as never
      });
    },
    [navigate]
  );

  const parentLabel: string = projectId
    ? (project?.name ?? 'Project')
    : entityId
      ? (entity?._name ?? 'Entity')
      : (workspace?.name ?? workspaceSlug);

  const handleNavigateBack = useCallback(() => {
    if (projectId) {
      navigate(projectDetailRoute(workspaceSlug, asProjectPublicId(projectId)));
    } else if (entityId) {
      navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entityId)));
    } else {
      navigate({ to: '/$workspaceSlug/content', params: { workspaceSlug } });
    }
  }, [navigate, workspaceSlug, projectId, entityId]);

  useEffect(() => {
    if (previousNodeIdRef.current === nodeId) return;
    clearMarkdownDiagramSession(sessionIdRef.current);
    sessionIdRef.current = newid();
    previousNodeIdRef.current = nodeId;
    initializedRef.current = false;
    setBody('');
    setDirty(false);
    setCloseDialogOpen(false);
    setCloseSummary(null);
    createdDiagramsRef.current = [];
  }, [nodeId]);

  useEffect(() => {
    setScreenState(current => syncMarkdownEditorScreenState(current, requestedMode, requestedPanel));
  }, [requestedMode, requestedPanel]);

  useEffect(() => {
    if (screenState.screenMode !== 'edit') return;
    if (search.diagramSessionId === sessionIdRef.current) return;
    updateSearch({ diagramSessionId: sessionIdRef.current });
  }, [screenState.screenMode, search.diagramSessionId, updateSearch]);

  useEffect(() => {
    if (!data) return;
    if (!initializedRef.current) {
      setBody(data.body);
      initializedRef.current = true;
      setDirty(false);
      return;
    }
    if (!dirty) {
      setBody(data.body);
    }
  }, [data, dirty]);

  useEffect(() => {
    if (screenState.viewPanel !== 'history' || revisions.length === 0) return;
    if (selectedRevisionId) return;
    updateSearch({
      mode: 'preview',
      panel: 'history',
      revisionId: revisions[0]!.id
    });
  }, [revisions, screenState.viewPanel, selectedRevisionId, updateSearch]);

  const handleChange = useCallback((value: string) => {
    setBody(value);
    setDirty(true);
  }, []);

  const clearDiagramSessionState = useCallback(() => {
    clearMarkdownDiagramSession(sessionIdRef.current);
    createdDiagramsRef.current = [];
  }, []);

  const rotateDiagramSession = useCallback(() => {
    clearMarkdownDiagramSession(sessionIdRef.current);
    createdDiagramsRef.current = [];
    sessionIdRef.current = newid();
    updateSearch({ diagramSessionId: sessionIdRef.current });
  }, [updateSearch]);

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

  const buildCloseSummary = useCallback(async () => {
    const records = getMarkdownDiagramRollbackRecords(sessionIdRef.current);
    const currentContentHashes = Object.fromEntries(
      await Promise.all(
        records
          .filter(record => !!record.lastSavedContentHash)
          .map(async record => {
            try {
              const content = await loadDiagramContentByPath(record.path);
              return [record.diagramId, hashDiagramContent(JSON.stringify(content))] as const;
            } catch {
              return [record.diagramId, undefined] as const;
            }
          })
      )
    );

    return buildMarkdownCloseImpactSummary({
      createdDiagrams: createdDiagramsRef.current,
      records,
      savedBody: data?.body ?? '',
      currentContentHashes
    });
  }, [data?.body, loadDiagramContentByPath]);

  const exitMarkdownEditor = useCallback(() => {
    setScreenState(exitMarkdownEditMode());
    updateSearch({
      mode: 'preview',
      panel: 'preview',
      revisionId: undefined,
      historyMode: undefined,
      diagramSessionId: undefined
    });
  }, [updateSearch]);

  const handleSave = useCallback(async () => {
    if (!dirty) {
      if (hasPendingDiagramChanges) {
        rotateDiagramSession();
        setCloseSummary(null);
      }
      return;
    }
    if (saveMutation.isPending) return;
    await saveMutation.mutateAsync({ body, name: headingTitle ?? undefined });
    setDirty(false);
    rotateDiagramSession();
    setCloseSummary(null);
  }, [body, dirty, hasPendingDiagramChanges, headingTitle, saveMutation, rotateDiagramSession]);

  const handleSaveAndClose = useCallback(async () => {
    if (dirty) {
      if (saveMutation.isPending) return;
      await saveMutation.mutateAsync({ body, name: headingTitle ?? undefined });
      setDirty(false);
    }
    clearDiagramSessionState();
    setCloseSummary(null);
    exitMarkdownEditor();
  }, [body, dirty, headingTitle, saveMutation, clearDiagramSessionState, exitMarkdownEditor]);

  const finalizeClose = useCallback(async () => {
    setBody(data?.body ?? '');
    setDirty(false);
    setCloseDialogOpen(false);
    setCloseSummary(null);
    clearDiagramSessionState();
    exitMarkdownEditor();
  }, [clearDiagramSessionState, data?.body, exitMarkdownEditor]);

  const handleKeepDiagramChanges = useCallback(async () => {
    const savedBody = data?.body ?? '';
    const touchedDiagramIds = getMarkdownDiagramRollbackRecords(sessionIdRef.current).map(
      record => record.diagramId
    );

    for (const { id, path } of createdDiagramsRef.current) {
      if (!savedBody.includes(id)) {
        await deleteAttachmentMutation.mutateAsync(path);
      }
    }

    await refreshDiagramPreviewCaches(touchedDiagramIds);
    await finalizeClose();
  }, [data?.body, deleteAttachmentMutation, finalizeClose, refreshDiagramPreviewCaches]);

  const handleRevertEligibleDiagramChanges = useCallback(async (diagramIds: string[]) => {
    const summary = closeSummary;
    if (!summary) {
      await handleKeepDiagramChanges();
      return;
    }

    const recordsById = new Map(
      getMarkdownDiagramRollbackRecords(sessionIdRef.current).map(record => [record.diagramId, record])
    );

    for (const diagram of summary.createdDiagramsToDelete) {
      await deleteAttachmentMutation.mutateAsync(diagram.path);
    }

    const revertedDiagramIds = summary.revertableDiagrams
      .filter(diagram => diagramIds.includes(diagram.diagramId))
      .map(diagram => diagram.diagramId);

    for (const diagram of summary.revertableDiagrams.filter(diagram =>
      diagramIds.includes(diagram.diagramId)
    )) {
      const record = recordsById.get(diagram.diagramId);
      if (!record) continue;
      await saveDiagramContentByPath(
        record.path,
        JSON.parse(record.originalContent) as Record<string, unknown>
      );
    }

    await refreshDiagramPreviewCaches(
      Array.from(
        new Set([
          ...summary.createdDiagramsToDelete.map(diagram => diagram.id),
          ...summary.revertableDiagrams.map(diagram => diagram.diagramId),
          ...summary.nonRevertableDiagrams.map(diagram => diagram.diagramId),
          ...revertedDiagramIds
        ])
      )
    );

    await finalizeClose();
  }, [
    closeSummary,
    deleteAttachmentMutation,
    finalizeClose,
    handleKeepDiagramChanges,
    refreshDiagramPreviewCaches,
    saveDiagramContentByPath
  ]);

  const handleClose = useCallback(async () => {
    if (!dirty && !hasPendingDiagramChanges) {
      exitMarkdownEditor();
      return;
    }

    const summary = await buildCloseSummary();
    setCloseSummary(summary);
    setCloseDialogOpen(true);
  }, [buildCloseSummary, dirty, exitMarkdownEditor, hasPendingDiagramChanges]);

  const handleEnterEdit = useCallback(() => {
    setScreenState(enterMarkdownEditMode());
    updateSearch({
      mode: 'edit',
      panel: undefined,
      revisionId: undefined,
      diagramSessionId: sessionIdRef.current
    });
  }, [updateSearch]);

  const handlePreview = useCallback(() => {
    setScreenState(exitMarkdownEditMode());
    updateSearch({
      mode: 'preview',
      panel: 'preview',
      revisionId: undefined,
      historyMode: undefined,
      diagramSessionId: undefined
    });
  }, [updateSearch]);

  const handleOpenHistory = useCallback(() => {
    setScreenState(openMarkdownHistory());
    updateSearch({
      mode: 'preview',
      panel: 'history',
      revisionId: revisions[0]?.id,
      diagramSessionId: undefined
    });
  }, [revisions, updateSearch]);

  const handleRenameConfirm = useCallback(
    async (newName: string) => {
      if (!file) return;
      const trimmed = newName.trim();
      if (!trimmed || trimmed === file.name) {
        setRenameOpen(false);
        return;
      }
      if (projectId) {
        await renameProjectFile.mutateAsync({ file, newName: trimmed });
      } else if (entityId) {
        await renameEntityFile.mutateAsync({ file, newName: trimmed });
      } else {
        await renameWorkspaceFile.mutateAsync({ file, newName: trimmed });
      }
      setRenameOpen(false);
    },
    [file, projectId, entityId, renameProjectFile, renameEntityFile, renameWorkspaceFile]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!file) return;
    if (projectId) {
      await deleteProjectFile.mutateAsync(file.path);
    } else if (entityId) {
      await deleteEntityFile.mutateAsync(file.path);
    } else {
      await deleteWorkspaceFile.mutateAsync(file.path);
    }
    setDeleteOpen(false);
    handleNavigateBack();
  }, [
    file,
    projectId,
    entityId,
    deleteProjectFile,
    deleteEntityFile,
    deleteWorkspaceFile,
    handleNavigateBack
  ]);

  const handleAttachmentDeleteConfirm = useCallback(async () => {
    if (!attachmentDeleteTarget) return;
    await deleteAttachmentMutation.mutateAsync(attachmentDeleteTarget.path);
    setAttachmentDeleteTarget(null);
  }, [attachmentDeleteTarget, deleteAttachmentMutation]);

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
      if (restoreMutation.isPending) return;
      await restoreMutation.mutateAsync(revisionId);
      setDirty(false);
      clearDiagramSessionState();
      exitMarkdownEditor();
    },
    [restoreMutation, clearDiagramSessionState, exitMarkdownEditor]
  );

  const handleOpenAttachment = useCallback(
    (attachment: ProjectFile) => {
      if (attachment.type === 'file') {
        const href = projectId
          ? `/api/${workspaceSlug}/projects/${projectId}/files/download?path=${encodeURIComponent(attachment.path)}`
          : entityId
            ? `/api/${workspaceSlug}/entities/${entityId}/content/files/download?path=${encodeURIComponent(attachment.path)}`
            : `/api/${workspaceSlug}/content/files/download?path=${encodeURIComponent(attachment.path)}`;
        const a = document.createElement('a');
        a.href = href;
        a.download = attachment.original_filename ?? attachment.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      if (attachment.type === 'markdown') {
        if (projectId) {
          navigate(projectMarkdownRoute(workspaceSlug, asProjectPublicId(projectId), attachment.id));
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

  if (isLoading) {
    return (
      <div className={styles.screen}>
        <div className={styles.loading}>Loading…</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.screen}>
        <div className={styles.loading}>Failed to load document.</div>
      </div>
    );
  }

  const showPlateEditor = screenState.screenMode === 'edit' && screenState.paneMode === 'edit';
  const showRawEditor = screenState.screenMode === 'edit' && screenState.paneMode === 'raw';

  const homeItem = {
    label: 'Home',
    onClick: () => navigate({ to: '/$workspaceSlug/', params: { workspaceSlug } })
  };

  const titleBreadcrumb = projectId
    ? [
        homeItem,
        {
          label: 'Projects',
          onClick: () => navigate({ to: '/$workspaceSlug/projects', params: { workspaceSlug } })
        },
        { label: parentLabel, onClick: handleNavigateBack },
        { label: resolvedTitle }
      ]
    : entityId
      ? [
          homeItem,
          {
            label: 'Entities',
            onClick: () => navigate({ to: '/$workspaceSlug/entities', params: { workspaceSlug } })
          },
          { label: parentLabel, onClick: handleNavigateBack },
          { label: resolvedTitle }
        ]
      : [
          homeItem,
          {
            label: 'Workspace Content',
            onClick: () => navigate({ to: '/$workspaceSlug/content', params: { workspaceSlug } })
          },
          { label: resolvedTitle }
        ];

  const titleIcon = (
    <div className={styles.titleIcon}>
      <TbFileText size={20} />
    </div>
  );

  const titleDescription =
    screenState.screenMode === 'edit'
      ? 'Editing now'
      : screenState.viewPanel === 'history'
        ? `Version history${revisions.length > 0 ? ` · ${revisions.length} saved` : ''}`
        : [updatedLabel ? `Updated ${updatedLabel}` : null, `${readTime} min read`]
            .filter(Boolean)
            .join(' · ');

  const isViewMode = screenState.screenMode === 'preview' && screenState.viewPanel === 'preview';

  const titleButtons = (
    <>
      <Button
        icon={<TbUpload size={13} />}
        onClick={() => fileInputRef.current?.click()}
        disabled={uploadAttachmentMutation.isPending || screenState.viewPanel === 'history'}
      >
        {uploadAttachmentMutation.isPending ? 'Uploading…' : 'Attach file'}
      </Button>
      <Button icon={<TbPencil size={13} />} onClick={handleEnterEdit} disabled={!isViewMode}>
        Edit
      </Button>
      <DropdownMenu
        trigger={<Button icon={<TbDots size={13} />} disabled={!isViewMode} />}
        items={[
          { label: 'Versions', icon: <TbHistory size={13} />, onClick: handleOpenHistory },
          { label: 'Rename', icon: <TbPencil size={13} />, onClick: () => setRenameOpen(true) },
          {
            label: 'Delete',
            icon: <TbTrash size={13} />,
            danger: true,
            onClick: () => setDeleteOpen(true)
          }
        ]}
      />
    </>
  );

  return (
    <MarkdownDiagramSessionContext.Provider
      value={{ sessionId: sessionIdRef.current, trackCreatedDiagram }}
    >
    <div className={styles.screen}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className={styles.hiddenInput}
        onChange={handleAttachmentInputChange}
      />
      <div className={styles.header}>
        <Title
          breadcrumb={titleBreadcrumb}
          icon={titleIcon}
          title={resolvedTitle}
          description={titleDescription}
          buttons={titleButtons}
        />
      </div>

      {screenState.screenMode === 'edit' && (
        <div className={styles.toolbar}>
          <div className={styles.paneToggle}>
            <button
              type="button"
              className={`${styles.paneToggleBtn} ${screenState.paneMode === 'edit' ? styles.paneToggleBtnActive : ''}`}
              onClick={() => setScreenState(selectMarkdownEditPane('edit'))}
            >
              Edit
            </button>
            <button
              type="button"
              className={`${styles.paneToggleBtn} ${screenState.paneMode === 'raw' ? styles.paneToggleBtnActive : ''}`}
              onClick={() => setScreenState(selectMarkdownEditPane('raw'))}
            >
              Raw
            </button>
            <button
              type="button"
              className={`${styles.paneToggleBtn} ${screenState.paneMode === 'preview' ? styles.paneToggleBtnActive : ''}`}
              onClick={() => setScreenState(selectMarkdownEditPane('preview'))}
            >
              Preview
            </button>
          </div>

          <span className={hasUnsavedChanges ? styles.dirty : styles.clean}>
            {hasUnsavedChanges ? (
              <>
                <span className={styles.dirtyDot} /> Unsaved changes
              </>
            ) : (
              'All changes saved'
            )}
          </span>

          <div className={styles.toolbarActions}>
            <Button icon={<TbDeviceFloppy size={13} />} variant="secondary" onClick={handleSave}>
              Save
            </Button>
            <Button
              icon={<TbDeviceFloppy size={13} />}
              variant="secondary"
              onClick={handleSaveAndClose}
            >
              Save & Close
            </Button>
            <Button icon={<TbX size={13} />} variant="secondary" onClick={handleClose}>
              Close
            </Button>
          </div>
        </div>
      )}

      {showPlateEditor ? (
        <PlateMarkdownEditor value={body} onChange={handleChange} />
      ) : showRawEditor ? (
        <div className={styles.editPane}>
          <textarea
            className={styles.textarea}
            value={body}
            onChange={e => handleChange(e.target.value)}
            placeholder="Start writing in Markdown…"
            spellCheck
          />
        </div>
      ) : screenState.screenMode === 'edit' ? (
        <div className={styles.bodyGrid}>
          <article className={styles.article}>
            {body.trim() ? (
              <MdxPreview body={body} withoutFirstHeading />
            ) : (
              <div className={styles.previewEmpty}>Nothing to preview yet.</div>
            )}
          </article>
          {toc.length > 0 && (
            <aside className={styles.toc}>
              <div className={styles.tocLabel}>On this page</div>
              {toc.map((h, i) => (
                <div key={i} className={styles.tocItem}>
                  {h}
                </div>
              ))}
            </aside>
          )}
        </div>
      ) : screenState.viewPanel === 'history' ? (
        <MarkdownHistoryPanel
          workspaceSlug={workspaceSlug}
          nodeId={nodeId}
          currentBody={body}
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
        <div className={styles.bodyGrid}>
          <article className={styles.article}>
            {body.trim() ? (
              <>
                <MdxPreview body={body} withoutFirstHeading />
                {attachments.length > 0 && (
                  <section className={styles.attachmentsSection}>
                    <div className={styles.attachmentsHeader}>
                      <h2 className={styles.attachmentsTitle}>Attachments</h2>
                      <span className={styles.attachmentsCount}>
                        {attachments.length} {attachments.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                    <div className={styles.attachmentsList}>
                      {attachments.map(attachment => (
                        <div key={attachment.id} className={styles.attachmentItem}>
                          <button
                            type="button"
                            className={styles.attachmentMain}
                            onClick={() => handleOpenAttachment(attachment)}
                          >
                            <span className={styles.attachmentIcon}>
                              {getFileNodeIcon(attachment.type, 14)}
                            </span>
                            <span className={styles.attachmentBody}>
                              <span className={styles.attachmentName}>
                                {attachment.original_filename ?? attachment.name}
                              </span>
                              <span className={styles.attachmentMeta}>
                                {attachment.type === 'diagram'
                                  ? 'Diagram'
                                  : attachment.type === 'markdown'
                                    ? 'Wiki page'
                                    : attachment.mime_type ?? 'File'}
                              </span>
                            </span>
                          </button>
                          <button
                            type="button"
                            className={styles.attachmentDelete}
                            onClick={event => {
                              event.stopPropagation();
                              setAttachmentDeleteTarget(attachment);
                            }}
                            aria-label={`Delete ${attachment.original_filename ?? attachment.name}`}
                            disabled={deleteAttachmentMutation.isPending}
                          >
                            <TbTrash size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                <div className={styles.articleFooter}>
                  {updatedLabel && <>Last edited {updatedLabel} · </>}
                  {readTime} min read
                </div>
              </>
            ) : (
              <div className={styles.previewEmpty}>Preview will appear here as you type.</div>
            )}
          </article>
          {toc.length > 0 && (
            <aside className={styles.toc}>
              <div className={styles.tocLabel}>On this page</div>
              {toc.map((h, i) => (
                <div key={i} className={styles.tocItem}>
                  {h}
                </div>
              ))}
            </aside>
          )}
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
            The attachment <b>{attachmentDeleteTarget?.original_filename ?? attachmentDeleteTarget?.name ?? ''}</b>{' '}
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
        onCancel={() => setCloseDialogOpen(false)}
        onCloseWithSelection={diagramIds =>
          void (diagramIds.length > 0
            ? handleRevertEligibleDiagramChanges(diagramIds)
            : handleKeepDiagramChanges())
        }
      />
    </div>
    </MarkdownDiagramSessionContext.Provider>
  );
};
