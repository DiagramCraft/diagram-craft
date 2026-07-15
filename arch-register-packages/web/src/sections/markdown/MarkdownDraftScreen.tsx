import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import type { DocumentMetadata } from '@arch-register/api-types/documentContract';
import { useCreateDocumentTemplate, useDocumentTemplates, useDocumentTypes } from '../../hooks/useDocuments';
import { useSaveNewMarkdownContent } from '../../hooks/useMarkdownContent';
import type { ContentScope } from '../../hooks/useContentScope';
import { MarkdownPropertiesPanel } from './MarkdownPropertiesPanel';
import { Title } from '../../components/Title';
import { ApiError } from '../../lib/http';
import {
  entityDetailRoute,
  entityMarkdownRoute,
  asEntityPublicId,
  asProjectPublicId,
  projectDetailRoute,
  projectMarkdownRoute,
  workspaceMarkdownRoute
} from '../../routes/publicObjectRoutes';

export const MarkdownDraftScreen = () => {
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false }) as { draftName?: string; draftFolder?: string };
  const navigate = useNavigate();
  const { workspaceSlug, projectId, entityId } = params;
  const { data: types = [] } = useDocumentTypes(workspaceSlug!);
  const { data: workspaceTemplates = [] } = useDocumentTemplates(workspaceSlug!, null);
  const { data: projectTemplates = [] } = useDocumentTemplates(workspaceSlug!, projectId ?? null);
  const scope = useMemo<ContentScope>(() => projectId
    ? { kind: 'project', workspaceId: workspaceSlug!, projectId }
    : entityId
      ? { kind: 'entity', workspaceId: workspaceSlug!, entityId }
      : { kind: 'workspace', workspaceId: workspaceSlug! }, [entityId, projectId, workspaceSlug]);
  const save = useSaveNewMarkdownContent(scope);
  const createProjectTemplate = useCreateDocumentTemplate(workspaceSlug!);
  const templates = projectId ? [...workspaceTemplates, ...projectTemplates] : workspaceTemplates;
  const [name, setName] = useState(search.draftName ?? 'Untitled document');
  const [body, setBody] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<DocumentMetadata>({});
  const [templateId, setTemplateId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');

  const documentType = types.find(type => type.id === documentTypeId) ?? null;
  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const template = templates.find(item => item.id === id);
    if (!template) return;
    setBody(template.body.split('{{title}}').join(name));
    setDocumentTypeId(template.document_type_id);
    setMetadata(template.metadata_defaults);
  };

  const closeDraft = () => {
    if (projectId) navigate(projectDetailRoute(workspaceSlug!, asProjectPublicId(projectId)));
    else if (entityId) navigate(entityDetailRoute(workspaceSlug!, asEntityPublicId(entityId)));
    else navigate({ to: '/$workspaceSlug/content', params: { workspaceSlug: workspaceSlug! } });
  };

  const saveDraft = async () => {
    if (!name.trim()) return;
    setError(null);
    try {
      const file = await save.mutateAsync({ name: name.trim(), folder: search.draftFolder, body, document_type_id: documentTypeId, metadata });
      if (projectId) navigate(projectMarkdownRoute(workspaceSlug!, asProjectPublicId(projectId), file.id, { mode: 'edit' }));
      else if (entityId) navigate(entityMarkdownRoute(workspaceSlug!, asEntityPublicId(entityId), file.id, { mode: 'edit' }));
      else navigate(workspaceMarkdownRoute(workspaceSlug!, file.id, { mode: 'edit' }));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to save document');
    }
  };

  const saveProjectTemplate = async () => {
    if (!projectId || !templateName.trim()) return;
    setError(null);
    try {
      await createProjectTemplate.mutateAsync({
        name: templateName.trim(),
        body,
        document_type_id: documentTypeId,
        metadata_defaults: metadata,
        project_id: projectId
      });
      setTemplateName('');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to save project template');
    }
  };

  const documentFields = documentType?.fields ?? [];
  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <Title title="New Markdown document" description="Drafts stay local until you save." />
      <div style={{ padding: '0 24px 24px', display: 'grid', gap: 12, maxWidth: 1100 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={name} onChange={event => setName(event.target.value)} placeholder="Document title" style={{ flex: 1 }} />
          <select value={templateId} onChange={event => applyTemplate(event.target.value)}>
            <option value="">Blank draft</option>
            {templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
        </div>
        <MarkdownPropertiesPanel
          documentTypeId={documentTypeId}
          documentTypes={types}
          fields={documentFields}
          metadata={metadata}
          readOnly={false}
          onTypeChange={id => setDocumentTypeId(id)}
          onValueChange={(fieldId, value) => setMetadata(current => ({ ...current, [fieldId]: value }))}
        />
        <textarea value={body} onChange={event => setBody(event.target.value)} placeholder="Start writing in Markdown…" rows={22} style={{ width: '100%', resize: 'vertical' }} />
        {projectId && <div style={{ display: 'flex', gap: 8 }}><input value={templateName} onChange={event => setTemplateName(event.target.value)} placeholder="Project template name (optional)" style={{ flex: 1 }} /><Button variant="secondary" disabled={!templateName.trim() || createProjectTemplate.isPending} onClick={() => void saveProjectTemplate()}>Save as project template</Button></div>}
        {error && <div role="alert" style={{ color: 'var(--error-fg)' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" onClick={closeDraft}>Discard</Button>
          <Button variant="primary" disabled={save.isPending || !name.trim()} onClick={() => void saveDraft()}>{save.isPending ? 'Saving…' : 'Save document'}</Button>
        </div>
      </div>
    </div>
  );
};
