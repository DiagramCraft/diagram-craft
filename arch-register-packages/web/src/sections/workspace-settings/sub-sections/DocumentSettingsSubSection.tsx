import { useMemo, useState } from 'react';
import { TbArchive, TbPlus, TbTrash } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import type {
  DocumentField,
  DocumentFieldType,
  DocumentRequirement,
  DocumentMetadata
} from '@arch-register/api-types/documentContract';
import {
  useArchiveDocumentTemplate,
  useArchiveDocumentType,
  useCreateDocumentTemplate,
  useCreateDocumentType,
  useDocumentTemplates,
  useDocumentTypes,
  useUpdateDocumentTemplate,
  useUpdateDocumentType
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
  const { data: types = [], isLoading: typesLoading } = useDocumentTypes(workspaceSlug, true);
  const { data: templates = [], isLoading: templatesLoading } = useDocumentTemplates(workspaceSlug, null, true);
  const createType = useCreateDocumentType(workspaceSlug);
  const archiveType = useArchiveDocumentType(workspaceSlug);
  const createTemplate = useCreateDocumentTemplate(workspaceSlug);
  const archiveTemplate = useArchiveDocumentTemplate(workspaceSlug);
  const updateType = useUpdateDocumentType(workspaceSlug);
  const updateTemplate = useUpdateDocumentTemplate(workspaceSlug);
  const [typeName, setTypeName] = useState('');
  const [typeDescription, setTypeDescription] = useState('');
  const [fields, setFields] = useState<DocumentField[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [templateBody, setTemplateBody] = useState('# {{title}}\n');
  const [templateDefaults, setTemplateDefaults] = useState('{}');
  const [templateTypeId, setTemplateTypeId] = useState('');
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  const hasPending = createType.isPending || createTemplate.isPending || updateType.isPending || updateTemplate.isPending;
  const selectedType = useMemo(() => types.find(type => type.id === templateTypeId), [templateTypeId, types]);
  const templateTypeOptions = useMemo(() => types.filter(type => !type.archived || type.id === templateTypeId), [templateTypeId, types]);

  const updateField = (id: string, patch: Partial<DocumentField>) => {
    setFields(current => current.map(field => (field.id === id ? { ...field, ...patch } : field)));
  };

  const submitType = async () => {
    const name = typeName.trim();
    if (!name) return;
    if (editingTypeId) {
      await updateType.mutateAsync({ id: editingTypeId, body: { name, description: typeDescription, fields } });
    } else {
      await createType.mutateAsync({ name, description: typeDescription, fields });
    }
    setTypeName('');
    setTypeDescription('');
    setFields([]);
    setEditingTypeId(null);
  };

  const submitTemplate = async () => {
    const name = templateName.trim();
    if (!name || !selectedType) return;
    let metadataDefaults: DocumentMetadata;
    try {
      const parsed: unknown = JSON.parse(templateDefaults);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Metadata defaults must be a JSON object');
      metadataDefaults = parsed as DocumentMetadata;
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : 'Metadata defaults must be valid JSON');
      return;
    }
    setTemplateError(null);
    const body = {
      name,
      body: templateBody,
      document_type_id: selectedType.id,
      metadata_defaults: metadataDefaults,
      project_id: null
    };
    if (editingTemplateId) await updateTemplate.mutateAsync({ id: editingTemplateId, body });
    else await createTemplate.mutateAsync(body);
    setTemplateName('');
    setTemplateBody('# {{title}}\n');
    setTemplateDefaults('{}');
    setTemplateTypeId('');
    setEditingTemplateId(null);
  };

  const editType = (id: string) => {
    const type = types.find(item => item.id === id);
    if (!type) return;
    setEditingTypeId(type.id);
    setTypeName(type.name);
    setTypeDescription(type.description);
    setFields(type.fields);
  };

  const editTemplate = (id: string) => {
    const template = templates.find(item => item.id === id);
    if (!template) return;
    setEditingTemplateId(template.id);
    setTemplateName(template.name);
    setTemplateBody(template.body);
    setTemplateDefaults(JSON.stringify(template.metadata_defaults, null, 2));
    setTemplateTypeId(template.document_type_id);
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
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button variant="secondary" onClick={() => editType(type.id)}>Edit</Button>
                  <Button variant="secondary" icon={<TbArchive size={13} />} onClick={() => void archiveType.mutateAsync({ id: type.id, archived: type.archived ? false : true })}>{type.archived ? 'Unarchive' : 'Archive'}</Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          <TextInput value={typeName} onChange={value => setTypeName(value ?? '')} placeholder="New document type name" />
          <TextInput value={typeDescription} onChange={value => setTypeDescription(value ?? '')} placeholder="Description (optional)" />
          {fields.map(field => (
            <div key={field.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 130px 110px 70px 70px auto', gap: 6, alignItems: 'center' }}>
              <TextInput value={field.id} onChange={value => updateField(field.id, { id: value ?? field.id })} placeholder="Stable field ID" />
              <TextInput value={field.name} onChange={value => updateField(field.id, { name: value ?? field.name })} placeholder="Field name" />
              <select value={field.type} onChange={event => updateField(field.id, { type: event.target.value as DocumentFieldType })}>
                {FIELD_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
              <select value={field.requirement} onChange={event => updateField(field.id, { requirement: event.target.value as DocumentRequirement })}>
                {REQUIREMENTS.map(requirement => <option key={requirement} value={requirement}>{requirement}</option>)}
              </select>
              <input type="number" min={0} value={field.minCardinality ?? ''} placeholder="Min" onChange={event => updateField(field.id, { minCardinality: event.target.value === '' ? undefined : Number(event.target.value) })} />
              <input type="number" min={0} value={field.maxCardinality ?? ''} placeholder="Max" onChange={event => updateField(field.id, { maxCardinality: event.target.value === '' ? undefined : Number(event.target.value) })} />
              <Button variant="secondary" icon={<TbTrash size={13} />} onClick={() => setFields(current => current.filter(item => item.id !== field.id))}>Remove</Button>
              {field.type === 'enum' && <TextInput value={(field.enumOptions ?? []).map(option => `${option.value}:${option.label}`).join(', ')} onChange={value => updateField(field.id, { enumOptions: (value ?? '').split(',').map(option => option.trim()).filter(Boolean).map(option => { const [enumValue, ...label] = option.split(':'); return { value: enumValue!.trim(), label: label.join(':').trim() || enumValue!.trim() }; }) })} placeholder="Enum options: proposed:Proposed, accepted:Accepted" />}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" icon={<TbPlus size={13} />} onClick={() => setFields(current => [...current, newField()])}>Add field</Button>
            {editingTypeId && <Button variant="secondary" onClick={() => { setEditingTypeId(null); setTypeName(''); setTypeDescription(''); setFields([]); }}>Cancel</Button>}
            <Button variant="primary" disabled={!typeName.trim() || hasPending} onClick={() => void submitType()}>{editingTypeId ? 'Save type' : 'Create type'}</Button>
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
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button variant="secondary" onClick={() => editTemplate(template.id)}>Edit</Button>
                  <Button variant="secondary" icon={<TbArchive size={13} />} onClick={() => void archiveTemplate.mutateAsync({ id: template.id, archived: template.archived ? false : true })}>{template.archived ? 'Unarchive' : 'Archive'}</Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          <TextInput value={templateName} onChange={value => setTemplateName(value ?? '')} placeholder="New template name" />
          <select value={templateTypeId} onChange={event => setTemplateTypeId(event.target.value)}>
            <option value="" disabled>Select a document type</option>
            {templateTypeOptions.map(type => <option key={type.id} value={type.id}>{type.name}{type.archived ? ' (archived)' : ''}</option>)}
          </select>
          <TextArea value={templateBody} onChange={value => setTemplateBody(value ?? '')} rows={8} allowMaximize={false} />
          <TextArea value={templateDefaults} onChange={value => setTemplateDefaults(value ?? '{}')} rows={4} allowMaximize={false} />
          {templateError && <div role="alert" style={{ color: 'var(--error-fg)', fontSize: 11 }}>{templateError}</div>}
          {editingTemplateId && <Button variant="secondary" onClick={() => { setEditingTemplateId(null); setTemplateName(''); setTemplateBody('# {{title}}\n'); setTemplateDefaults('{}'); setTemplateTypeId(''); setTemplateError(null); }}>Cancel</Button>}
          <Button variant="primary" disabled={!templateName.trim() || !selectedType || hasPending} onClick={() => void submitTemplate()}>{editingTemplateId ? 'Save template' : 'Create template'}</Button>
        </div>
      </section>
    </div>
  );
};
