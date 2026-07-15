import { useMemo, useState } from 'react';
import { TbArchive, TbPlus, TbTrash } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type {
  DocumentField,
  DocumentFieldType,
  DocumentRequirement
} from '@arch-register/api-types/documentContract';
import {
  useArchiveDocumentTemplate,
  useArchiveDocumentType,
  useCreateDocumentTemplate,
  useCreateDocumentType,
  useDocumentTemplates,
  useDocumentTypes
} from '../../../hooks/useDocuments';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';

const FIELD_TYPES: DocumentFieldType[] = [
  'text',
  'long_text',
  'boolean',
  'date',
  'number',
  'enum',
  'entity_link',
  'document_link'
];

const REQUIREMENTS: DocumentRequirement[] = ['required', 'expected', 'optional'];

const newField = (): DocumentField => ({
  id: `field_${crypto.randomUUID().slice(0, 8)}`,
  name: 'New field',
  type: 'text',
  requirement: 'optional',
  retired: false
});

export const DocumentSettingsSubSection = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const { data: types = [], isLoading: typesLoading } = useDocumentTypes(workspaceSlug);
  const { data: templates = [], isLoading: templatesLoading } = useDocumentTemplates(workspaceSlug, null);
  const createType = useCreateDocumentType(workspaceSlug);
  const archiveType = useArchiveDocumentType(workspaceSlug);
  const createTemplate = useCreateDocumentTemplate(workspaceSlug);
  const archiveTemplate = useArchiveDocumentTemplate(workspaceSlug);
  const [typeName, setTypeName] = useState('');
  const [typeDescription, setTypeDescription] = useState('');
  const [fields, setFields] = useState<DocumentField[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [templateBody, setTemplateBody] = useState('# {{title}}\n');
  const [templateTypeId, setTemplateTypeId] = useState('');

  const hasPending = createType.isPending || createTemplate.isPending;
  const selectedType = useMemo(() => types.find(type => type.id === templateTypeId), [templateTypeId, types]);

  const updateField = (id: string, patch: Partial<DocumentField>) => {
    setFields(current => current.map(field => (field.id === id ? { ...field, ...patch } : field)));
  };

  const submitType = async () => {
    const name = typeName.trim();
    if (!name) return;
    await createType.mutateAsync({ name, description: typeDescription, fields });
    setTypeName('');
    setTypeDescription('');
    setFields([]);
  };

  const submitTemplate = async () => {
    const name = templateName.trim();
    if (!name) return;
    await createTemplate.mutateAsync({
      name,
      body: templateBody,
      document_type_id: selectedType?.id ?? null,
      metadata_defaults: {},
      project_id: null
    });
    setTemplateName('');
    setTemplateBody('# {{title}}\n');
  };

  if (typesLoading || templatesLoading) return <LoadingState text="Loading document definitions…" size="sm" />;

  return (
    <div style={{ padding: '0 24px 24px', display: 'grid', gap: 24, maxWidth: 1000 }}>
      <section>
        <h2 style={{ fontSize: 14 }}>Document types</h2>
        <p className="dim">Define stable metadata fields for typed Markdown documents.</p>
        {types.length === 0 ? <EmptyState compact title="No document types defined." /> : (
          <div style={{ display: 'grid', gap: 6 }}>
            {types.map(type => (
              <div key={type.id} style={{ border: '1px solid var(--panel-border)', borderRadius: 6, padding: 10, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div>{type.name}</div>
                  <div className="dim" style={{ fontSize: 11 }}>{type.fields.length} fields{type.description ? ` · ${type.description}` : ''}</div>
                </div>
                <Button variant="secondary" icon={<TbArchive size={13} />} onClick={() => void archiveType.mutateAsync({ id: type.id, archived: true })}>Archive</Button>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          <TextInput value={typeName} onChange={value => setTypeName(value ?? '')} placeholder="New document type name" />
          <TextInput value={typeDescription} onChange={value => setTypeDescription(value ?? '')} placeholder="Description (optional)" />
          {fields.map(field => (
            <div key={field.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px 120px auto', gap: 6, alignItems: 'center' }}>
              <TextInput value={field.id} onChange={value => updateField(field.id, { id: value ?? field.id })} placeholder="Stable field ID" />
              <TextInput value={field.name} onChange={value => updateField(field.id, { name: value ?? field.name })} placeholder="Field name" />
              <select value={field.type} onChange={event => updateField(field.id, { type: event.target.value as DocumentFieldType })}>
                {FIELD_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
              <select value={field.requirement} onChange={event => updateField(field.id, { requirement: event.target.value as DocumentRequirement })}>
                {REQUIREMENTS.map(requirement => <option key={requirement} value={requirement}>{requirement}</option>)}
              </select>
              <Button variant="secondary" icon={<TbTrash size={13} />} onClick={() => setFields(current => current.filter(item => item.id !== field.id))}>Remove</Button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" icon={<TbPlus size={13} />} onClick={() => setFields(current => [...current, newField()])}>Add field</Button>
            <Button variant="primary" disabled={!typeName.trim() || hasPending} onClick={() => void submitType()}>Create type</Button>
          </div>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 14 }}>Workspace templates</h2>
        <p className="dim">Reusable Markdown bodies with optional typed metadata defaults.</p>
        {templates.length === 0 ? <EmptyState compact title="No workspace document templates defined." /> : (
          <div style={{ display: 'grid', gap: 6 }}>
            {templates.map(template => (
              <div key={template.id} style={{ border: '1px solid var(--panel-border)', borderRadius: 6, padding: 10, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div><div>{template.name}</div><div className="dim" style={{ fontSize: 11 }}>{template.document_type_id ? types.find(type => type.id === template.document_type_id)?.name ?? 'Unknown type' : 'Untyped'}</div></div>
                <Button variant="secondary" icon={<TbArchive size={13} />} onClick={() => void archiveTemplate.mutateAsync({ id: template.id, archived: true })}>Archive</Button>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          <TextInput value={templateName} onChange={value => setTemplateName(value ?? '')} placeholder="New template name" />
          <select value={templateTypeId} onChange={event => setTemplateTypeId(event.target.value)}>
            <option value="">Untyped template</option>
            {types.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
          </select>
          <TextArea value={templateBody} onChange={value => setTemplateBody(value ?? '')} rows={8} allowMaximize={false} />
          <Button variant="primary" disabled={!templateName.trim() || hasPending} onClick={() => void submitTemplate()}>Create template</Button>
        </div>
      </section>
    </div>
  );
};
