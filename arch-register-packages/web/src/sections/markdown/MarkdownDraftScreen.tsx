import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { DocumentMetadata } from '@arch-register/api-types/documentContract';
import { useDocumentTemplates, useDocumentTypes } from '../../hooks/useDocuments';
import { useSaveNewMarkdownContent } from '../../hooks/useMarkdownContent';
import type { ContentScope } from '../../hooks/useContentScope';
import { MarkdownEditorHeader } from './MarkdownEditorHeader';
import { MarkdownEditorPane } from './MarkdownEditorPane';
import { MarkdownEditorToolbar } from './MarkdownEditorToolbar';
import { MarkdownPropertiesPanel } from './MarkdownPropertiesPanel';
import { MarkdownDiagramSessionContext } from './MarkdownDiagramSessionContext';
import { MdxContext } from './MdxContext';
import { extractFirstHeadingTitle } from './preview/markdownTitle';
import { ApiError } from '../../lib/http';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityDetailRoute,
  entityMarkdownRoute,
  projectDetailRoute,
  projectMarkdownRoute,
  workspaceMarkdownRoute
} from '../../routes/publicObjectRoutes';
import { useMarkdownDocumentScope } from './useMarkdownDocumentScope';
import { newid } from '@diagram-craft/utils/id';
import styles from './MarkdownEditorScreen.module.css';
import type { MarkdownPaneMode } from './MarkdownEditorScreen.state';

const extractToc = (markdown: string): string[] =>
  markdown.match(/^## .+$/gm)?.map(line => line.slice(3).trim()) ?? [];

const calcReadTime = (text: string): number =>
  Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 200));

