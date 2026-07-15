import type {
  DocumentField,
  DocumentMetadata,
  DocumentType
} from '@arch-register/api-types/documentContract';

type MarkdownPropertiesPanelProps = {
  documentTypeId: string | null;
  documentTypes: DocumentType[];
  fields: DocumentField[];
  metadata: DocumentMetadata;
  readOnly: boolean;
  onTypeChange: (id: string | null) => void;
  onValueChange: (fieldId: string, value: string | number | boolean | string[] | null) => void;
};

const fieldValue = (metadata: DocumentMetadata, field: DocumentField) => metadata[field.id];

const displayValue = (value: DocumentMetadata[string] | undefined) =>
  Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value);

export const MarkdownPropertiesPanel = ({
  documentTypeId,
  documentTypes,
  fields,
  metadata,
  readOnly,
  onTypeChange,
  onValueChange
}: MarkdownPropertiesPanelProps) => {
  const activeFields = fields.filter(field => !field.retired);
  const retiredFields = fields.filter(field => field.retired && metadata[field.id] !== undefined);

  return (
    <details open style={{ borderBottom: '1px solid var(--panel-border)', background: 'var(--panel-bg)', padding: '10px 18px' }}>
      <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Properties</summary>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <select
          value={documentTypeId ?? ''}
          disabled={readOnly}
          onChange={event => onTypeChange(event.target.value || null)}
          aria-label="Document type"
        >
          <option value="">Untyped Markdown</option>
          {documentTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
        </select>
      </div>
      {documentTypeId == null ? (
        <div className="dim" style={{ fontSize: 11 }}>This is a legacy untyped Markdown document.</div>
      ) : activeFields.length === 0 ? (
        <div className="dim" style={{ fontSize: 11 }}>This document type has no editable fields.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {activeFields.map(field => {
            const value = fieldValue(metadata, field);
            const required = field.requirement === 'required';
            const label = `${field.name}${required ? ' *' : field.requirement === 'expected' ? ' · expected' : ''}`;
            if (readOnly) {
              return <div key={field.id}><div className="dim" style={{ fontSize: 10 }}>{label}</div><div style={{ fontSize: 12 }}>{displayValue(value) || '—'}</div></div>;
            }
            if (field.type === 'long_text') {
              return <label key={field.id} style={{ display: 'grid', gap: 4, fontSize: 11 }}><span>{label}</span><textarea value={displayValue(value)} rows={3} onChange={event => onValueChange(field.id, event.target.value || null)} /></label>;
            }
            if (field.type === 'enum') {
              return <label key={field.id} style={{ display: 'grid', gap: 4, fontSize: 11 }}><span>{label}</span><select value={typeof value === 'string' ? value : ''} onChange={event => onValueChange(field.id, event.target.value || null)}><option value="">Select…</option>{(field.enumOptions ?? []).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
            }
            if (field.type === 'boolean') {
              return <label key={field.id} style={{ display: 'grid', gap: 4, fontSize: 11 }}><span>{label}</span><select value={typeof value === 'boolean' ? String(value) : ''} onChange={event => onValueChange(field.id, event.target.value === '' ? null : event.target.value === 'true')}><option value="">Select…</option><option value="true">True</option><option value="false">False</option></select></label>;
            }
            if (field.type === 'number') {
              return <label key={field.id} style={{ display: 'grid', gap: 4, fontSize: 11 }}><span>{label}</span><input type="number" value={typeof value === 'number' ? value : ''} onChange={event => onValueChange(field.id, event.target.value === '' ? null : Number(event.target.value))} /></label>;
            }
            if (field.type === 'entity_link' || field.type === 'document_link') {
              const links = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
              return <label key={field.id} style={{ display: 'grid', gap: 4, fontSize: 11 }}><span>{label}</span><input value={links.join(', ')} placeholder="IDs separated by commas" onChange={event => onValueChange(field.id, event.target.value.split(',').map(item => item.trim()).filter(Boolean))} /></label>;
            }
            return <label key={field.id} style={{ display: 'grid', gap: 4, fontSize: 11 }}><span>{label}</span><input type={field.type === 'date' ? 'date' : 'text'} value={typeof value === 'string' ? value : ''} onChange={event => onValueChange(field.id, event.target.value || null)} /></label>;
          })}
        </div>
      )}
      {retiredFields.length > 0 && <div className="dim" style={{ marginTop: 10, fontSize: 10 }}>Retired fields are preserved for history: {retiredFields.map(field => field.name).join(', ')}.</div>}
    </details>
  );
};
