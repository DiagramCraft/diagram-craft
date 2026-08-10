import { useCallback, useMemo } from 'react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { MarkdownSearchParams } from '../../routes/searchParams';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import type { ContentScope } from '../../hooks/useContentScope';
import { useMarkdownContent, useMarkdownRevisions } from '../../hooks/useMarkdownContent';
import { useDocumentTemplates, useDocumentTypes } from '../../hooks/useDocuments';
import { useGovernanceWorkflowConfig } from '../../hooks/useGovernanceWorkflowConfig';
import { useEnums } from '../../hooks/useEnums';
import { useWikiComments } from '../../hooks/useWikiComments';
import { useMarkdownDocumentScope } from './useMarkdownDocumentScope';
import { useMarkdownDiagramSessionTracking } from './useMarkdownDiagramSessionTracking';
import { MarkdownDiagramSessionContext } from './MarkdownDiagramSessionContext';
import { MdxContext } from './MdxContext';
import { MarkdownEditorContent } from './MarkdownEditorContent';
import { MarkdownEditorDialogs } from './MarkdownEditorDialogs';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityDetailRoute,
  entityDiagramRoute,
  entityMarkdownRoute,
  projectDetailRoute,
  projectDiagramRoute,
  projectMarkdownRoute,
  workspaceMarkdownRoute
} from '../../routes/publicObjectRoutes';
import { applicationWorkspacePath } from '../../lib/applicationApi';
import { downloadUrl } from '../../lib/browserDownload';
import { LoadingState } from '../../components/LoadingState';
import styles from './MarkdownEditorScreen.module.css';
import {
  useMarkdownEditorController,
  type MarkdownEditorSearchUpdate
} from './useMarkdownEditorController';
import { newid } from '@diagram-craft/utils/id';

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
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false });
  // workspaceSlug is always present: this screen only mounts under the entity/project/content
  // wiki routes. nodeId is omitted by the new-document routes, which signals draft mode.
  const workspaceSlug = params.workspaceSlug!;
  const nodeId = params.nodeId ?? '';
  const isDraft = !params.nodeId;
  const { projectId, entityId } = params;
  const navigate = useNavigate();
  const requestedMode = search.mode;
  const requestedPanel = search.panel;
  const historyMode = search.historyMode === 'compare' ? 'compare' : 'preview';
  const compareMode = search.compareMode ?? 'to-current';
  const draftName = search.draftName ?? 'Untitled document';
  const draftFolder = search.draftFolder;
  const draftType = search.draftType ?? null;
  const draftTemplate = search.draftTemplate ?? null;
  const selectedRevisionId = search.revisionId;
  const contentScope: ContentScope = projectId
    ? { kind: 'project', workspaceId: workspaceSlug, projectId }
    : entityId
      ? { kind: 'entity', workspaceId: workspaceSlug, entityId }
      : { kind: 'workspace', workspaceId: workspaceSlug };

  const { data, isLoading, isError } = useMarkdownContent(workspaceSlug, nodeId);
  const { data: documentTypes = [], isLoading: documentTypesLoading } =
    useDocumentTypes(workspaceSlug);
  const { data: workspaceTemplates = [], isLoading: workspaceTemplatesLoading } =
    useDocumentTemplates(workspaceSlug, null);
  const { data: projectTemplates = [], isLoading: projectTemplatesLoading } = useDocumentTemplates(
    workspaceSlug,
    projectId ?? null
  );
  const draftTemplates = projectId
    ? [...workspaceTemplates, ...projectTemplates]
    : workspaceTemplates;
  const draftTemplatesLoading = workspaceTemplatesLoading || projectTemplatesLoading;
  const { data: revisions = [], isLoading: revisionsLoading } = useMarkdownRevisions(
    workspaceSlug,
    nodeId
  );
  const { data: governanceWorkflowConfig } = useGovernanceWorkflowConfig(workspaceSlug);
  const { data: workspaceEnums = [] } = useEnums(workspaceSlug);
  const { file, parentLabel, renameFile, deleteFile } = useMarkdownDocumentScope({
    workspaceSlug,
    nodeId,
    projectId,
    entityId
  });
  const { data: wikiComments = [] } = useWikiComments(workspaceSlug, nodeId, !isDraft);
  const rootWikiComments = useMemo(() => wikiComments.filter(c => !c.parentPostId), [wikiComments]);
  const hasWikiComments = rootWikiComments.length > 0;
  const openWikiCommentsCount = useMemo(
    () => rootWikiComments.filter(c => c.resolvedAt == null).length,
    [rootWikiComments]
  );
  const isReadOnly = !!file?.read_only;
  const updatedLabel = file?.updated_at ? relativeDate(file.updated_at) : null;

  const updateSearch = useCallback<MarkdownEditorSearchUpdate>(
    (next, replace = false) => {
      // This screen is shared across three sibling wiki routes with identical search schemas;
      // there is no single static route to scope navigate to, so the updater needs this cast.
      navigate({
        search: ((previous: MarkdownSearchParams) => ({
          ...previous,
          ...next
        })) as never,
        replace
      });
    },
    [navigate]
  );

  const diagram = useMarkdownDiagramSessionTracking({
    workspaceSlug,
    projectId,
    entityId,
    initialSessionId: search.diagramSessionId ?? newid(),
    onSessionIdChange: sessionId => updateSearch({ diagramSessionId: sessionId }, true)
  });

  const handleNavigateBack = useCallback(() => {
    if (projectId) {
      navigate(projectDetailRoute(workspaceSlug, asProjectPublicId(projectId)));
    } else if (entityId) {
      navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entityId)));
    } else {
      navigate({ to: '/$workspaceSlug/content', params: { workspaceSlug } });
    }
  }, [entityId, navigate, projectId, workspaceSlug]);

  const exitMarkdownEditor = useCallback(() => {
    updateSearch({
      mode: 'preview',
      panel: 'preview',
      revisionId: undefined,
      historyMode: undefined,
      compareMode: undefined,
      diagramSessionId: undefined
    });
  }, [updateSearch]);

  const navigateToSavedDraft = useCallback(
    (savedFile: ProjectFile) => {
      if (projectId) {
        navigate(
          projectMarkdownRoute(workspaceSlug, asProjectPublicId(projectId), savedFile.id, {
            mode: 'edit'
          })
        );
      } else if (entityId) {
        navigate(
          entityMarkdownRoute(workspaceSlug, asEntityPublicId(entityId), savedFile.id, {
            mode: 'edit'
          })
        );
      } else {
        navigate(workspaceMarkdownRoute(workspaceSlug, savedFile.id, { mode: 'edit' }));
      }
    },
    [entityId, navigate, projectId, workspaceSlug]
  );

  const navigateToConversation = useCallback(
    (conversationId: string) => {
      navigate({
        to: '/$workspaceSlug/assistant',
        params: { workspaceSlug },
        search: { conversation: conversationId }
      });
    },
    [navigate, workspaceSlug]
  );

  const downloadAttachment = useCallback(
    (attachment: ProjectFile) => {
      const path = encodeURIComponent(attachment.path);
      const href = projectId
        ? applicationWorkspacePath(
            workspaceSlug,
            `/projects/${projectId}/files/download?path=${path}`
          )
        : entityId
          ? applicationWorkspacePath(
              workspaceSlug,
              `/entities/${entityId}/content/files/download?path=${path}`
            )
          : applicationWorkspacePath(workspaceSlug, `/content/files/download?path=${path}`);
      downloadUrl(href, attachment.original_filename ?? attachment.name);
    },
    [entityId, projectId, workspaceSlug]
  );

  const openAttachment = useCallback(
    (attachment: ProjectFile) => {
      if (attachment.type === 'markdown') {
        if (projectId) {
          navigate(
            projectMarkdownRoute(workspaceSlug, asProjectPublicId(projectId), attachment.id)
          );
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

  const controller = useMarkdownEditorController({
    workspaceSlug,
    nodeId,
    projectId,
    entityId,
    isDraft,
    isReadOnly,
    data,
    file,
    documentTitle: isDraft ? draftName : (file?.name ?? 'Markdown document'),
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
    diagramSessionId: search.diagramSessionId,
    historyMode,
    compareMode,
    selectedRevisionId,
    revisions,
    updatedLabel,
    onNavigateBack: handleNavigateBack,
    onNavigateToSavedDraft: navigateToSavedDraft,
    onExit: exitMarkdownEditor,
    onNavigateToConversation: navigateToConversation,
    onOpenAttachment: openAttachment,
    onDownloadAttachment: downloadAttachment,
    renameFile,
    deleteFile,
    updateSearch,
    diagram
  });

  if (!isDraft && isLoading) {
    return (
      <div className={styles.screen}>
        <LoadingState text="Loading…" />
      </div>
    );
  }

  if (!isDraft && isError) {
    return (
      <div className={styles.screen}>
        <div className={styles.loading}>Failed to load document.</div>
      </div>
    );
  }

  return (
    <MdxContext.Provider
      value={{ workspaceSlug, projectId, entityId, nodeId: isDraft ? undefined : nodeId }}
    >
      <MarkdownDiagramSessionContext.Provider
        value={{ sessionId: diagram.sessionId, trackCreatedDiagram: diagram.trackCreatedDiagram }}
      >
        <MarkdownEditorContent
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          entityId={entityId}
          nodeId={nodeId}
          commentId={search.commentId}
          parentLabel={parentLabel}
          isDraft={isDraft}
          isReadOnly={isReadOnly}
          controller={controller}
          hasWikiComments={hasWikiComments}
          openWikiCommentsCount={openWikiCommentsCount}
          commentsMode={controller.commentsMode}
          onNavigateBack={handleNavigateBack}
          revisions={revisions}
          revisionsLoading={revisionsLoading}
          selectedRevisionId={selectedRevisionId}
          historyMode={historyMode}
          compareMode={compareMode}
          updatedLabel={updatedLabel}
          dialogs={<MarkdownEditorDialogs fileName={file?.name ?? ''} controller={controller} />}
        />
      </MarkdownDiagramSessionContext.Provider>
    </MdxContext.Provider>
  );
};