export const MarkdownDraftScreen = () => {
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false }) as {
    draftName?: string;
    draftFolder?: string;
    draftType?: string;
    draftTemplate?: string;
  };
  const navigate = useNavigate();
  const workspaceSlug = params.workspaceSlug!;
  const { projectId, entityId } = params;
  const draftName = search.draftName ?? 'Untitled document';
  const draftFolder = search.draftFolder;
  const draftType = search.draftType ?? null;
  const draftTemplate = search.draftTemplate ?? null;
  const contentScope = useMemo<ContentScope>(
    () =>
      projectId
        ? { kind: 'project', workspaceId: workspaceSlug, projectId }
        : entityId
          ? { kind: 'entity', workspaceId: workspaceSlug, entityId }
          : { kind: 'workspace', workspaceId: workspaceSlug },
    [entityId, projectId, workspaceSlug]
  );
  const { parentLabel } = useMarkdownDocumentScope({
    workspaceSlug,
    nodeId: '',
    projectId,
    entityId
  });
  const { data: documentTypes = [], isLoading: documentTypesLoading } = useDocumentTypes(workspaceSlug);
  const { data: workspaceTemplates = [], isLoading: workspaceTemplatesLoading } = useDocumentTemplates(
    workspaceSlug,
    null
  );
  const { data: projectTemplates = [], isLoading: projectTemplatesLoading } = useDocumentTemplates(
    workspaceSlug,
    projectId ?? null
  );
  const save = useSaveNewMarkdownContent(contentScope);
  const templates = projectId ? [...workspaceTemplates, ...projectTemplates] : workspaceTemplates;
  const templatesLoading = workspaceTemplatesLoading || projectTemplatesLoading;
  const initializedRef = useRef(false);
  const sessionId = useRef(newid()).current;
  const [body, setBody] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState<string | null>(draftType);
  const [metadata, setMetadata] = useState<DocumentMetadata>({});
  const [paneMode, setPaneMode] = useState<MarkdownPaneMode>('edit');
  const [dirty, setDirty] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initializedRef.current || documentTypesLoading || templatesLoading) return;
    const template = templates.find(item => item.id === draftTemplate);
    setBody(template ? template.body.split('{{title}}').join(draftName) : '');
    setDocumentTypeId(template?.document_type_id ?? draftType);
    setMetadata(template?.metadata_defaults ?? {});
    setDirty(true);
    initializedRef.current = true;
  }, [documentTypesLoading, draftName, draftTemplate, draftType, templates, templatesLoading]);

  const documentType = documentTypes.find(type => type.id === documentTypeId) ?? null;
  const headingTitle = useMemo(() => extractFirstHeadingTitle(body), [body]);
  const resolvedTitle = headingTitle ?? draftName;
  const toc = useMemo(() => extractToc(body), [body]);
  const readTime = useMemo(() => calcReadTime(body), [body]);

  const navigateBack = useCallback(() => {
    if (projectId) {
      navigate(projectDetailRoute(workspaceSlug, asProjectPublicId(projectId)));
    } else if (entityId) {
      navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entityId)));
    } else {
      navigate({ to: '/$workspaceSlug/content', params: { workspaceSlug } });
    }
  }, [entityId, navigate, projectId, workspaceSlug]);

  const saveDraft = useCallback(
    async (closeAfterSave: boolean) => {
      if (!initializedRef.current || save.isPending || !resolvedTitle.trim()) return;
      setError(null);
      try {
        const file = await save.mutateAsync({
          name: resolvedTitle.trim(),
          folder: draftFolder,
          body,
          document_type_id: documentTypeId,
          metadata
        });
        setDirty(false);
        if (closeAfterSave) {
          navigateBack();
        } else if (projectId) {
          navigate(projectMarkdownRoute(workspaceSlug, asProjectPublicId(projectId), file.id, { mode: 'edit' }));
        } else if (entityId) {
          navigate(entityMarkdownRoute(workspaceSlug, asEntityPublicId(entityId), file.id, { mode: 'edit' }));
        } else {
          navigate(workspaceMarkdownRoute(workspaceSlug, file.id, { mode: 'edit' }));
        }
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : 'Unable to save document');
      }
    }, [
      body,
      documentTypeId,
      draftFolder,
      entityId,
      metadata,
      navigate,
      navigateBack,
      projectId,
      resolvedTitle,
      save,
      workspaceSlug
    ]
  );

  const handleTypeChange = useCallback((id: string | null) => {
    setDocumentTypeId(id);
    setDirty(true);
  }, []);

  const handleMetadataChange = useCallback(
    (fieldId: string, value: string | number | boolean | string[] | null | undefined) => {
      setMetadata(current => {
        if (value === undefined) {
          const next = { ...current };
          delete next[fieldId];
          return next;
        }
        return { ...current, [fieldId]: value };
      });
      setDirty(true);
    },
    []
  );

  const trackCreatedDiagram = useCallback(() => {}, []);

  return (
    <MdxContext.Provider value={{ workspaceSlug, projectId, entityId }}>
      <MarkdownDiagramSessionContext.Provider value={{ sessionId, trackCreatedDiagram }}>
        <div className={styles.screen}>
          <MarkdownEditorHeader
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            entityId={entityId}
            parentLabel={parentLabel}
            resolvedTitle={resolvedTitle}
            description={documentType?.name ?? 'New markdown document'}
            isViewMode={false}
            isDraft
            isUploadingAttachment={false}
            attachDisabled
            onNavigateBack={navigateBack}
            actions={{
              onAttachClick: () => {},
              onEnterEdit: () => {},
              onOpenHistory: () => {},
              onRenameRequest: () => {},
              onDeleteRequest: () => {}
            }}
          />

          <MarkdownEditorToolbar
            paneMode={paneMode}
            hasUnsavedChanges={dirty}
            onSelectPane={setPaneMode}
            onSave={() => void saveDraft(false)}
            onSaveAndClose={() => void saveDraft(true)}
            onClose={navigateBack}
          />

          <MarkdownPropertiesPanel
            documentTypeId={documentTypeId}
            documentTypes={documentTypes}
            fields={documentType?.fields ?? []}
            metadata={metadata}
            readOnly={false}
            onTypeChange={handleTypeChange}
            onValueChange={handleMetadataChange}
          />

          <MarkdownEditorPane
            screenMode="edit"
            paneMode={paneMode}
            body={body}
            onChange={value => {
              setBody(value);
              setDirty(true);
            }}
            toc={toc}
            updatedLabel={null}
            readTime={readTime}
            workspaceId={workspaceSlug}
            nodeId=""
            showDiscussion={false}
            attachments={{
              items: [],
              onOpen: () => {},
              onDeleteRequest: () => {},
              isDeleting: false
            }}
          />

          {error && <div role="alert" className={styles.loading}>{error}</div>}
        </div>
      </MarkdownDiagramSessionContext.Provider>
    </MdxContext.Provider>
  );
};
