import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useParams, useSearch, useNavigate } from '@tanstack/react-router';
import { TbDeviceFloppy, TbFileText } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { useMarkdownContent, useSaveMarkdownContent, useWorkspaceContentNodes } from '../../hooks/useProjectFiles';
import { useProject, useEntityContentNodes } from '../../hooks/useProjects';
import { useEntity } from '../../hooks/useEntities';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { Title } from '../../components/Title';
import type { FileTree, ProjectFile } from '@arch-register/api-types/projectContract';
import styles from './MarkdownEditorScreen.module.css';
import { extractFirstHeadingTitle, renderMarkdownWithoutFirstHeading } from './markdownTitle';
import {
  projectDetailRoute,
  entityDetailRoute,
  asProjectPublicId,
  asEntityPublicId
} from '../../routes/publicObjectRoutes';

type EditorMode = 'view' | 'edit';
type PaneMode = 'edit' | 'preview';

const findFileById = (tree: FileTree | undefined, nodeId: string): ProjectFile | undefined => {
  if (!tree) return undefined;
  return [...tree.rootFiles, ...tree.folders.flatMap(folder => folder.files)].find(file => file.id === nodeId);
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
  const search = useSearch({ strict: false }) as { mode?: PaneMode };
  const { workspaceSlug, nodeId, projectId, entityId } = params;
  const navigate = useNavigate();
  const { workspace } = useWorkspaceContext();
  const requestedMode = search.mode === 'edit' ? 'edit' : 'preview';

  const { data, isLoading, isError } = useMarkdownContent(workspaceSlug, nodeId);
  const saveMutation = useSaveMarkdownContent(workspaceSlug, nodeId, { projectId, entityId });
  const { data: project } = useProject(workspaceSlug, projectId ?? '', { enabled: !!projectId });
  const { data: entity } = useEntity(workspaceSlug, entityId ?? '');
  const { data: entityFiles } = useEntityContentNodes(workspaceSlug, entityId ?? '', { enabled: !!entityId });
  const { data: workspaceFiles } = useWorkspaceContentNodes(workspaceSlug, { enabled: !projectId && !entityId });

  const [body, setBody] = useState('');
  const [editorMode, setEditorMode] = useState<EditorMode>(requestedMode === 'edit' ? 'edit' : 'view');
  const [paneMode, setPaneMode] = useState<PaneMode>(requestedMode);
  const [dirty, setDirty] = useState(false);
  const initializedRef = useRef(false);
  const previousNodeIdRef = useRef(nodeId);

  const file = useMemo(() => {
    return projectId
      ? findFileById(project?.files, nodeId)
      : entityId
        ? findFileById(entityFiles, nodeId)
        : findFileById(workspaceFiles, nodeId);
  }, [entityFiles, entityId, nodeId, project?.files, projectId, workspaceFiles]);

  const documentTitle = file?.name ?? 'Markdown document';
  const headingTitle = useMemo(() => extractFirstHeadingTitle(body), [body]);
  const resolvedTitle = headingTitle ?? documentTitle;
  const previewHtml = useMemo(() => renderMarkdownWithoutFirstHeading(body), [body]);
  const toc = useMemo(() => extractToc(body), [body]);
  const readTime = useMemo(() => calcReadTime(body), [body]);
  const updatedLabel = file?.updated_at ? relativeDate(file.updated_at) : null;

  const parentLabel = projectId
    ? (project?.name ?? 'Project')
    : entityId
      ? (entity?.name ?? 'Entity')
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
    previousNodeIdRef.current = nodeId;
    initializedRef.current = false;
    setBody('');
    setDirty(false);
  }, [nodeId]);

  useEffect(() => {
    setEditorMode(requestedMode === 'edit' ? 'edit' : 'view');
    setPaneMode(requestedMode);
  }, [requestedMode]);

  useEffect(() => {
    if (data && !initializedRef.current) {
      setBody(data.body);
      initializedRef.current = true;
      setDirty(false);
    }
  }, [data]);

  const handleChange = useCallback((value: string) => {
    setBody(value);
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (saveMutation.isPending) return;
    await saveMutation.mutateAsync({ body, name: headingTitle ?? undefined });
    setDirty(false);
  }, [body, headingTitle, saveMutation]);

  const handleSaveAndClose = useCallback(async () => {
    if (saveMutation.isPending) return;
    await saveMutation.mutateAsync({ body, name: headingTitle ?? undefined });
    setDirty(false);
    setEditorMode('view');
    setPaneMode('preview');
  }, [body, headingTitle, saveMutation]);

  const handleClose = useCallback(() => {
    setEditorMode('view');
    setPaneMode('preview');
  }, []);

  const handleEnterEdit = useCallback(() => {
    setEditorMode('edit');
    setPaneMode('edit');
  }, []);

  const handlePreview = useCallback(() => {
    setPaneMode('preview');
  }, []);

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

  const showEditor = editorMode === 'edit' && paneMode === 'edit';

  const homeItem = { label: 'Home', onClick: () => navigate({ to: '/$workspaceSlug/', params: { workspaceSlug } }) };

  const titleBreadcrumb = projectId
    ? [
        homeItem,
        { label: 'Projects', onClick: () => navigate({ to: '/$workspaceSlug/projects', params: { workspaceSlug } }) },
        { label: parentLabel, onClick: handleNavigateBack },
        { label: resolvedTitle }
      ]
    : entityId
      ? [
          homeItem,
          { label: 'Entities', onClick: () => navigate({ to: '/$workspaceSlug/entities', params: { workspaceSlug } }) },
          { label: parentLabel, onClick: handleNavigateBack },
          { label: resolvedTitle }
        ]
      : [
          homeItem,
          { label: 'Workspace Content', onClick: () => navigate({ to: '/$workspaceSlug/content', params: { workspaceSlug } }) },
          { label: resolvedTitle }
        ];

  const titleIcon = (
    <div className={styles.titleIcon}>
      <TbFileText size={20} />
    </div>
  );

  const titleDescription = editorMode === 'edit'
    ? 'Editing now'
    : [
        updatedLabel ? `Updated ${updatedLabel}` : null,
        `${readTime} min read`
      ].filter(Boolean).join(' · ');

  const titleButtons = editorMode === 'view'
    ? (
        <Button onClick={handleEnterEdit}>
          Edit
        </Button>
      )
    : showEditor
      ? (
          <>
            <Button onClick={handleClose}>
              Close
            </Button>
            <Button onClick={handlePreview}>
              Preview
            </Button>
            <Button
              icon={<TbDeviceFloppy size={13} />}
              onClick={handleSave}
            >
              Save
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveAndClose}
            >
              Save & Close
            </Button>
          </>
        )
      : (
          <Button onClick={handleEnterEdit}>
            Edit
          </Button>
        );

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <Title
          breadcrumb={titleBreadcrumb}
          icon={titleIcon}
          title={resolvedTitle}
          description={titleDescription}
          buttons={titleButtons}
        />
      </div>

      {showEditor ? (
        <>
          <div className={styles.editPane}>
            <textarea
              className={styles.textarea}
              value={body}
              onChange={e => handleChange(e.target.value)}
              placeholder="Start writing in Markdown…"
              spellCheck
            />
          </div>
          <div className={styles.editorFooter}>
            <span className={dirty ? styles.dirty : styles.clean}>
              {dirty
                ? <><span className={styles.dirtyDot} /> Unsaved changes</>
                : 'All changes saved'
              }
            </span>
          </div>
        </>
      ) : (
        <div className={styles.bodyGrid}>
          <article className={styles.article}>
            {previewHtml.trim() ? (
              <>
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                <div className={styles.articleFooter}>
                  {updatedLabel && <>Last edited {updatedLabel} · </>}
                  {readTime} min read
                </div>
              </>
            ) : (
              <div className={styles.previewEmpty}>
                Preview will appear here as you type.
              </div>
            )}
          </article>
          {toc.length > 0 && (
            <aside className={styles.toc}>
              <div className={styles.tocLabel}>On this page</div>
              {toc.map((h, i) => (
                <div key={i} className={styles.tocItem}>{h}</div>
              ))}
            </aside>
          )}
        </div>
      )}
    </div>
  );
};
