import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useParams, useSearch } from '@tanstack/react-router';
import { TbDeviceFloppy } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { useMarkdownContent, useSaveMarkdownContent, useWorkspaceContentNodes } from '../../hooks/useProjectFiles';
import { useProject, useEntityContentNodes } from '../../hooks/useProjects';
import { Title } from '../../components/Title';
import type { FileTree, ProjectFile } from '@arch-register/api-types/projectContract';
import styles from './MarkdownEditorScreen.module.css';
import { extractFirstHeadingTitle, renderMarkdownWithoutFirstHeading } from './markdownTitle';

type EditorMode = 'view' | 'edit';
type PaneMode = 'edit' | 'preview';

const findFileById = (tree: FileTree | undefined, nodeId: string): ProjectFile | undefined => {
  if (!tree) return undefined;
  return [...tree.rootFiles, ...tree.folders.flatMap(folder => folder.files)].find(file => file.id === nodeId);
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
  const requestedMode = search.mode === 'edit' ? 'edit' : 'preview';

  const { data, isLoading, isError } = useMarkdownContent(workspaceSlug, nodeId);
  const saveMutation = useSaveMarkdownContent(workspaceSlug, nodeId, { projectId, entityId });
  const { data: project } = useProject(workspaceSlug, projectId ?? '', { enabled: !!projectId });
  const { data: entityFiles } = useEntityContentNodes(workspaceSlug, entityId ?? '', { enabled: !!entityId });
  const { data: workspaceFiles } = useWorkspaceContentNodes(workspaceSlug, { enabled: !projectId && !entityId });

  const [body, setBody] = useState('');
  const [editorMode, setEditorMode] = useState<EditorMode>(requestedMode === 'edit' ? 'edit' : 'view');
  const [paneMode, setPaneMode] = useState<PaneMode>(requestedMode);
  const initializedRef = useRef(false);
  const previousNodeIdRef = useRef(nodeId);

  const documentTitle = useMemo(() => {
    const file = projectId
      ? findFileById(project?.files, nodeId)
      : entityId
        ? findFileById(entityFiles, nodeId)
        : findFileById(workspaceFiles, nodeId);
    return file?.name ?? 'Markdown document';
  }, [entityFiles, entityId, nodeId, project?.files, projectId, workspaceFiles]);

  const headingTitle = useMemo(() => extractFirstHeadingTitle(body), [body]);
  const resolvedTitle = headingTitle ?? documentTitle;

  useEffect(() => {
    if (previousNodeIdRef.current === nodeId) return;
    previousNodeIdRef.current = nodeId;
    initializedRef.current = false;
    setBody('');
  }, [nodeId]);

  useEffect(() => {
    setEditorMode(requestedMode === 'edit' ? 'edit' : 'view');
    setPaneMode(requestedMode);
  }, [requestedMode]);

  useEffect(() => {
    if (data && !initializedRef.current) {
      setBody(data.body);
      initializedRef.current = true;
    }
  }, [data]);

  const handleChange = useCallback((value: string) => {
    setBody(value);
  }, []);

  const handleSave = useCallback(async () => {
    if (saveMutation.isPending) return;
    await saveMutation.mutateAsync({ body, name: headingTitle ?? undefined });
  }, [body, headingTitle, saveMutation]);

  const handleSaveAndClose = useCallback(async () => {
    if (saveMutation.isPending) return;
    await saveMutation.mutateAsync({ body, name: headingTitle ?? undefined });
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
        <div className={styles.error}>Failed to load document.</div>
      </div>
    );
  }

  const previewHtml = renderMarkdownWithoutFirstHeading(body);
  const showEditor = editorMode === 'edit' && paneMode === 'edit';
  const title = editorMode === 'view'
    ? resolvedTitle
    : showEditor
      ? `Edit: ${resolvedTitle}`
      : `Preview: ${resolvedTitle}`;
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
          title={title}
          buttons={titleButtons}
        />
      </div>
      <div className={styles.editorArea}>
        {showEditor ? (
          <div className={styles.editPane}>
            <textarea
              className={styles.textarea}
              value={body}
              onChange={e => handleChange(e.target.value)}
              placeholder="Start writing in Markdown…"
              spellCheck
            />
          </div>
        ) : (
          <div className={styles.previewPane}>
            {previewHtml.trim() ? (
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <div className={styles.previewEmpty}>Preview will appear here as you type.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
